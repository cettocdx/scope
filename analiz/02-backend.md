# 02 — Backend Analizi

> Kapsam: `server/*.ts`, `shared/schema.ts`, `drizzle.config.ts`. Express + TS, Gemini/Ximilar/Clarifai/SerpAPI, PostgreSQL/Drizzle.

## Mevcut Durum
İşlevsel ve okunabilir bir Express API. `/api/analyze` 4 ücretli upstream servisi orkestre ediyor, IQR outlier temizliği ve değerleme yapıyor. Portföy CRUD + sync endpoint'leri mevcut. Ancak prototip kalitesinde yapısal açıklar var.

## Bulgular

### Kritik
- **B-K1 — Portföy endpoint'lerinde auth yok + IDOR** `routes.ts:687-799`. Yetkilendirme yalnızca istemci üretimi `deviceId`. `updatePortfolioAsset` (`storage.ts:78`) `deviceId`'yi WHERE'e almıyor → herhangi bir `assetId` bilen herhangi bir varlığı değiştirebilir. → `05-guvenlik.md` K-1.
- **B-K2 — `insertPortfolioAssetSchema` import edilip hiç kullanılmıyor** `routes.ts:5`. Create/update/sync'te `.parse()`/`.safeParse()` yok; `req.body` doğrudan `...assetData` ile DB'ye akıyor (`routes.ts:721-725,782`). Mass-assignment + tip güvensizliği. **Öneri:** her yazma endpoint'inde `safeParse`, hatada 400.

### Yüksek
- **B-Y1 — Dış çağrılarda timeout yok** `serpapi.ts:210`, `ximilar.ts:62,174`, `clarifai.ts:71,202`, Gemini `routes.ts:400`. SerpAPI 3 bölge için **sıralı** (`serpapi.ts:196`); biri asarsa tüm istek asılır. **Öneri:** `AbortController` + per-call timeout (8-10sn), bölgeleri `Promise.allSettled` ile paralelleştir.
- **B-Y2 — SerpAPI fallback'i uydurma fiyat üretiyor** `serpapi.ts:326-347`: `basePrice = 500 + Math.random()*1000`. Bu sahte değerler `estimatedPrice`'a yansıyor (`routes.ts:578-585`). **Öneri:** fallback'te "veri yok" dön, fiyat uydurma.
- **B-Y3 — `qualityScore`'da `Math.random()`** `routes.ts:79`: `80 + Math.floor(Math.random()*20)`. Deterministik metrik gibi sunulan rastgele skor. **Öneri:** gerçek sinyalden türet veya kaldır.
- **B-Y4 — FX kurları sabit + iki kaynakta çelişkili** `routes.ts:10-17` vs `serpapi.ts:57-62`. `/api/fx` bu sabitleri `updatedAt: new Date()` ile canlı kur gibi servis ediyor (`routes.ts:652-663`). **Öneri:** tek canlı FX servisi (+cache).
- **B-Y5 — Sync endpoint'inde N+1** `routes.ts:777-792`: döngünün her iterasyonunda `getPortfolioAssets(deviceId)` çağrılıyor. **Öneri:** döngü öncesi bir kez çek, Map ile eşleştir, toplu upsert.
- **B-Y6 — Migration yok, `device_id` index yok** `migrations/` dizini mevcut değil; `package.json:13` sadece `drizzle-kit push` (versiyonsuz, yıkıcı). `schema.ts:18` `deviceId` indekssiz. **Öneri:** `drizzle-kit generate`, `index("idx_portfolio_device").on(deviceId, dateAdded)`.
- **B-Y7 — Env var tutarsızlığı** `routes.ts:363` `AI_INTEGRATIONS_GEMINI_API_KEY` kullanıyor ama `replit.md:109-114` bu anahtarı **hiç listelemiyor**. Anahtar yoksa Gemini sessizce undefined key ile çağrılır. `httpOptions.apiVersion: ""` (`routes.ts:365`) Replit proxy'sine özel, taşınabilir değil. **Öneri:** doğru env adını dokümana ekle, anahtar yoksa erken 503.

### Orta
- **B-O1 — Sync eşleştirmesi Date/string karşılaştırması** `routes.ts:779`: `e.dateAdded === asset.dateAdded` (DB `Date` vs gövde `string`) → daima `false` → **duplicate insert** riski.
- **B-O2 — `storage.syncPortfolio` ölü kod** `storage.ts:95-109`; route kendi (kusurlu) sync mantığını yazmış → iki çelişkili sync yolu.
- **B-O3 — REST tutarsızlığı** `POST /api/portfolio` create'te de 200 dönüyor (201 beklenir), upsert semantiği belirsiz (`routes.ts:701-732`).
- **B-O4 — Hata HTTP kodları** Gemini JSON parse hatası 500 dönüyor (`routes.ts:450-453`), upstream sorunu için 502 daha doğru.
- **B-O5 — `index.ts:216` `throw err`** Yanıt gönderildikten sonra throw → unhandled rejection/log gürültüsü. **Öneri:** sadece logla.
- **B-O6 — CORS yalnızca Replit domainlerine bağlı** `index.ts:16-46`; env yoksa hiçbir origin izinli değil, Replit dışı web istemci kırılır.

### Düşük / Pozitif
- **B-D1 — Ölü kod:** `ximilar.ts:165-201` `searchSimilarProducts`, `clarifai.ts:186-253` `analyzeApparelWithClarifai` export edilmiş ama çağrılmıyor.
- **B-D2 — Yaygın `any`:** `routes.ts:33,36,517,621-623`; `serpapi.ts:222,237`. `catch (error: any)` çoğu yerde.
- **B-D3 — `convertToUSD` iki kez tanımlı** (`routes.ts:19`, `serpapi.ts:142`) farklı kurlarla.
- **B-D4 — `extractPrice` ayraç mantığı kırılgan** `serpapi.ts:147-181` (test yok).
- **✅ Pozitif:** SQL injection riski yok (Drizzle parametreli `eq/and`); şema tipleri çoğunlukla net; AI ensemble fallback tasarımı düşünülmüş.

## Sağlık Skoru: **38/100**
İşlevsel iskelet sağlam; fakat auth/IDOR (güvenlik), validasyon/sync/migration (veri bütünlüğü) ve rastgele fiyat/skor (veri doğruluğu) eksenlerinde production-blocker borç var. Bunlar düzeltilmeden canlıya alınmamalı.

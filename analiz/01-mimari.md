# 01 — Mimari Analizi (CTO)

## Mevcut Durum
SCOPE, tek depoda üç katmanlı bir monorepo:

```
client/   → Expo React Native (React 19, RN 0.81) — sunum + iş mantığı
server/   → Express + TypeScript — AI orkestrasyonu, fiyat, kalıcılık
shared/   → Drizzle şeması + zod tipleri (her iki taraf @shared ile tüketir)
```

**Veri akışı (ana senaryo):**
Kamera (`ScannerScreen`) → base64 görsel → `Review/Confirm` → `POST /api/analyze` →
sunucuda **paralel AI ensemble** (Gemini 2.5 Flash + Ximilar + Clarifai) → ProductDNA üretimi →
DNA `searchQueries` ile **çok-bölgeli SerpAPI** fiyat → IQR outlier temizliği + değerleme →
`Result` ekranı → "Add to Vault" → AsyncStorage (local-first) + `POST /api/portfolio` (cloud sync).

Bu hat **kavramsal olarak güçlü**: çok-modelli kimlik tespiti, yapılandırılmış ürün "DNA"sı ve bölgesel fiyat karşılaştırması gerçek bir farklılaşma sağlıyor.

## Bulgular

### Mimari Güçlü Yönler
- **Katman ayrımı net** (`client`/`server`/`shared`), `@shared` & `@/` path alias'ları hem TS (`tsconfig.json:6-9`) hem Babel (`babel.config.js:6-16`) tarafında tutarlı. *(Önem: pozitif)*
- **Tip-güvenli navigasyon** (`RootStackParamList`) ve sağlam provider hiyerarşisi (`App.tsx`: ErrorBoundary > QueryClient > SafeArea > Gesture > Keyboard > Navigation). *(pozitif)*
- **Graceful degradation niyeti**: her AI servisi bağımsız `.catch` ile null'a düşüyor (`routes.ts:391-417`). *(pozitif)*

### Çapraz Kesen Teknik Borç (kök nedenler)

**M1 — "İkiz Sistem" anti-pattern'i | Yüksek.**
İki ayrı yerde, iyi tasarlanmış soyutlama katmanları kurulmuş **ama tamamen atlanmış**:
- Tasarım sistemi: `theme.ts` token'ları + `ThemedText`/`Button`/`Card` → 9 ekranın 9'u da yok sayıp `Colors.dark.*` ve inline stil yazıyor.
- Veri katmanı: TanStack React Query (`query-client.ts`, `QueryClientProvider`) → hiçbir ekran `useQuery`/`useMutation` çağırmıyor; her şey elle `fetch` + `useState`.
Sonuç: her özellik iki kez yazılıyor (soyutlama + gerçek kullanım), bakım maliyeti katlanıyor. Bu, kod tabanındaki en yaygın **AI-üretimi artefaktı**.

**M2 — "Local-first, no auth" kararının güvenlik bedeli | Kritik.**
`design_guidelines.md:4` bilinçli olarak "no authentication required" diyor. Ancak cloud sync eklenince (`/api/portfolio`) bu karar, kimliksiz ve `deviceId`-scope'suz bir API'ye dönüştü → IDOR. Vizyon (sürtünmesiz local-first) ile gerçeklik (paylaşımlı backend) arasında çözülmemiş bir gerilim var. *(Detay: `05-guvenlik.md`)*

**M3 — Veri modeli kullanıcıya bağlı değil | Yüksek.**
`shared/schema.ts`: `users` ve `portfolioAssets` arasında foreign key/ilişki yok; varlıklar serbest `deviceId` taşıyor (`schema.ts:18`). `device_id` üzerinde index yok → büyüdükçe full table scan. Migration geçmişi yok (`drizzle-kit push` ile versiyonsuz şema senkronu).

**M4 — Sahte/türetilmiş veri mimariye gömülü | Kritik (ürün).**
Değer üretiminin merkezinde rastgelelik var: `qualityScore` (`routes.ts:79`), SerpAPI fallback fiyatı (`serpapi.ts:326-347`), istemci tarafı `history` (`ResultScreen.tsx:98-100`). Bir "değerleme motoru" için bu, mimarinin güven temelini çürütüyor.

**M5 — Ortama sert bağımlılık | Yüksek.**
Domain çözümü, CORS ve build script'i tamamen Replit env'lerine bağlı (`REPLIT_DEV_DOMAIN`/`REPLIT_DOMAINS`). Replit dışında (lokal/CI/başka cloud) kutudan çıktığı gibi çalışmıyor. *(Detay: `06-dx-devops.md`)*

**M6 — Tip güvenliği kaçakları | Orta.**
`strict: true` açık olmasına rağmen `deals`/SerpAPI akışı baştan sona `any` (örn. `routes.ts:33,36,517`; `serpapi.ts:222,237`). `shared/schema.ts:29` `deals` jsonb `any[]`. API yanıtları istemcide runtime doğrulamadan `AssetData` varsayılıyor.

## Riskler
- **Ölçeklenme:** base64 görseller AsyncStorage + navigation params + DB + cloud body boyunca taşınıyor → bellek/storage/performans duvarı.
- **Veri bütünlüğü:** validasyon + migration + sync hataları (Date/string karşılaştırması) duplicate/bozuk kayıt üretebilir.
- **Taşınabilirlik:** Replit dışına çıkış maliyetli; vendor lock-in.
- **Güven:** uydurma veri keşfedilirse ürünün tüm değer önerisi çöker.

## Öneriler (önceliklendirilmiş)
1. **(P0)** Tek bir gerçek kaynak ilkesi: ya soyutlamaları benimse (theme + React Query) ya da sil. Yeni kodda inline stil/fetch yasağı.
2. **(P0)** Auth katmanı + `userId` FK ile veri modelini kullanıcıya bağla; tüm sorgulara sahiplik scope'u.
3. **(P0)** Tüm türetilmiş/rastgele veriyi gerçek sinyallere bağla veya kaldır.
4. **(P1)** Görsel kalıcılığını yeniden tasarla: base64 yerine `expo-file-system` uri + cloud blob; DB'de yalnızca referans.
5. **(P1)** Drizzle migration'lara geç, `device_id`/`(device_id, date_added)` index ekle.
6. **(P1)** Ortam soyutlaması: domain/CORS için Replit dışı fallback.
7. **(P2)** Client (RN) ve server (node) için ayrı tsconfig (project references); `any` akışlarını tiplendir.

## Mimari Sağlık Skoru: **48/100**
Doğru kurulmuş bir iskelet ve gerçekten yenilikçi bir AI hattı üzerine, benimsenmemiş soyutlamalar, çözülmemiş auth/veri-modeli gerilimi ve ürün güvenini zedeleyen sahte veri biniyor. Temel sağlam; borç ödenebilir ama production öncesi zorunlu.

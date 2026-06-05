# 08 — Yol Haritası (Önceliklendirilmiş)

> Tüm departman bulgularının tek bir uygulama planına sentezi.
> Öncelik: **P0** = production-blocker / hemen · **P1** = 2-4 hafta · **P2** = 1-2 ay.
> Her madde: [Departman] · ilgili bulgu kodu · tahmini efor (S/M/L).

---

## P0 — Bu Hafta (Production-Blocker)

### Güvenlik & Veri Güveni
- [ ] **Authentication + sahiplik scope'u** `[Güvenlik K-1 / Backend B-K1]` · L
  Cihaz başına sunucu üretimi opaque/imzalı token; `Authorization` header doğrulaması. Tüm get/update/delete sorgularına `and(eq(id), eq(deviceId))`; ownership takeover'da 403. `deviceId` → sunucu UUIDv4.
- [ ] **Uydurma veriyi kaldır** `[Backend B-Y2,B-Y3 / UI U-O3,U-O7]` · M
  SerpAPI random fallback fiyatını "veri yok" durumuna çevir; `qualityScore` random'ını gerçek sinyale bağla veya sil; "99% MATCH"→gerçek `confidenceScore`; sabit GPS/ISO, "Why?" sabit faktörleri ve random `history`'yi kaldır/gerçekle değiştir.
- [ ] **Girdi validasyonu** `[Backend B-K2]` · S
  `insertPortfolioAssetSchema.safeParse()` tüm yazma endpoint'lerinde; `/api/analyze` & `/api/valuate` için zod şeması; hatada 400.
- [ ] **Rate limit + helmet** `[Güvenlik Y-1]` · S
  `express-rate-limit` (IP/deviceId başına, `/api/analyze` sıkı), `helmet`.

### Repo Hijyeni & Secret
- [ ] **`.gitignore`'a `.env`** + `attached_assets/` + zip kaldır `[Güvenlik Y-2,D-4 / DX X-K2]` · S
  `.env`, `.env.*`, `!.env.example`; `git rm -r attached_assets/`.
- [ ] **Production log temizliği** `[Güvenlik Y-3 / Backend B-O5]` · S
  Response-body logunu kapat (method+path+status+duration); `index.ts:216` `throw err` kaldır; generic hata mesajları.

---

## P1 — 2-4 Hafta (Sağlamlaştırma)

### Frontend Veri Katmanı
- [ ] **React Query'i gerçekten kullan** `[Frontend F-Y1,F-Y2]` · M
  Portfolio okuma `useQuery`, yazma `useMutation` + `invalidateQueries(["portfolio"])`; manuel `focus` listener'larını kaldır.
- [ ] **Görsel kalıcılığını yeniden tasarla** `[Frontend F-K1,F-Y5 / Mimari M*]` · L
  base64 yerine `expo-file-system` uri + thumbnail; DB/sync'te yalnızca referans; FlatList'e `getItemLayout`/`windowSize`/memoize.
- [ ] **Sync sağlamlaştırma** `[Frontend F-O1 / Backend B-Y5,B-O1]` · M
  Silme senkronizasyonu + offline retry kuyruğu; N+1'i kaldır (tek çekim+Map); Date/string eşleştirme hatasını düzelt; tek sync yolu.
- [ ] **API çağrılarına timeout/iptal** `[Frontend F-Y4 / Backend B-Y1]` · S
  İstemci ve sunucu `AbortController`; SerpAPI bölgelerini `Promise.allSettled` ile paralelleştir.

### Veritabanı & DX
- [ ] **Drizzle migration + index** `[Backend B-Y6]` · S
  `drizzle-kit generate`; `index("idx_portfolio_device").on(deviceId, dateAdded)`.
- [ ] **Test + CI + README + .env.example** `[DX X-K1,X-Y1,X-Y3,X-Y4]` · M
  Vitest/Jest ile server saf mantık testleri (valuation, IQR, FX, DNA parse); `.github/workflows/ci.yml` (types+lint+format+test); gerçek `README.md`; `.env.example`.
- [ ] **Env tutarlılığı + ortam fallback** `[Backend B-Y7 / DX X-Y2]` · S
  Gemini env adını dokümana ekle + anahtar yoksa 503; domain/CORS için Replit dışı fallback.

---

## P2 — 1-2 Ay (Olgunlaştırma)

### Tasarım Sistemi & a11y
- [ ] **Tek gerçek kaynak: tasarım sistemini benimset** `[UI U-K1,U-Y1 / Mimari M1]` · L
  Tüm ekranları `useTheme()` + ortak `Button`/`Card`/`ThemedText`'e taşı VEYA ölü soyutlamayı sil; hardcoded renk/spacing → token; `TrendPill`/`RatingBadge` çıkar.
- [ ] **Erişilebilirlik temeli** `[UI U-Y5,U-Y6 / Frontend F-A1]` · M
  Tüm ikon-only butonlara `accessibilityRole`+`accessibilityLabel`; 44px touch target; kontrast düzeltmeleri.
- [ ] **Light/dark kararını netleştir** `[UI U-Y2]` · S
  Light'ı farklılaştır veya tek temaya indir.
- [ ] **Loading/empty/error durumları** `[UI U-Y7,U-Y8]` · M
  Vault/Analytics skeleton; analiz hatasında retry (fotoğrafı kaybetmeden).

### Backend & Veri Doğruluğu
- [ ] **Canlı FX servisi** `[Backend B-Y4,B-D3]` · S
  Tek FX modülü (canlı API + cache); `convertToUSD` tekilleştir.
- [ ] **Gerçek image doğrulama + body limit** `[Güvenlik O-2,O-3]` · S
  magic-byte kontrolü, limiti 8-10mb'a indir.
- [ ] **Parola hash (auth açılınca)** `[Güvenlik O-1]` · S
  `argon2`/`bcrypt`, `passwordHash`.
- [ ] **Ölü kod temizliği** `[Backend B-D1 / Frontend F-D2 / DX X-D2]` · S
  Kullanılmayan AI fonksiyonları, `AppState` enum, atıl componentler, `@octokit/rest`.
- [ ] **Monorepo tsconfig ayrımı + `any` tiplendirme** `[DX X-O2 / Mimari M6]` · M

### Ürün & Büyüme
- [ ] **Monetizasyon altyapısı** `[Pazarlama]` · M
  Freemium kota (AI maliyeti için zorunlu), affiliate tag'leri (URL üretimi hazır), Pro abonelik.
- [ ] **Tek segment GTM** `[Pazarlama]` · M
  Yeniden satıcı odağı; gerçek fiyat/işlem verisiyle "doğruluk" kanıtı; UGC/share akışı.
- [ ] **Eksik özellikler** `[Pazarlama]` · L
  Gerçek fiyat geçmişi/alarm, satış kanalı entegrasyonu, onboarding.

---

## Özet Sıralama (ilk 6 iş)
1. Auth + deviceId scope (K-1)
2. Uydurma veriyi kaldır (ürün güveni)
3. Girdi validasyonu (B-K2)
4. Rate limit + helmet (Y-1)
5. Repo hijyeni: `.env` + `attached_assets/` (Y-2, X-K2)
6. React Query + görsel/uri mimarisi (F-Y1, F-K1)

> Not: Bu yol haritası **analiz çıktısıdır**; hiçbir kaynak kod değiştirilmemiştir. Uygulamaya geçmek istersen P0'dan başlayıp madde madde ilerleyebiliriz.

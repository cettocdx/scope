# 05 — Güvenlik Analizi (CSO)

> Salt-okuma denetim. Kapsam: tüm depo, secret taraması, git geçmişi, config.

## Yönetici Özeti
En kritik sorun **authentication/authorization'ın tamamen yokluğu** ve buna bağlı **IDOR** açıkları. Ardından **pahalı AI endpoint'inde rate limit yokluğu** (finansal DoS) ve **`.gitignore`'un plain `.env`'i kapsamaması**. Hardcoded canlı API key bulunamadı; git geçmişinde sızıntı yok (olumlu).

## Bulgular

### KRİTİK
- **K-1 — Portföy endpoint'lerinde IDOR** `routes.ts:687-799`, `storage.ts:78-93`. CVSS ~9.1.
  - `deviceId` istemcide `device-${Date.now()}-${Math.random()}` ile üretiliyor (`portfolioService.ts:11`), tahmin/enumerate edilebilir. → başkasının tüm portföyünü (itemName, fiyat, **imageBase64**) okuma.
  - `PUT .../:assetId` (`routes.ts:734-749`) ve `updatePortfolioAsset` (`storage.ts:78`) `deviceId`'yi WHERE'e almıyor → herhangi bir varlığı değiştirme.
  - `POST .../:deviceId` (`routes.ts:701-718`) `assetData.id` ile var olan kaydı çekip `deviceId` override ediyor → **ownership takeover** (başkasının asset'ini ele geçirme).
  - **Düzeltme:** gerçek kimlik doğrulama (cihaz başına sunucu üretimi imzalı/opaque token, `Authorization` header); savunma derinliği olarak tüm get/update/delete sorgularına `and(eq(id), eq(deviceId))`; takeover'da 403; `deviceId`'i sunucu tarafı UUIDv4 yap.

### YÜKSEK
- **Y-1 — `/api/analyze` rate limit yok → maliyet/DoS** `routes.ts:349-650`. Her çağrı 3 ücretli upstream (Gemini+Ximilar+Clarifai) + SerpAPI tetikliyor; auth/limit/captcha yok. CVSS ~7.5. **Düzeltme:** `express-rate-limit` (IP/deviceId başına), `helmet` güvenlik header'ları.
- **Y-2 — `.gitignore` plain `.env`'i kapsamıyor** Yalnızca `.env*.local` var; `.env` ignore edilmiyor. Geliştirici `.env` commit ederse tüm key'ler sızar. CVSS ~7.0 (koşullu). **Düzeltme:** `.gitignore`'a `.env`, `.env.*`, `!.env.example`.
- **Y-3 — Hassas veri loglanıyor** `index.ts:81-83` her `/api` yanıtının tam JSON body'sini logluyor (portföy/fiyat); `routes.ts:451` JSON parse hatasında tüm AI çıktısını; `routes.ts:359` kullanıcı `refinements`'ini. CVSS ~6.5. **Düzeltme:** production'da response-body logunu kapat (yalnızca method+path+status+duration), PII maskele.

### ORTA
- **O-1 — Parola plaintext** `schema.ts:11` `password: text(...)`, `storage.ts:29-35` hash yok. Şu an auth kullanılmıyor (Kritik değil) ama açılınca felaket. **Düzeltme:** `argon2`/`bcrypt`, alan adı `passwordHash`.
- **O-2 — 50mb body limiti** `index.ts:50-61`; auth/limit yokken bellek/DoS. **Düzeltme:** 8-10mb'a indir.
- **O-3 — Base64 görsel doğrulaması yüzeysel** `routes.ts:370-387` yalnızca ilk 100 karakteri regex'liyor; magic-byte/decode kontrolü yok. **Düzeltme:** decode + image magic bytes (JPEG `FFD8`, PNG `89504E47`, WEBP `RIFF…WEBP`) + max boyut.
- **O-4 — Hata mesajlarında iç bilgi sızıntısı** `routes.ts:648,683,697…` `error.message` doğrudan istemciye. `index.ts:216` `throw err` (HEADERS_SENT riski). **Düzeltme:** generic mesaj, detay sadece log; `throw err`'ı kaldır.

### DÜŞÜK / POZİTİF
- **D-1 — CORS** allowlist tabanlı (wildcard yok) — doğru; ancak `Allow-Credentials: true` açık (şu an etkisiz). Düşük öncelik.
- **D-2 — `@octokit/rest` kullanılmayan bağımlılık** (`package.json:23`) → saldırı yüzeyi/supply-chain. Kaldır.
- **D-3 — ✅ SQL injection yok** (Drizzle parametreli).
- **D-4 — `attached_assets/`** eski referans kod; içinde `GEMINI_API_KEY=` **placeholder** (gerçek key yok) + eski client-side key deseni. Repodan çıkar (gelecekte yanlışlıkla gerçek key yapıştırma riski).
- **✅ Olumlu:** tüm key'ler `process.env`'den; git geçmişinde canlı key yok; delete'te kısmi `deviceId` kontrolü var.

## Remediation Önceliği
1. (K-1) Auth + her sorguya deviceId scope + takeover engeli
2. (Y-1) `/api/analyze` & `/api/valuate` rate limit + helmet
3. (Y-2) `.gitignore`'a `.env`
4. (Y-3) Production response-body logunu kapat
5. (O-1..O-4) Parola hash, body limit, image doğrulama, generic hata + `throw err` kaldır
6. (D-2/D-4) `@octokit/rest` ve `attached_assets/` temizliği

## Güvenlik Skoru: **38/100 (Zayıf)**
Secret yönetimi makul, ama uygulama tamamen auth'tan yoksun; tahmin edilebilir `deviceId` + IDOR'lar tüm kullanıcı verisini açığa çıkarıyor. Pahalı AI endpoint'inde rate limit yokluğu doğrudan finansal risk.

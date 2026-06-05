# SCOPE — Kurulum & Çalıştırma (Türkçe)

Bu rehber, uygulamayı **kendi telefonunda çalışır** hale getirmen için adım adım anlatır.
Tarama + AI analizinin çalışması için **tek gereken ücretsiz bir Google Gemini anahtarı.**

---

## 0. Gereksinimler (bir kez)
- **Node.js 20+** (kuruluysa geç)
- Telefonuna **Expo Go** uygulaması (App Store / Play Store)
- Bilgisayar ve telefon **aynı WiFi'de**

---

## 1. Ücretsiz Gemini API anahtarı al (2 dakika)
1. Tarayıcıda aç: **https://aistudio.google.com/apikey**
2. Google hesabınla giriş yap.
3. **"Create API key"** (API anahtarı oluştur) butonuna bas.
4. Çıkan uzun anahtarı **kopyala** (örn. `AIza...`).

> Ücretsiz, kredi kartı istemez. Günlük belli bir kullanım limiti vardır, denemeler için fazlasıyla yeter.

---

## 2. `.env` dosyasını oluştur
Bilgisayarın Terminal'inde:
```
cd /Users/cetto/Developer/scope
cp .env.example .env
```
Sonra `.env` dosyasını bir metin editörüyle aç (örn. `open -e .env`) ve şu satırı doldur:
```
GEMINI_API_KEY=BURAYA_KOPYALADIĞIN_ANAHTARI_YAPIŞTIR
```
Kaydet. (Diğer satırları boş bırakabilirsin — opsiyoneller.)

---

## 3. İki şeyi aynı anda çalıştır
SCOPE iki parçadan oluşur: **backend (sunucu)** ve **mobil uygulama**.

**Terminal penceresi 1 — sunucu:**
```
cd /Users/cetto/Developer/scope
npm run server:dev
```
`express server serving on port 5000` yazısını görürsen sunucu hazır.

**Terminal penceresi 2 — mobil uygulama:**
```
cd /Users/cetto/Developer/scope
npx expo start
```
Çıkan **QR kodu** telefonla okut (iPhone: Kamera; Android: Expo Go → Scan QR).

> İkisini tek komutla da çalıştırabilirsin: `npm run all:dev`

---

## 4. Dene
Telefonda SCOPE açılınca → **START SCANNING** → bir eşyanın fotoğrafını çek → AI analiz etsin.

---

## Ne zaman ne gerekir?
| Özellik | Gereken |
|---|---|
| Tarama + AI ürün tanıma + değerleme | **GEMINI_API_KEY** (zorunlu) |
| Gerçek çok-bölgeli mağaza fiyatları | SERPAPI_KEY (opsiyonel) |
| Ekstra görsel tanıma (renk/malzeme) | XIMILAR_API_KEY / CLARIFAI_API_KEY (opsiyonel) |
| Cihazlar arası bulut portföy senkronu | DATABASE_URL — PostgreSQL (opsiyonel) |

> Anahtar yoksa uygulama çökmez: ilgili özellik kapanır, gerisi çalışır. DATABASE_URL olmadan da
> sunucu açılır; portföyün telefonda yerel olarak saklanır.

---

## Sık karşılaşılan sorunlar
- **"AI is not configured" hatası** → `.env` içinde `GEMINI_API_KEY` boş veya yanlış. Doğru yapıştırıp sunucuyu yeniden başlat.
- **Telefonda "Cannot find module ..." (kırmızı ekran)** → `npm install` ile bağımlılıkları kur, sonra `npx expo start -c`.
- **Telefon sunucuya bağlanamıyor** → bilgisayar ve telefon aynı WiFi'de mi? Sunucu (Terminal 1) çalışıyor mu?
- **Fiyatlar gerçekçi değil** → SERPAPI_KEY eklemeden fiyatlar AI tahminidir; gerçek fiyat için SerpAPI anahtarı ekle.

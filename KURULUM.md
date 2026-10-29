# SCOPE — Kurulum & Çalıştırma (Türkçe)

Bu rehber, uygulamayı kendi bilgisayarında ve telefonunda (ya da iOS simülatöründe)
çalıştırman için adım adım anlatır.

---

## 0. Gereksinimler (bir kez)
- **Node.js 20+**
- Telefonda **Expo Go** (App Store / Play Store) _ya da_ Mac'te Xcode + iOS simülatörü
- Telefonla deneyeceksen bilgisayar ve telefon **aynı Wi-Fi'de**

---

## 1. Anahtarlar

| Ne için | Değişken | Zorunlu mu? |
|---|---|---|
| Ürünü fotoğraftan tanımak | `OPENROUTER_API_KEY` **veya** `GEMINI_API_KEY` | Evet (biri) |
| ABD / Avrupa / Türkiye mağaza fiyatları + linkleri | `SERPAPI_KEY` | Hayır — yoksa mağaza arama linkleri gösterilir |
| Kaydedilenleri cihazlar arası eşitlemek | `DATABASE_URL` (PostgreSQL) | Hayır — yoksa kayıtlar telefonda kalır |

- OpenRouter anahtarı: https://openrouter.ai/keys (tek anahtarla birçok model; varsayılan `google/gemini-2.5-flash`)
- Gemini anahtarı (ücretsiz): https://aistudio.google.com/apikey
- SerpAPI: https://serpapi.com — her tarama, aranan her ülke için bir arama harcar
  (`PRICE_COUNTRIES` ile ülke sayısını azaltabilirsin).

```
cp .env.example .env
```
Sonra `.env` içine anahtarlarını yapıştır.

---

## 2. Çalıştır

**Terminal 1 — sunucu (port 4000):**
```
npm install
PORT=4000 npm run server:dev
```
`express server serving on port 4000` yazısını görünce hazır.
(5000 portunu macOS AirPlay kullandığı için uygulama 4000'i bekler.)

**Terminal 2 — uygulama:**
```
npx expo start
```
- Telefonda: QR kodu okut.
- Simülatörde: terminalde `i` tuşuna bas.

---

## 3. Dene
Uygulama doğrudan kamerayla açılır. Bir ürüne doğrult ve deklanşöre bas — ya da sol alttaki
galeri düğmesiyle bir fotoğraf seç (simülatörde kamera olmadığı için bu yolu kullan).

1. Ürün birkaç saniyede tanınır (ad, marka, varyant, eşleşme güveni).
2. Ardından ABD, Avrupa ve Türkiye fiyatları gelir: **Önerilen**, **En ucuz**, **En güvenilir**,
   tipik fiyat aralığı ve pazar pazar mağaza listesi.
3. Yanlış tanındıysa **Doğru değil mi?** ile ürün adını yazıp fiyatları yeniden ara.
4. **Kaydet** ile ürünü ve fiyatlarını Kaydedilenler'de tut, sonra fiyatları yenile.

---

## Sık karşılaşılan sorunlar
- **"Sunucuda yapay zekâ henüz ayarlı değil"** → `.env` içinde `OPENROUTER_API_KEY` ya da
  `GEMINI_API_KEY` yok. Ekle ve sunucuyu yeniden başlat.
- **"Fiyat araması kapalı"** → `SERPAPI_KEY` yok. Ürün yine tanınır; mağaza arama linkleri çalışır.
- **"Sunucuya ulaşılamıyor"** → sunucu çalışıyor mu, port 4000 mü, telefon aynı Wi-Fi'de mi?
- **Kırmızı ekran / "Cannot find module"** → `npm install`, sonra `npx expo start -c`.

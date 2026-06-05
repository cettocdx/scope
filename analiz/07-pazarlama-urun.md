# 07 — Pazarlama / Ürün Analizi

> Kapsam: ürün konumlandırması, hedef kitle, değer önerisi, rakipler, monetizasyon, GTM. Kaynak: `design_guidelines.md`, `replit.md`, ürün işlevi, `server/templates/landing-page.html`.

## Ürün Özeti
SCOPE: **kameranı bir eşyaya tut → AI markayı/modeli tanısın → çok-bölgeli gerçek piyasa fiyatını getirsin → "varlık" olarak portföyüne ekle ve değerini takip et.** "Cyber-tactical HUD" estetiğiyle, fiziksel eşyaları finansal varlık gibi sunan bir tarama + değerleme + portföy uygulaması.

## Konumlandırma
- **Kategori:** AI görsel ürün tanıma + ikinci el/lüks değerleme + varlık portföyü (üçünün kesişimi — net bir rakip kategorisi yok, bu hem fırsat hem risk).
- **Ton:** profesyonel, "tactical/precision", oyunlaştırılmış finansal estetik. Eşyayı "asset", değerlemeyi "valuation", listeyi "vault" olarak çerçeveliyor — duygusal olarak güçlü bir çerçeve (sahip olduğun şeyler = servet).
- **Farklılaştırıcılar:** (1) **ProductDNA** yapılandırılmış kimlik + `mustHaveTokens` ile hassas eşleştirme, (2) çok-modelli ensemble (Gemini+Ximilar+Clarifai), (3) çok-bölgeli fiyat (US/TR/DE) + para birimi normalizasyonu, (4) lüks marka odaklı detaylı tanıma istemi (Prada/Bottega/Hermes vb.), (5) portföy analitiği + AI tavsiyesi.

## Hedef Kitle (varsayımsal segmentler)
1. **Yeniden satıcılar / flipper'lar** (eBay, Vinted, Vestiaire, Dolap, StockX) — bir eşyanın piyasa değerini ve nerede satılacağını hızlı öğrenmek ister. **En güçlü ilk segment.**
2. **Lüks/koleksiyon meraklıları** — sahip olduklarının değerini takip eden, "ne kadar ediyor?" merakı olan kullanıcılar.
3. **Sigortacılık/envanter** — ev eşyası envanteri ve değer kaydı (niş ama yapışkan).
4. **Genel meraklı** — "bu kaç para?" tek seferlik kullanım (düşük tutundurma).

## Değer Önerisi
> "Herhangi bir eşyayı 3 saniyede gerçek piyasa değerine çevir, servetini tek yerde takip et."

Güçlü çünkü: anlık, görsel, sürtünmesiz (login yok), bölgesel fiyat farkını gösteriyor.

## Rekabet Ortamı
| Rakip | Örtüşme | SCOPE'un avantajı/dezavantajı |
|---|---|---|
| Google Lens / Google Shopping | Görsel tanıma + fiyat | Lens daha güçlü tanıma; SCOPE'ta portföy + değerleme + bölgesel kıyas + niş lüks odak avantaj |
| StockX / GOAT | Fiyat endeksi (sneaker/lüks) | Onlar gerçek işlem verisi; SCOPE çok kategorili + tarama UX'i |
| Vestiaire/Vinted/Dolap | İkinci el pazar | Onlar pazar yeri; SCOPE "satmadan önce değerle" üst katman olabilir |
| ValueMyStuff / WorthPoint | Uzman değerleme | Onlar insan/derin; SCOPE anlık + ücretsiz |
| Sortly / Encircle (envanter) | Varlık envanteri | SCOPE AI otomatik değerleme ile öne çıkar |

**Boşluk:** "tara → değerle → portföy" akışını tek üründe, mobil-öncelikli ve estetik olarak birleştiren güçlü bir oyuncu yok. Konumlandırma fırsatı gerçek.

## ⚠️ En Büyük Ürün Riski: Güven
Ürünün tüm değer vaadi **fiyat/değerleme doğruluğuna** dayanıyor. Ancak kod, kullanıcıya **uydurma veri** gösteriyor (bkz. `02-backend.md`, `04-ui-ux.md`):
- SerpAPI fallback'i `Math.random()` ile **sahte fiyat** (`serpapi.ts:326-347`)
- rastgele `qualityScore` (`routes.ts:79`), sabit "99% MATCH", rastgele 12-ay "projeksiyon"
- sabit FX kurları "canlı" gibi sunuluyor

Bir kullanıcı bunu fark ettiği an (örn. aynı eşyayı iki kez tarayıp farklı "kalite" görünce, ya da fiyat gerçekle tutmayınca) ürünün güvenilirliği çöker. **Bu, pazarlamadan önce çözülmesi gereken bir numaralı ürün borcu.** Doğruluk, bu kategoride tek savunulabilir rekabet avantajı.

## Monetizasyon Seçenekleri
- **Freemium:** ayda X ücretsiz tarama, sonrası abonelik (AI maliyetini karşılar — `/api/analyze` çağrı başına 4 ücretli API tüketiyor, bu yüzden kota şart).
- **Pro:** sınırsız tarama, portföy analitiği, fiyat alarmı, satış kanalı önerisi.
- **Affiliate:** "deal" linkleri (Amazon/eBay/Trendyol) üzerinden komisyon — zaten URL üretiliyor (`routes.ts:525-537`), affiliate tag eklemek kısa yol.
- **B2B:** ikinci el satıcılarına/dükkanlara değerleme API'si.

## Go-to-Market Önerileri
1. **Tek segmentle başla:** yeniden satıcılar (en net ödeme isteği + viral içerik potansiyeli "şunu X'e aldım Y ediyor").
2. **Doğruluğu kanıtla:** "gerçek piyasa verisi" iddiasını uydurma veriyi kaldırıp gerçek SerpAPI/işlem verisiyle destekle.
3. **İçerik/UGC:** tarama→değer ekran görüntüleri TikTok/Reels için doğal; "vault flex" paylaşımı (uygulamada zaten share var).
4. **App Store konumlandırması:** "AI resale value scanner" / "asset value tracker" anahtar kelimeleri.
5. **Bölgesel kanca:** TR/EU/US fiyat farkı arbitraj anlatısı (mevcut çok-bölge özelliğini öne çıkar).

## Ürün Boşlukları (özellik)
- Gerçek satış kanalı entegrasyonu (tek tık listele) yok.
- Fiyat geçmişi/alarm yok (history sahte).
- Authentication yok → çok-cihaz/yedekleme güveni yok (bkz. güvenlik).
- Onboarding/ilk kullanım anlatımı yok.

## Pazarlama/Ürün Olgunluğu Skoru: **55/100**
Vizyon, konumlandırma ve farklılaştırma fikirleri **güçlü ve ticari olarak değerli**; estetik pazarlanabilir. Ancak ürünün çekirdek vaadi (doğru değerleme) şu an sahte veriyle sabote ediliyor ve monetizasyon/segment odağı henüz ürüne yansımamış. Önce güven, sonra büyüme.

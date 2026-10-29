import { getLocales } from "expo-localization";

/**
 * Tiny two-language string table (English + Turkish), picked from the device
 * locale. Keys read like the English copy so screens stay legible.
 */

const tr = {
  "Point at a product": "Bir ürüne doğrult",
  "Tap to scan · or pick a photo": "Taramak için dokun · ya da fotoğraf seç",
  "Barcode found": "Barkod bulundu",
  "Camera access is off": "Kamera erişimi kapalı",
  "SCOPE needs the camera to see what you're pointing at.":
    "SCOPE neye doğrulttuğunu görmek için kameraya ihtiyaç duyar.",
  "Allow camera": "Kameraya izin ver",
  "Open Settings": "Ayarları aç",
  "Pick a photo instead": "Bunun yerine fotoğraf seç",
  "Couldn't take the photo": "Fotoğraf çekilemedi",
  "Identifying…": "Tanımlanıyor…",
  "Finding prices in the US, Europe and Türkiye…":
    "ABD, Avrupa ve Türkiye'de fiyatlar aranıyor…",
  "Exact match": "Kesin eşleşme",
  "Likely match": "Büyük olasılıkla",
  "Best guess": "Tahmin",
  "Not right?": "Doğru değil mi?",
  "Could also be": "Şu da olabilir",
  "What is it?": "Bu ne?",
  "Type the product name, e.g. iPhone 15 Pro 256GB":
    "Ürün adını yaz, ör. iPhone 15 Pro 256GB",
  "Search prices": "Fiyatları ara",
  Cancel: "Vazgeç",
  Recommended: "Önerilen",
  "Best balance of price and trust": "Fiyat ve güven dengesi en iyi",
  Cheapest: "En ucuz",
  "Most trusted": "En güvenilir",
  "Typical new price": "Tipik yeni fiyatı",
  "from {n} stores": "{n} mağazadan",
  "Where it's sold": "Nerede satılıyor",
  US: "ABD",
  EU: "Avrupa",
  TR: "Türkiye",
  "No offers found here": "Burada teklif bulunamadı",
  "Search on Google Shopping": "Google Alışveriş'te ara",
  "Official store": "Resmi mağaza",
  "Major retailer": "Büyük mağaza",
  Marketplace: "Pazar yeri",
  "Small shop": "Küçük mağaza",
  "Suspiciously cheap": "Şüpheli derecede ucuz",
  "Far below the usual price — could be fake, used or a different item.":
    "Normal fiyatın çok altında — sahte, kullanılmış ya da farklı bir ürün olabilir.",
  "Price check is off": "Fiyat araması kapalı",
  "Add a SerpAPI key on the server to see live store prices. Search links still work.":
    "Canlı mağaza fiyatları için sunucuya SerpAPI anahtarı ekle. Arama linkleri yine çalışır.",
  "No live prices found": "Canlı fiyat bulunamadı",
  "Try a more specific name, or search the stores directly.":
    "Daha net bir ad dene ya da doğrudan mağazalarda ara.",
  "Age-restricted product": "Yaş sınırlı ürün",
  "Purchase links are hidden for age-restricted items.":
    "Yaş sınırlı ürünlerde satın alma linkleri gösterilmez.",
  "Live prices from Google Shopping": "Canlı fiyatlar Google Alışveriş'ten",
  "Prices may change. Check the store before buying.":
    "Fiyatlar değişebilir. Almadan önce mağazada kontrol et.",
  Save: "Kaydet",
  Saved: "Kaydedildi",
  Share: "Paylaş",
  "Scan again": "Yeniden tara",
  "Try again": "Tekrar dene",
  "Couldn't identify this": "Bu tanımlanamadı",
  "Couldn't load prices": "Fiyatlar yüklenemedi",
  "Saved items": "Kaydedilenler",
  "Nothing saved yet": "Henüz kayıt yok",
  "Scan something and tap Save to keep its prices here.":
    "Bir şey tara ve fiyatlarını burada tutmak için Kaydet'e dokun.",
  "Best price": "En iyi fiyat",
  "Refresh prices": "Fiyatları yenile",
  Remove: "Kaldır",
  "Remove this item?": "Bu ürün kaldırılsın mı?",
  Settings: "Ayarlar",
  "Show prices in": "Fiyatları göster",
  "Scans left today": "Bugün kalan tarama",
  Unlimited: "Sınırsız",
  "SCOPE Pro": "SCOPE Pro",
  "Unlimited scans, every day.": "Her gün sınırsız tarama.",
  "Get Pro": "Pro'ya geç",
  "You're on Pro": "Pro kullanıyorsun",
  "Restore purchases": "Satın alımları geri yükle",
  Account: "Hesap",
  "Sign in": "Giriş yap",
  "Sign out": "Çıkış yap",
  "Sync saved items across devices.":
    "Kaydedilenleri cihazlar arasında eşitle.",
  About: "Hakkında",
  "Prices are for guidance only.": "Fiyatlar yalnızca bilgi amaçlıdır.",
  "Daily limit reached": "Günlük sınıra ulaşıldı",
  "You've used today's {n} free scans. Pro has no limit.":
    "Bugünkü {n} ücretsiz taramanı kullandın. Pro'da sınır yok.",
  "Maybe later": "Belki sonra",
  "{n} stores": "{n} mağaza",
  "{n} offers": "{n} teklif",
  "in {country}": "{country}",
  "Free delivery": "Ücretsiz kargo",
  "Server can't be reached": "Sunucuya ulaşılamıyor",
  "AI isn't set up on the server yet.":
    "Sunucuda yapay zekâ henüz ayarlı değil.",
  Close: "Kapat",
  "Knows what anything is.": "Her şeyi tanır.",
  "Point at any product — brand, model and variant in seconds.":
    "Bir ürüne doğrult — markasını, modelini ve varyantını saniyeler içinde söyler.",
  "Finds the cheapest and the safest.": "En ucuzu ve en güvenilirini bulur.",
  "Searches shops in the US, Europe and Türkiye at once and scores every seller.":
    "ABD, Avrupa ve Türkiye'deki mağazaları aynı anda tarar, her satıcıya güven puanı verir.",
  "The exact item, one tap away.": "Tam olarak aynısı, tek dokunuşla.",
  "Finds the same item in shops and opens the seller's own page.":
    "Fotoğraftaki ürünün aynısını mağazalarda bulur, satıcının kendi sayfasını açar.",
  "Opens the seller's page": "Satıcının sayfasını açar",
  Skip: "Atla",
  Continue: "Devam",
  "Start scanning": "Taramaya başla",
  "Your photos are only used to find the product. We don't keep them.":
    "Fotoğrafların yalnızca ürünü bulmak için kullanılır. Saklamıyoruz.",
  "Show the intro again": "Tanıtımı yeniden göster",
  "Same item in shops": "Mağazalarda aynısı",
  "Matched by photo — check the model before buying.":
    "Fotoğrafla eşleşti — almadan önce modeli kontrol et.",
  "Also in this photo": "Fotoğrafta ayrıca",
  "Not something you buy in a shop": "Mağazada satılan bir ürün değil",
  "Tap something else in the photo, or type what you're looking for.":
    "Fotoğraftaki başka bir şeye dokun ya da aradığını yaz.",
  "Brand not visible": "Marka görünmüyor",
  "Best price you can trust in the US": "ABD'de güvenilir en iyi fiyat",
  "Best price you can trust in Europe": "Avrupa'da güvenilir en iyi fiyat",
  "Best price you can trust in Türkiye": "Türkiye'de güvenilir en iyi fiyat",
  Buy: "Satın al",
  "Search the stores": "Mağazalarda ara",
  "Free includes {n} scans a day.": "Ücretsiz sürümde günde {n} tarama var.",
  "Unlimited scans": "Sınırsız tarama",
  "Scan as many products as you like, every day.":
    "Her gün istediğin kadar ürün tara.",
  "Every market, every scan": "Her taramada tüm pazarlar",
  "US, Europe and Türkiye prices side by side.":
    "ABD, Avrupa ve Türkiye fiyatları yan yana.",
  "Supports live price search": "Canlı fiyat aramasını destekler",
  "Each scan runs paid AI and shopping searches.":
    "Her tarama ücretli yapay zekâ ve alışveriş araması çalıştırır.",
  "Subscriptions aren't available in this build.":
    "Bu sürümde abonelik kullanılamıyor.",
  "Subscription products aren't set up yet.":
    "Abonelik ürünleri henüz ayarlanmadı.",
  "Purchase failed": "Satın alma başarısız",
  "Please try again.": "Lütfen tekrar dene.",
  "Welcome to Pro": "Pro'ya hoş geldin",
  "Nothing to restore": "Geri yüklenecek bir şey yok",
  Restored: "Geri yüklendi",
  "Your saved items, on every device.": "Kaydettiklerin her cihazında.",
  "Continue with Google": "Google ile devam et",
  "Sign-in failed": "Giriş başarısız",
  "Signed in as {name}": "{name} olarak giriş yapıldı",
  "Sign-in needs a development build.": "Giriş için geliştirme sürümü gerekir.",
  "Version {v}": "Sürüm {v}",
} as const;

export type StringKey = keyof typeof tr;

function deviceLanguage(): string {
  try {
    return getLocales()[0]?.languageCode?.toLowerCase() ?? "en";
  } catch {
    return "en";
  }
}

export const LANG: "tr" | "en" = deviceLanguage() === "tr" ? "tr" : "en";
export const LOCALE = LANG === "tr" ? "tr-TR" : "en-US";

export function t(
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  let s: string = LANG === "tr" ? tr[key] : key;
  if (vars)
    for (const [k, v] of Object.entries(vars))
      s = s.replace(`{${k}}`, String(v));
  return s;
}

const COUNTRY_NAMES: Record<string, { en: string; tr: string; flag: string }> =
  {
    US: { en: "United States", tr: "ABD", flag: "🇺🇸" },
    DE: { en: "Germany", tr: "Almanya", flag: "🇩🇪" },
    FR: { en: "France", tr: "Fransa", flag: "🇫🇷" },
    IT: { en: "Italy", tr: "İtalya", flag: "🇮🇹" },
    ES: { en: "Spain", tr: "İspanya", flag: "🇪🇸" },
    NL: { en: "Netherlands", tr: "Hollanda", flag: "🇳🇱" },
    UK: { en: "United Kingdom", tr: "Birleşik Krallık", flag: "🇬🇧" },
    TR: { en: "Türkiye", tr: "Türkiye", flag: "🇹🇷" },
  };

export function countryName(code: string): string {
  const c = COUNTRY_NAMES[code];
  return c ? c[LANG] : code;
}

export function countryFlag(code: string): string {
  return COUNTRY_NAMES[code]?.flag ?? "🌐";
}

const CATEGORY_TR: Record<string, string> = {
  Electronics: "Elektronik",
  Fashion: "Moda",
  Footwear: "Ayakkabı",
  Bags: "Çanta",
  Watch: "Saat",
  Jewelry: "Takı",
  Beauty: "Kozmetik",
  Home: "Ev",
  Appliance: "Ev aleti",
  Tool: "Alet",
  Toy: "Oyuncak",
  Sports: "Spor",
  Collectible: "Koleksiyon",
  Vehicle: "Araç",
  Other: "Diğer",
};

export function categoryName(category: string): string {
  return LANG === "tr" ? (CATEGORY_TR[category] ?? category) : category;
}

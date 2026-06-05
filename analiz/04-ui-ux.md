# 04 — UI/UX Tasarım Analizi

> Kapsam: `design_guidelines.md`, `client/constants/theme.ts`, 9 component, 2 hook, 9 ekran.

## Mevcut Durum
Görsel dil **güçlü ve tutarlı bir izlenim** bırakıyor: koyu "cyber-tactical HUD" estetiği, monospace tipografi, neon yeşil (`#00FF94`) vurgu disiplinli uygulanmış. Ancak bu tutarlılık tasarım token'larından değil, **kopyala-yapıştır**tan geliyor. Altyapı olgunluğu düşük.

## Bulgular

### Kritik / Yüksek
- **U-K1 — Tema soyutlaması var ama 9 ekranın 9'u da kullanmıyor** `useTheme()` hiç çağrılmıyor; doğrudan `Colors.dark.*` sabitleniyor (`HomeScreen.tsx:16,107`, `VaultScreen.tsx:14`, `ResultScreen.tsx:20` …). `Typography` token'ları `fontSize: Typography.h1.fontSize` biçiminde elle parçalanıyor. `ThemedText`/`Button`/`Card` pratikte **ölü kod**. **Öneri:** Ya tümünü `useTheme()`+`ThemedText`'e taşı, ya soyutlamayı sil — ikisini birlikte tutmak en kötüsü.
- **U-Y1 — `Button` ve `Card` hiçbir ekranda kullanılmıyor** Her ekran kendi butonunu yazıyor → buton yükseklikleri **56/64/70/72px** arası savruluyor; kılavuzdaki "Primary 56-64px" (`design_guidelines.md:91`) ihlal.
- **U-Y2 — Light mode "tiyatro"** `theme.ts:4-45` `Colors.light` ve `Colors.dark` **byte-byte aynı**. `useTheme`/`isDark`/`lightColor`/`darkColor` propları sahte karmaşıklık; uygulama tek temalı (kalıcı koyu). **Öneri:** kararı netleştir — ya light'ı farklılaştır ya tek nesneye indir.
- **U-Y3 — Tema dışı hardcoded renkler** Mavi `#60A5FA`, mor `#C084FC`/`#A855F7`, cyan `#00FFFF` (`HomeScreen.tsx:151,155`, `ResultScreen.tsx:319-321`, `FinancialChart.tsx:67`). İki farklı kırmızı (`#EF4444` vs tema `#FF3B30`). Pill renkleri tutarlı anlam taşımıyor.
- **U-Y4 — JetBrains Mono fiilen yok** Kılavuz tipografiyi JetBrains Mono'ya kuruyor (`design_guidelines.md:75`) ama `theme.ts:131-150` native'de **sistem monospace** kullanıyor; `expo-font` ile hiç yüklenmiyor. Marka kararı native'de gerçekleşmiyor.
- **U-Y5 — Dokunma hedefi ihlalleri (<40px)** "Why?" (`ResultScreen.tsx:286`), "SHARE REPORT" (`:364`), "Retake" (`ReviewScreen.tsx:86`), CANCEL (`ScannerScreen.tsx:132`) ~30px. Kılavuz min 40px (`design_guidelines.md:129`).
- **U-Y6 — Ekran okuyucu desteği tamamen yok** Hiç `accessibilityLabel/Role/Hint` yok; ikon-only butonlar anlamsız.
- **U-Y7 — Vault loading state yok** `VaultScreen.tsx:181-196`: boş `[]` ile başlayıp anında "VAULT IS EMPTY" gösteriyor, veri gelince flash. `AnalyticsScreen` de aynı.
- **U-Y8 — Hata akışı agresif** `AnalyzingScreen.tsx:47-59`: hata → `Alert` + zorla `replace("Scanner")`. Kullanıcı fotoğrafı kaybeder, retry yok.

### Orta
- **U-O1 — `#FFF`/`#000`/`rgba(...)` literalleri her yerde** `theme.text`/`buttonText` varken yüzlerce elle renk; `rgba(0,255,148,...)` opaklık varyantları onlarca kez (token'laştırılmalı).
- **U-O2 — Magic-number spacing** `paddingTop: 60`, `bottom: 120/40`, `paddingBottom: 100` (`ScannerOverlay.tsx:121`, `VaultScreen.tsx:187`…). Scanner HUD safe-area inset yerine sabit sayı → çentikli cihazlarda kayma.
- **U-O3 — `ratingReason` AI verisi kullanılmıyor** `ResultScreen.tsx:418-467` "Why?" sheet'i gerçek `ratingReason` (`:77`) yerine **sabit kodlu** açıklama listesi gösteriyor → "AI açıklaması" sahte.
- **U-O4 — Trend-pill mantığı 4 yerde kopya** `VaultScreen.tsx:100-125`, `ResultScreen.tsx:218-243`, `AssetDetailScreen.tsx:141-150`. `<TrendPill/>`/`<RatingBadge/>` çıkarılmalı.
- **U-O5 — `FinancialChart` genişlik uyumsuzluğu** `width="100%"` ama path `SCREEN_WIDTH-48` sabitiyle çiziliyor (`:27,44`) → farklı container'larda taşma.
- **U-O6 — İkon kütüphanesi kılavuzu ihlal** Kılavuz "Lucide React Native only" (`:134`); kod tamamen `@expo/vector-icons` Feather.
- **U-O7 — Sahte/placeholder veriler** "99% MATCH" sabit, Scanner HUD sabit GPS (San Francisco) + sahte ISO döngüsü (`ScannerOverlay.tsx:50,57`), AssetDetail sabit "Excellent (AI)"/"High", random `history`. Klasik "AI slop" — tactical-precision marka vaadini zayıflatıyor.
- **U-O8 — Düşük kontrast** `textTertiary`/`textDim` (beyaz %40/%20) küçük metinlerde WCAG AA'yı geçemez; kılavuzun "21:1" iddiasıyla çelişir.

### Düşük
- Başlık tipografisi ekrandan ekrana 12-32pt savruluyor; Hero `52/800/+12` vs kılavuz `64/900/-2`; empty-state ikonu `briefcase`/`lock` (kılavuz: wallet); kullanılmayan import'lar (`width`, `Platform`), glow orb'lar kılavuzun "no decoration" felsefesiyle çelişiyor.

## Özet Tablo
| Kategori | Durum |
|---|---|
| Token altyapısı | İyi tasarlanmış, **kullanılmıyor** |
| Token benimseme | Zayıf (~%90 hardcoded) |
| Component yeniden kullanımı | Çok zayıf (Button/Card/ThemedText ölü) |
| Light/Dark | Sahte ikilik |
| Loading/Empty/Error | Eksik veya agresif |
| Erişilebilirlik | Kritik boşluk |
| Kılavuz uyumu | Orta-düşük |
| AI slop | Belirgin |

## En Kritik 3 Aksiyon
1. Token'ları gerçekten benimset veya ölü soyutlama katmanını sil (tek gerçek kaynak).
2. a11y temeli: label'lar + 44px touch target.
3. Sahte verileri (99% MATCH, GPS, random history, sabit "Why?") gerçek AI verisiyle değiştir veya kaldır.

## Tasarım Olgunluğu Skoru: **54/100**
- Görsel tutarlılık & estetik: 16/20 · Tasarım sistemi disiplini: 7/20 · Component mimarisi: 5/15 · UX akışı & durum: 9/15 · Erişilebilirlik: 4/15 · Kılavuz-kod uyumu: 8/15

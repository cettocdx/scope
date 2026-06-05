# 03 — Frontend / Mobil Analizi

> Kapsam: `client/` — Expo RN (React 19, RN 0.81), React Navigation, TanStack React Query, AsyncStorage, expo-camera.

## Mevcut Durum
Görsel ve UX olarak olgun, mimari iskeleti doğru bir uygulama: tip-güvenli native-stack navigasyon, `ErrorBoundary`, SafeArea/Gesture/Keyboard provider'ları. Akış: Home → Scanner → Review → (Quick: Analyzing | Refine: Confirm → Analyzing) → Result. Ancak veri katmanı ve performans tarafında belirgin mühendislik borcu var.

## Bulgular

### Kritik
- **F-K1 — Base64 görsel her yerde taşınıyor** `types/index.ts:85`, `portfolioService.ts:72`, `RootStackNavigator.tsx:27`. Tam base64 JPEG hem navigation params'ta, hem AsyncStorage'da, hem cloud POST body'sinde. Android AsyncStorage'ın ~2MB satır limiti var; birkaç yüksek çözünürlüklü görselle portfolio JSON şişer, `JSON.parse` ana thread'i bloke eder. **Öneri:** `expo-file-system` ile uri tut, thumbnail üret.

### Yüksek
- **F-Y1 — React Query kurulu ama hiç kullanılmıyor** `useQuery`/`useMutation`/`invalidateQueries` projede **sıfır**. Tüm veri akışı elle `fetch` + `useState`. **Öneri:** portfolio okuma `useQuery`, yazma `useMutation` + `invalidateQueries(["portfolio"])`.
- **F-Y2 — Cache invalidation manuel & hataya açık** `HomeScreen.tsx:79`, `VaultScreen.tsx:41`, `AnalyticsScreen.tsx:140` üçü de ayrı `navigation.addListener("focus")` ile yeniden yüklüyor. Merkezi invalidation yok; tek doğruluk kaynağı yok.
- **F-Y3 — `getApiUrl()` sert hata + http imkânsız** `query-client.ts:7-17`: `EXPO_PUBLIC_DOMAIN` yoksa `throw`; her zaman `https://` zorlanıyor → lokal `http` geliştirme yok.
- **F-Y4 — Timeout/AbortController yok** `geminiService.analyzeImage` (50MB base64 POST) zaman aşımsız. AI asılırsa `AnalyzingScreen` sonsuz spinner, kullanıcı geri gidemez.
- **F-Y5 — VaultScreen FlatList base64 render ediyor** `VaultScreen.tsx:88` `Image source={{uri: base64}}`. base64 cache'lenemez, her render decode. `getItemLayout`/`windowSize`/`removeClippedSubviews` yok, `renderAssetCard` memoize değil → kaydırma jank'ı.
- **F-Y6 — Yaygın `any`** `portfolioService.ts:111`, `ResultScreen.tsx:323,332`, `Card.tsx:33`, `Feather name={... as any}`. API yanıtları için runtime doğrulama yok.

### Orta
- **F-O1 — Sync "fire-and-forget" + silme senkronizasyonu yok** `portfolioService.ts:40,48` `.catch(console.error)`; offline'da cloud asla güncellenmez, retry kuyruğu yok. `syncPortfolio:125-137` cloud'u local üstüne yazıyor; local'de silinen cloud'da kalan asset geri geliyor.
- **F-O2 — Storage key iki yerde tekrar** `HomeScreen.tsx:20` ve `portfolioService.ts:5` (`scope_portfolio_v1`); Home servisi delip doğrudan AsyncStorage okuyor.
- **F-O3 — `CATEGORY_VARIANTS` key uyumsuzluğu** `ConfirmScreen.tsx:33-59` `"Watches"`/`"Footwear"` vs `types/index.ts:4` `'Watch'`/`'Footwear'` → `category="Watch"` sessizce `"Fashion"` fallback'ine düşer, yanlış varyantlar.
- **F-O4 — Animasyon loop cleanup yok** `HomeScreen.tsx:32-62` iki sonsuz `Animated.loop` durdurulmuyor; `ScannerOverlay.tsx:18-24` 800ms `setInterval`; `ScannerScreen.tsx:51-59` accelerometer ~10 render/sn.
- **F-O5 — İzin kalıcı reddinde çıkış yok** `ScannerScreen.tsx:101-117`; `canAskAgain=false` olunca sonsuza dek "Grant Permission". **Öneri:** `Linking.openSettings()` fallback.
- **F-O6 — `useEffect` bağımlılık eksik** `AnalyzingScreen.tsx:65` (`refinements` yok); cleanup in-flight fetch'i iptal etmiyor → çift istek riski.
- **F-O7 — Kod tekrarı** rating-renk-ikon mantığı 3 ekranda, `historyData` aggregation 2 ekranda (`VaultScreen.tsx:51-72`, `AnalyticsScreen.tsx:145-161`) kopya.

### Düşük
- **F-D1 — Sahte/sabit veriler:** "99% MATCH" sabit (`ResultScreen.tsx:200`), "Excellent (AI)"/"High volatility" sabit (`AssetDetailScreen.tsx:197,207`), `history` `Math.random()` ile üretilip "12 ay projeksiyon" diye sunuluyor (`ResultScreen.tsx:98-100`).
- **F-D2 — Ölü kod:** `AppState` enum (`types/index.ts:100-110`), `Button`/`Card`/`ThemedText/View`/`HeaderTitle`/`Spacer`/`useScreenOptions` hiçbir ekranda kullanılmıyor; bottom-tabs bağımlılığı atıl.
- **F-D3 — `Linking.openURL(deal.url)` doğrulanmıyor** `ResultScreen.tsx:118` (`canOpenURL` guard yok).
- **F-D4 — `FinancialChart` tek veri noktasında NaN riski** `FinancialChart.tsx:38`.

### Erişilebilirlik (a11y)
- **F-A1 — `accessibilityLabel/Role/Hint` kullanımı SIFIR** (grep doğrulandı). İkon-only butonlar (capture, kapat, geri, paylaş, FAB) ekran okuyucu ile kullanılamaz. → `04-ui-ux.md` 7. bölüm.

## Sağlık Skoru: **58/100**
UI/UX olgunluğu ve doğru navigasyon iskeleti pozitif; veri katmanı mimarisi (kullanılmayan React Query, fire-and-forget sync), performans/ölçeklenme (base64), eksik a11y ve ölü kod yükü skoru düşürüyor. **Hızlı kazanımlar:** servis soyutlamasını her yerde kullan, `CATEGORY_VARIANTS` key'ini düzelt, loop cleanup, ikon butonlara a11y label.

# 06 — Developer Experience / DevOps Analizi

> Kapsam: `package.json`, `tsconfig.json`, `babel.config.js`, `eslint.config.js`, `.replit`, `app.json`, `drizzle.config.ts`, `scripts/build.js`, `.gitignore`, `replit.md`, `attached_assets/`.

## Mevcut Durum
Çekirdek altyapı (TS `strict`, ESLint flat config, Prettier, modern Expo 54/React 19 stack) profesyonel kurulmuş — güçlü temel. Ancak proje "tek geliştirici + Replit" zihniyetinden çıkmamış: test/CI/README/`.env.example` yok, Replit env'lerine sert bağımlılık var, repo prototip artıklarıyla kirli.

## Bulgular

### Kritik
- **X-K1 — Sıfır test, sıfır test altyapısı** `package.json`'da `test` script yok, hiç `*.test.*`/`*.spec.*` yok, jest/vitest yok. Para mantığı (IQR outlier, FX, valuation, DNA parse) tamamen test edilmemiş. `tsconfig.json:13` `**/*.test.ts` exclude ediyor (niyet var, uygulama yok). **Öneri:** server saf fonksiyonları için Vitest/Jest unit testleri, `test` script + CI.
- **X-K2 — `attached_assets/` + 63KB zip commit edilmiş** 23 tracked dosya (toplam ~%28). `scope---asset-vision_*.zip` (binary), timestamp-suffix'li eski kaynaklar, **çelişkili stack** (`package_*.json`: React 18.2/RN 0.74/Vite vs ana proje React 19/RN 0.81/Expo), 0-byte Python placeholder'ları, yapıştırılmış AI prompt'ları. Grep/IDE'yi kirletir, yeni geliştiriciyi yanıltır. **Öneri:** `git rm -r attached_assets/` + `.gitignore`.

### Yüksek
- **X-Y1 — README.md yok, üstelik `.replit` onu entrypoint gösteriyor** `.replit:1` `entrypoint = "README.md"` ama kökte yok (sadece `replit.md`). GitHub'da repo boş giriş gösterir. **Öneri:** gerçek `README.md` (kurulum/env/çalıştırma), `.replit` entrypoint düzelt.
- **X-Y2 — Replit'e sert bağımlılık** `package.json:6,9` `$REPLIT_DEV_DOMAIN`/`$REPLIT_INTERNAL_APP_DOMAIN`; `scripts/build.js:44-47` bu env yoksa `process.exit(1)`; CORS yalnızca Replit domainlerini tanır (`index.ts:20-28`). Lokal/CI/başka cloud'da çalışmaz. **Öneri:** domain çözümüne fallback (`REPLIT_DEV_DOMAIN || LOCAL_DOMAIN || "localhost:8081"`), dev CORS'a localhost.
- **X-Y3 — CI tamamen yok** `.github/` yok. `check:types`/`lint`/`check:format` tanımlı ama otomasyon yok. **Öneri:** `.github/workflows/ci.yml` — `npm ci && check:types && lint && check:format`.
- **X-Y4 — `.env.example` yok** 5 zorunlu secret (`replit.md:109-114`) var ama listeleyen örnek dosya yok; yeni geliştirici kaynak okuyarak keşfeder. **Öneri:** placeholder `.env.example`.

### Orta
- **X-O1 — `all:dev` naif `&` paralelizmi** `package.json:8`; biri çökerse diğeri zombi, `Ctrl+C` temiz öldürmez, exit kodu propagate olmaz. **Öneri:** `concurrently`/`npm-run-all -p --kill-others-on-fail`.
- **X-O2 — `types: ["node"]` tek tsconfig'i daraltıyor** `tsconfig.json:10`; hem server hem RN client paylaşıyor, `["node"]` Expo/RN ambient tiplerini kısabilir. **Öneri:** client/server için ayrı tsconfig (project references).

### Düşük / Pozitif
- **X-D1 — Sürüm uyumsuzluğu** `package.json:4` `1.0.0` vs `app.json:6` `1.0.4`.
- **X-D2 — Kullanılmayan paketler** `@octokit/rest`, muhtemelen `ws`. `depcheck` ile doğrula.
- **X-D3 — Dokümantasyon Replit'e özgü/eskimiş** `replit.md:57` "Dec 2024" changelog; "Running" bölümü zayıf.
- **✅ Pozitif:** TS `strict` açık + path alias'lar TS & Babel'de tutarlı; ESLint flat config + Prettier olgun; build script mimarisi (signal handler, timeout, retry) sağlam; modern bağımlılık sürümleri.

## DX Olgunluk Tablosu
| Alan | Durum |
|---|---|
| Onboarding | Zayıf (README/env yok, Replit'e kilitli) |
| Script kalitesi | Orta (`&` kırılgan) |
| Tip/Lint/Format | İyi |
| CI | Yok |
| Test | Yok (kritik) |
| Bağımlılık hijyeni | İyi-orta |
| Dokümantasyon/.env | Zayıf |
| Repo temizliği | Kötü (attached_assets+zip) |
| TS yapılandırması | İyi |

## En Yüksek Öncelikli 5 Aksiyon
1. `attached_assets/` + zip kaldır, `.gitignore`'a ekle (Kritik)
2. Server saf mantığı için unit test + `test` script + CI (Kritik)
3. `.github/workflows/ci.yml` type/lint/format gate (Yüksek)
4. Gerçek `README.md` + `.env.example`, `.replit` entrypoint düzelt (Yüksek)
5. Replit env'lerine lokal fallback (domain + CORS) (Yüksek)

## DX Olgunluk Skoru: **42/100**
Güçlü çekirdek altyapı üzerine, takım/üretim olgunluğunun (test, CI, doküman, taşınabilirlik, repo temizliği) eksikliği biniyor.

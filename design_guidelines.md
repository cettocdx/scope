# SCOPE — Design guidelines

SCOPE answers two questions for a product in front of you: **what exactly is it** and **where
should I buy it**. The interface exists to get out of the way of those two answers.

## Principles
1. **Camera first.** The app opens on the viewfinder. Everything else is one tap away
   (Settings top-left, Saved top-right, photo library bottom-left).
2. **Identity before prices.** The product name appears the moment it is known; prices fill in
   underneath with skeletons, never a full-screen spinner.
3. **One clear answer, then the detail.** Recommended buy first, then Cheapest and Most trusted,
   then the typical price, then every store per market.
4. **Cheap and safe are different colours.** Lime is the action and the recommended buy; trust has
   its own green / amber / red scale. A price is never shown as "good" just because it is low.
5. **Honest numbers only.** No invented trends, projections or ratings. No live price → say so and
   link to the store search.

## Tokens (`client/constants/theme.ts`)
- **Surfaces:** `bg #0A0A0B`, `surface #141416`, `surfaceRaised #1C1C1F`, hairline `line`.
- **Text:** off-white `#F5F5F2` at 100 / 64 / 40 % opacity.
- **Accent:** lime `#D7FF3A` — primary buttons, the Recommended card, the range marker.
- **Trust:** high `#8BE3A0`, medium `#F4C55A`, low / suspicious `#FF7A66`.
- **Type:** Inter. `display 30`, `title 22`, `headline 17`, `body 15`, `callout 13`, `caption 11`,
  `overline 11 caps`. Prices use tabular figures (`priceHero 36`, `price 17`, `priceSmall 13`).
- **Radius:** 12 (controls), 16 (buttons), 22 (cards), 28 (hero card). **Gutter:** 20.

## Screens
| Screen | Purpose |
|---|---|
| **Scan** | Full-bleed camera, scan-frame corners, shutter, library, torch, barcode chip. |
| **Result** | Photo header → identity (confidence chip, "Not right?") → Recommended card → Cheapest / Most trusted tiles → typical price → markets (US · Europe · Türkiye) with store rows. |
| **Saved** | Scans kept with their best price; open to see the full result and refresh prices. |
| **Settings** | Display currency, scans left today, Pro, account, about. |
| **Paywall / Auth** | Modal sheets in the same language. Only promise features that exist. |

## Copy
- English and Turkish (`client/lib/i18n.ts`), picked from the device language.
- Short, plain words: "Buy", "Cheapest", "Most trusted", "Not right?".
- Prices: the user's currency first; the store's own price underneath when it differs.

## Icon
`branding/icon.svg` — the scan frame from the camera screen locked on a lime point, on the app
background. Exported to `assets/images/*` (icon has no alpha channel for the App Store).

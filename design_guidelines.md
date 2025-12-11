# SCOPE Mobile App - Design Guidelines (Compacted)

## App Overview
AI-powered asset scanning utility with cyber-tactical HUD aesthetic for product identification, market valuation, and portfolio tracking. Local-first, no authentication required.

## Architecture

### Navigation: State-Based (Stack-Only)
States: `HOME` → `SCANNING` → `REVIEW` → `ANALYZING` → `RESULT` → `ASSET_DETAIL`
- No tabs/drawers, all full-screen or modal transitions
- Settings accessible from Dashboard (preferences, data management, app info)

### Screen Specifications

#### 1. Dashboard (HOME)
- **Layout:** Full-screen black, noise overlay (0.03 opacity)
- **Top-left:** Green dot + "SYSTEM_READY", version text
- **Center:** "SCOPE" (64pt), green divider (40×1px), tagline, 3 capability pills
- **Bottom:** "INITIALIZE SCANNER" (white bg, black text), "ACCESS VAULT" (glass, badge)
- **Insets:** Top: `insets.top + 20px`, Bottom: `insets.bottom + 20px`

#### 2. Portfolio Vault
- **Header (fixed):** Back button, net worth (monospace), mini chart (80px), border-bottom
- **List:** Asset cards (image, name, category, price, trend) or empty state (dashed border, wallet icon)
- **FAB:** 64px white circle, scan icon, bottom-center, shadow with glow
- **Insets:** Custom header, Bottom: `20px + FAB + 20px`

#### 3. Scanner (SCANNING)
- **Background:** Full CameraView, StatusBar hidden
- **HUD (non-interactive):** Status (top-left), network/GPS (top-right), animated reticle (center), stability bar/timestamp (bottom)
- **Controls:** Cancel (bottom-left), Capture (80px circle, bottom-center)
- **Feedback:** Reticle color (white→yellow→green), size changes, lock icon, haptics on state change
- **Insets:** Bottom controls account for device inset

#### 4. Review (REVIEW)
- **Layout:** Full-screen image (contain, black bg)
- **Bottom:** Glass overlay (80% opacity), RETAKE (secondary) + ANALYZE (green primary) buttons
- **Insets:** Bottom: `insets.bottom + 12px`

#### 5. Analyzing (ANALYZING)
- **Center:** Green spinner, animated status text (updates 700ms)
- **Messages:** "EXTRACTING DATA..." → "MAPPING GEOMETRY..." → "CHECKING ID..." → "VERIFYING MARKET..." → "CALCULATING VALUE..."

#### 6. Result Modal (RESULT)
- **Modal:** 85% height, drag handle, rounded top corners
- **Header:** Category tag, verified badge, product name (2 lines), close button
- **Content:** Large price (42pt), trend badge, ADD TO VAULT + CREATE AD buttons, GLOBAL MARKETS section, deal cards (3-5), share button
- **Insets:** Handles internally

#### 7. Asset Detail (ASSET_DETAIL)
- **Hero:** 400px image, gradient overlay, floating header (back/options), tags/title on image
- **Scrollable:** Rounded card overlaps hero, stats grid (2 col), AI rating, 12-mo chart (200px), specs
- **Footer (fixed):** HOLD (gray, inactive) + LIQUIDATE (red) buttons
- **Insets:** Floating header, Bottom: `insets.bottom + 12px`

---

## Design System

### Colors
| Purpose | Value | Usage |
|---------|-------|-------|
| **Cyber Black** | `#000000` | Main background |
| **Success Green** | `#00FF94` | Primary accent, success |
| **Alert Red** | `#FF3B30` | Warnings, sell |
| **Glass Surface** | `rgba(20,20,20,0.6)` | Cards, overlays |
| **Glass Border** | `rgba(255,255,255,0.08)` | Subtle borders |
| **Dark Card** | `#0A0A0A` / `#111` | Content backgrounds |
| **Dark Border** | `#222` / `#333` | Card borders |
| **Text Primary** | `#FFFFFF` | Main text |
| **Text Secondary** | `rgba(255,255,255,0.6)` | Subtext |
| **Text Tertiary** | `rgba(255,255,255,0.4)` | Labels |
| **Text Dim** | `rgba(255,255,255,0.2)` | Disabled |

### Typography (JetBrains Mono)
| Type | Size | Weight | Specs |
|------|------|--------|-------|
| Hero Title | 64pt | 900 | Letter-spacing: -2 |
| Screen Title | 32pt | Bold | - |
| Section Title | 24pt | Bold | - |
| Large Price | 42pt | Bold | - |
| Body Price | 20pt | Bold | - |
| Body Text | 16pt | Normal | - |
| Small Label | 12pt | Normal | - |
| Micro Label | 10pt | Bold | Uppercase, letter-spacing: 1-2 |
| Metadata | 9pt | Normal | - |

### Components

#### Buttons
**Primary:** White/green bg, black text, 56-64px height, 16px radius, icon+text (gap 8-12px), no shadow  
**Secondary:** `#222` bg, white text, 56px height, 16px radius, 1px border (`#333`)  
**Icon:** 40-48px circle, glass bg, 1px glass-border, 20-24px icon  
**FAB:** 64px circle, white bg, black icon (24px), shadow: `{offset: {0,2}, opacity: 0.2, radius: 10, color: white}`

#### Cards
**Asset Card:** `#0A0A0A` bg, 1px `#222` border, 16px radius, 4px padding (image) + 12px (content), 80px thumbnail  
**Stat Card:** `#111` bg, 1px `#222` border, 16px radius, 16px padding  
**Deal Card:** `#141414` bg, 1px `#222` border, 12px radius, 16px padding, horizontal space-between

#### Badges
**Category Tag:** `rgba(255,255,255,0.1)` bg, 1px glass-border, 4px radius, 4×8px padding, 10pt white  
**Verified:** `rgba(0,255,148,0.2)` bg, ShieldCheck icon (12px green), "VERIFIED" (10pt green), 4×8px padding, 4px radius  
**Trend Pill:** Green/red 10% opacity bg, `#00FF94`/`#FF3B30` text, 4px radius, 2×6px padding, 10pt bold  
**Capability Pill:** `rgba(255,255,255,0.05)` bg, 1px glass-border, 20px radius, 6×12px padding, icon+text (gap 6px)

#### Scanner HUD
**Reticle:** 250-280px square, 2px border (state-dependent color), 20px corner brackets, 32px center icon when locked  
**Status Labels:** 10pt bold uppercase, letter-spacing: 1, state-dependent color, 6px dot  
**Progress Bar:** 2px height, 100px width, `rgba(255,255,255,0.1)` bg, animated fill

### Spacing
`xs:4, s:8, m:12, l:16, xl:20, xxl:30, xxxl:40`  
**Gaps:** Button rows 12-16px, card lists 10-12px, tags 6-8px, icon-text 6-12px

### Effects
**Noise Overlay:** Fixed, full viewport, 0.03 opacity, z-index 50, pointer-events none, SVG fractal noise  
**Glass:** `rgba(20,20,20,0.6)` bg, 1px `rgba(255,255,255,0.08)` border, backdrop-filter blur(10px) web only  
**Gradients:** Hero overlay `rgba(0,0,0,0.3)`, bottom sheets `rgba(0,0,0,0.9)`  
**Shadows:** FAB only (soft white glow), all others flat with borders

### Interactions
**Touch Feedback:** Opacity 0.6-0.8 or slight scale, no shadows  
**Haptics:** Scan state change (heavy), capture (selection), success (success), delete (warning)  
**Animations:** Scan line 2s infinite, state crossfades, modal spring slide, chart fade-in, reticle 300ms transitions

### Accessibility
**Contrast:** WCAG AA, white on black 21:1, green `#00FF94` high contrast, red `#FF3B30` high contrast  
**Touch Targets:** Min 40px, primary 56-64px, adequate spacing  
**Text:** Min 10pt, body 12-16pt, high letter-spacing for uppercase  
**Feedback:** Visual states, haptics, loading indicators, error messages

### Assets
**Icons:** Lucide React Native only (Scan, ChevronLeft, Lock, Wifi, Wallet, Layers, Aperture, TrendingUp, Share2, X)  
**Noise:** SVG/data-URI fractal noise  
**No:** Custom illustrations, emojis  
**Dynamic:** Camera images (base64), SVG charts, Gemini video previews

### Platform Notes
**iOS:** StatusBar hidden during scan, safe area insets, native haptics  
**Android:** Elevation for FAB, translucent StatusBar config  
**Web:** Mock accelerometer, graceful haptic fallback, browser camera APIs

---

**Design Philosophy:** Tactical, high-tech aesthetic with precision. Monospace typography, HUD overlays, neon accents. Functional and purposeful—no decoration, visual interest through transparency, borders, color accents.
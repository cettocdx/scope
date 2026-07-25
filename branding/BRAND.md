# SCOPE — Brand Guide

The single source of truth for the SCOPE identity. Colour values here mirror
`client/constants/theme.ts`; if the two ever disagree, `theme.ts` wins and this
file is the thing that needs fixing.

---

## The mark

SCOPE's mark is a **hexagonal aperture**.

The hexagon is not decoration and not a generic "tech hex" — it is the aperture
itself, the six-blade opening of a lens. That is the whole product in one shape:
point the lens at a thing, find out what it is worth. The bright node at the
centre is the asset being scoped.

Two rules keep it recognisable:

- **The ring carries mass.** Ring thickness is 46% of the outer radius
  (outer R=26, inner r=14 on the 64×64 artboard). This is why the mark holds up
  at favicon size where a thin-stroke lens would disintegrate.
- **The node is always lighter than the ring.** It is `accentIce`, the top of
  the ramp. It should read as the brightest point in the mark.

### Geometry

| Artboard | Outer R | Inner r | Node r |
|---|---|---|---|
| 64 (`logo-mark.svg`, `Logo.tsx`) | 26 | 14 | 4.5 |
| 1024 (`icon.svg`) | 320 | 172 | 55 |
| Hero (`docs/hero.svg`) | 78 | 42 | 13.5 |

All three are the same shape at 1×, 16× and 3×. Do not redraw the hexagon by
hand — scale one of these.

### Clear space and minimum size

- **Clear space:** one mark-height on every side of the lockup. Nothing —
  type, rules, image edges — enters that box.
- **Minimum size:** 16px for the mark alone, 96px wide for the horizontal
  lockup. Below 96px, drop the wordmark and use the mark by itself.

---

## Colour

### Brand accent — the identity

| Token | Hex | Role |
|---|---|---|
| `accent` | `#5B7CFF` | Primary brand blue. Buttons, active states, highlights. |
| `accentDeep` | `#8B5CFF` | Violet end of the ramp. Gradients only, never flat UI. |
| `accentIce` | `#B9D4FF` | Light end. Mark node, taglines, emphasis on dark. |
| `navyGlow` | `#07122A` | Atmospheric glow behind the mark and on the home screen. |

The gradient is always `accent → accentIce → accentDeep` on a 45° diagonal.
The light stop sits in the **middle**, not at an end — that centre highlight is
what makes the mark read as glass rather than as a flat shape.

### Semantic colour — never brand colour

| Token | Hex | Role |
|---|---|---|
| `successGreen` | `#00FF94` | **Gain only.** Upward trend, profit, verified. |
| `alertRed` | `#FF3B30` | **Loss only.** Downward trend, liquidate, destructive. |
| `warningYellow` | `#FACC15` | Caution, degraded state. |

> **The rule that matters most:** green and red carry *financial meaning* in this
> product. A green button does not mean "primary", it means "up". Using green as
> a brand accent is what broke the identity before — the logo sat on `#00FF94`
> while the app had already moved to blue/violet, so the mark was quietly saying
> "profit" instead of "SCOPE". Brand is blue. Money is green and red. Keep them
> apart.

### Surfaces

`backgroundRoot #000000` · `backgroundDefault #0A0A0A` ·
`backgroundSecondary #111111` · `backgroundTertiary #141414` ·
`glassSurface rgba(20,20,20,0.6)` · `glassBorder rgba(255,255,255,0.08)`

SCOPE is black-first. The canvas is true black, not dark grey, and depth comes
from the navy glow plus hairline borders — not from drop shadows.

---

## Typography

**Inter**, across the whole product. Loaded per-weight in `App.tsx`; on native
you must reference the exact weight family (`Inter_700Bold`) because React
Native ignores `fontWeight` for a single-weight family. `Fonts.mono` is a
backward-compat alias that now maps to Inter Medium — it is not a monospace and
no new code should reach for it expecting one.

| Role | Size | Weight |
|---|---|---|
| Hero | 64 | 900, tracking −2 |
| H1 / H2 / H3 / H4 | 32 / 24 / 20 / 16 | 700 / 700 / 600 / 600 |
| Price | 42 | 700 |
| Body | 16 | 400 |
| Label | 12 | 400 |
| Micro | 10 | 700, uppercase, tracking +1 |

Uppercase micro labels always carry positive tracking. Set tight tracking on
display sizes only.

---

## Assets

| File | Use |
|---|---|
| `branding/logo-mark.svg` | Mark alone, 64×64 artboard. Source of truth for geometry. |
| `branding/wordmark.svg` | Horizontal lockup, mark + wordmark. |
| `branding/icon.svg` | App icon, 1024×1024, full-bleed with navy glow. |
| `docs/hero.svg` | README / marketing hero. |
| `client/components/Logo.tsx` | In-app mark. Pulls colour from theme, never hardcoded. |
| `assets/images/*.png` | Generated — see below. Do not hand-edit. |
| `design/home-mockups.html` | **Superseded.** Historical concept exploration in the retired green / monospace direction. Kept as a record, deliberately not repainted. |

### Regenerating the PNGs

Every PNG in `assets/images/` is derived from `branding/icon.svg`:

```bash
pip install cairosvg
python3 scripts/render-brand.py
```

The Android adaptive foreground is scaled to 0.72 so the mark stays inside the
circular mask's safe zone; the monochrome layer is the same silhouette in flat
white. If you change `icon.svg`, re-run the script rather than exporting by hand.

---

## Misuse

Don't:

- recolour the mark to green, or any colour outside the accent ramp
- put the gradient on the wordmark *and* the mark in the same lockup — the mark
  carries the gradient, the wordmark stays solid
- add a drop shadow or outer glow to the mark (the navy radial glow is a
  background layer, not an effect on the mark)
- rotate, skew, or stretch it — the hexagon is pointy-top, always
- place it on a mid-tone background; it is built for near-black, or for white
  with the wordmark switched to `navyGlow`
- reintroduce monospace type for a "tactical" look — that direction was retired

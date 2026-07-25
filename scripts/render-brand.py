#!/usr/bin/env python3
"""Render every PNG in assets/images/ from branding/icon.svg.

The PNGs are build output, not source. Editing them by hand is how the icon
drifts away from the mark; run this instead.

    pip install cairosvg
    python3 scripts/render-brand.py

The Android adaptive layers are composed here rather than kept as separate SVG
files, because they are mechanical transforms of the same mark: the foreground
is the mark scaled into the mask's safe zone, the background is the navy field
on its own, and the monochrome layer is the silhouette in flat white.
"""

import pathlib

import cairosvg

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images"

# Mark geometry — branding/logo-mark.svg scaled 16× onto the 1024 artboard.
# Keep in sync with branding/icon.svg if the mark ever changes.
MARK_PATH = (
    "M512,192 L789.13,352 L789.13,672 L512,832 L234.87,672 L234.87,352 Z "
    "M512,340 L660.96,426 L660.96,598 L512,684 L363.04,598 L363.04,426 Z"
)
NODE = '<circle cx="512" cy="512" r="55" fill="{fill}"/>'

ACCENT_GRADIENT = """
  <linearGradient id="g" x1="234.87" y1="192" x2="789.13" y2="832"
                  gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#5B7CFF"/>
    <stop offset="0.5" stop-color="#B9D4FF"/>
    <stop offset="1" stop-color="#8B5CFF"/>
  </linearGradient>
"""

NAVY_FIELD = """
  <radialGradient id="b" cx="50%" cy="46%" r="66%">
    <stop offset="0" stop-color="#07122A"/>
    <stop offset="0.55" stop-color="#02040A"/>
    <stop offset="1" stop-color="#000000"/>
  </radialGradient>
"""

# Android's adaptive-icon mask can crop to roughly the middle 66% of the
# canvas. 0.72 keeps the hexagon's vertices clear of that boundary.
SAFE_ZONE_SCALE = 0.72


def _svg(defs: str, body: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" '
        f'viewBox="0 0 1024 1024"><defs>{defs}</defs>{body}</svg>'
    )


def _masked(fill: str, node_fill: str) -> str:
    """The mark alone, scaled into the adaptive-icon safe zone."""
    return _svg(
        ACCENT_GRADIENT,
        f'<g transform="translate(512 512) scale({SAFE_ZONE_SCALE}) '
        'translate(-512 -512)">'
        f'<path fill="{fill}" fill-rule="evenodd" d="{MARK_PATH}"/>'
        f"{NODE.format(fill=node_fill)}</g>",
    )


ANDROID_FOREGROUND = _masked("url(#g)", "#B9D4FF")
ANDROID_MONOCHROME = _masked("#FFFFFF", "#FFFFFF")
ANDROID_BACKGROUND = _svg(NAVY_FIELD, '<rect width="1024" height="1024" fill="url(#b)"/>')


def main() -> None:
    icon = ROOT / "branding" / "icon.svg"

    # (source, output filename, width). Source is either a path or raw markup.
    jobs = [
        (icon, "icon.png", 1024),
        (icon, "splash-icon.png", 1024),
        (icon, "favicon.png", 512),
        (ANDROID_FOREGROUND, "android-icon-foreground.png", 1024),
        (ANDROID_BACKGROUND, "android-icon-background.png", 1024),
        (ANDROID_MONOCHROME, "android-icon-monochrome.png", 1024),
    ]

    for source, name, width in jobs:
        target = OUT / name
        kwargs = (
            {"url": str(source)}
            if isinstance(source, pathlib.Path)
            else {"bytestring": source.encode()}
        )
        cairosvg.svg2png(
            write_to=str(target), output_width=width, output_height=width, **kwargs
        )
        print(f"{name:32} {target.stat().st_size / 1024:7.1f} KB")


if __name__ == "__main__":
    main()

"""Static font instances for the "Share my trip" images.

Canvas text in WebKit ignores the weight axis of variable fonts, so the share
images load fixed-weight copies of Fraunces and Instrument Sans (both SIL OFL)
from public/fonts/share/ via the FontFace API instead of the page's variable
fonts. Rerun after changing fonts or weights:

    npm run build                       # next/font puts the variable fonts in .next/static/media
    pip install fonttools brotli
    python scripts/make-share-fonts.py
"""
import glob
import os

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = os.path.join(".next", "static", "media")
OUT = os.path.join("public", "fonts", "share")

# (family, subfamily in the source) -> [(output name, axis values)]
# Fraunces matches the site's .font-display look (SOFT 100, WONK 1) at a headline optical size.
WANT = {
    ("Fraunces", "Regular"): [("fraunces-600", {"wght": 600, "opsz": 72, "SOFT": 100, "WONK": 1})],
    ("Fraunces", "Italic"): [
        ("fraunces-600-italic", {"wght": 600, "opsz": 72, "SOFT": 100, "WONK": 1}),
        ("fraunces-900-italic", {"wght": 900, "opsz": 72, "SOFT": 100, "WONK": 1}),
    ],
    ("Instrument Sans", "Regular"): [(f"instrument-{w}", {"wght": w, "wdth": 100}) for w in (500, 600, 700)],
}


def latin_source(family: str, sub: str) -> str:
    """The latin subset (the one with é) of a next/font family."""
    for f in glob.glob(os.path.join(SRC, "*.woff2")):
        t = TTFont(f)
        if t["name"].getDebugName(1) == family and t["name"].getDebugName(2) == sub and 0xE9 in t.getBestCmap():
            return f
    raise SystemExit(f"No latin {family} {sub} in {SRC} — run `npm run build` first")


os.makedirs(OUT, exist_ok=True)
for (family, sub), outs in WANT.items():
    src = latin_source(family, sub)
    for name, axes in outs:
        font = instantiateVariableFont(TTFont(src), axes)
        font.flavor = "woff2"
        path = os.path.join(OUT, f"{name}.woff2")
        font.save(path)
        print(f"{path}  {os.path.getsize(path) // 1024} KB  ({family} {sub} {axes})")

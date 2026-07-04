# -*- coding: utf-8 -*-
"""Génère les assets source (icône + splash) pour Capacitor / stores."""
import os
from PIL import Image, ImageDraw

ORANGE = (232, 160, 69)   # #E8A045
CREAM  = (248, 245, 239)  # #F8F5EF
WHITE  = (255, 255, 255)

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)


def draw_mark(img, cx, cy, size, bg=ORANGE, rounded=True):
    """Dessine la marque TablièreCI (carré orange + T blanc) centrée en (cx,cy)."""
    d = ImageDraw.Draw(img)
    half = size // 2
    x0, y0, x1, y1 = cx - half, cy - half, cx + half, cy + half
    r = int(size * 0.22)
    if rounded:
        d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=bg)
    else:
        d.rectangle([x0, y0, x1, y1], fill=bg)
    # T blanc (barre + tige), proportions généreuses
    bar_w = int(size * 0.56)
    bar_h = int(size * 0.11)
    bar_x = cx - bar_w // 2
    bar_y = cy - int(size * 0.20)
    d.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
                        radius=bar_h // 2, fill=WHITE)
    stem_w = int(size * 0.13)
    stem_x = cx - stem_w // 2
    stem_y = bar_y
    stem_h = int(size * 0.46)
    d.rounded_rectangle([stem_x, stem_y, stem_x + stem_w, stem_y + stem_h],
                        radius=stem_w // 2, fill=WHITE)
    # petite vague sous le T
    wave_y = cy + int(size * 0.26)
    d.arc([cx - int(size*0.24), wave_y - int(size*0.10),
           cx,                  wave_y + int(size*0.06)], 200, 340,
          fill=(255, 255, 255, 160), width=max(2, size // 90))
    d.arc([cx,                  wave_y - int(size*0.06),
           cx + int(size*0.24), wave_y + int(size*0.10)], 200, 340,
          fill=(255, 255, 255, 160), width=max(2, size // 90))


# ── Icône 1024 (fond orange plein, masqué par iOS/Android) ──────────────────
icon = Image.new("RGB", (1024, 1024), ORANGE)
# T blanc centré sur fond orange (pas de carré interne : le fond EST le carré)
draw_mark(icon, 512, 512, 1024, bg=ORANGE, rounded=False)
icon.save(os.path.join(OUT, "icon.png"))

# ── Splash 2732 (fond crème, logo centré) ───────────────────────────────────
def make_splash(bg):
    s = Image.new("RGB", (2732, 2732), bg)
    draw_mark(s, 1366, 1366, 620, bg=ORANGE, rounded=True)
    return s

make_splash(CREAM).save(os.path.join(OUT, "splash.png"))
make_splash((26, 34, 30)).save(os.path.join(OUT, "splash-dark.png"))

print("Assets générés dans", os.path.abspath(OUT))
print(" - icon.png (1024)")
print(" - splash.png / splash-dark.png (2732)")

"""Draws the app icon (speech bubble with sound bars) as PNGs for the web app manifest."""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "frontend" / "public"
CORAL, WHITE, INK = (214, 64, 43), (255, 250, 246), (20, 17, 16)


def draw(size: int, maskable: bool) -> Image.Image:
    s = size / 64
    img = Image.new("RGB" if maskable else "RGBA", (size, size), CORAL if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable:  # square, thick black border: brutalist
        d.rectangle([0, 0, size - 1, size - 1], fill=INK)
        b = round(4 * s)
        d.rectangle([b, b, size - 1 - b, size - 1 - b], fill=CORAL)
    # maskable icons keep the art inside the central 80% safe zone
    k = 0.72 if maskable else 1.0
    off = size * (1 - k) / 2

    def P(x, y):
        return (off + x * s * k, off + y * s * k)

    x0, y0 = P(12, 20)
    x1, y1 = P(52, 42)
    d.polygon([P(14, 18), P(50, 18), P(50, 42), P(30, 42), P(22, 50), P(22, 42), P(14, 42)], fill=WHITE, outline=INK, width=max(2, round(3 * s * k)))
    w = max(2, round(3 * s * k))
    for x, ya, yb in ((25, 28, 34), (32, 25, 37), (39, 28, 34)):
        d.line([P(x, ya), P(x, yb)], fill=INK, width=round(4 * s * k))
    return img


for name, size, maskable in [("icon-192.png", 192, False), ("icon-512.png", 512, False),
                             ("icon-maskable-512.png", 512, True), ("apple-touch-icon.png", 180, True)]:
    draw(size, maskable).save(OUT / name)
    print("wrote", name)

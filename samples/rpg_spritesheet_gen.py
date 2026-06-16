"""Generate 32px RPG tile spritesheet (4 tiles) with RGBA transparency on props."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SAMPLES_DIR = Path(__file__).resolve().parent
OUT_SPRITESHEET = SAMPLES_DIR / "rpg_spritesheet_32px.png"
OUT_ALPHA_CHECK = SAMPLES_DIR / "rpg_spritesheet_32px_alpha_check.png"

TILE_SIZE = 32
NUM_TILES = 4


def build_spritesheet() -> Image.Image:
    width = TILE_SIZE * NUM_TILES
    img = Image.new("RGBA", (width, TILE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tile 1 — grass (opaque ground)
    draw.rectangle([0, 0, 31, 31], fill=(56, 93, 58, 255))
    for pt in [(5, 5), (6, 5), (5, 6), (20, 10), (21, 10), (12, 22), (25, 25)]:
        draw.point(pt, fill=(83, 137, 86, 255))

    # Tile 2 — dirt (opaque ground)
    draw.rectangle([32, 0, 63, 31], fill=(166, 124, 82, 255))
    for pt in [(35, 12), (48, 6), (55, 20), (40, 25)]:
        draw.point(pt, fill=(120, 85, 50, 255))

    # Tile 3 — rock (transparent padding; semi-transparent shadow)
    draw.ellipse([68, 22, 90, 28], fill=(0, 0, 0, 80))
    draw.ellipse([68, 6, 90, 26], fill=(113, 128, 150, 255))
    draw.ellipse([72, 10, 80, 16], fill=(160, 174, 192, 255))

    # Tile 4 — crate (transparent padding)
    draw.rectangle([100, 4, 124, 28], fill=(139, 94, 60, 255))
    draw.rectangle([100, 4, 124, 28], outline=(74, 46, 26, 255), width=2)
    draw.line([102, 6, 122, 26], fill=(74, 46, 26, 255), width=1)
    draw.line([122, 6, 102, 26], fill=(74, 46, 26, 255), width=1)

    return img


def verify_alpha(img: Image.Image) -> None:
    if img.mode != "RGBA":
        raise SystemExit(f"Expected RGBA, got {img.mode}")

    names = ("grass", "dirt", "rock", "crate")
    for index, name in enumerate(names):
        x0 = index * TILE_SIZE
        tile = img.crop((x0, 0, x0 + TILE_SIZE, TILE_SIZE))
        pixels = list(tile.getdata())
        transparent = sum(1 for _, _, _, a in pixels if a == 0)
        semi = sum(1 for _, _, _, a in pixels if 0 < a < 255)
        opaque = sum(1 for _, _, _, a in pixels if a == 255)
        print(f"  tile {index + 1} ({name}): transparent={transparent} semi={semi} opaque={opaque}")

        if name in ("grass", "dirt") and transparent > 0:
            raise SystemExit(f"Ground tile '{name}' must be fully opaque (found {transparent} transparent px)")
        if name in ("rock", "crate") and transparent < 100:
            raise SystemExit(f"Prop tile '{name}' needs transparent padding (found only {transparent} transparent px)")


def write_alpha_check(img: Image.Image) -> None:
    """Composite on magenta so transparency is obvious (not black) in plain viewers."""
    checker = Image.new("RGBA", img.size, (255, 0, 255, 255))
    checker.paste(img, mask=img.split()[3])
    checker.save(OUT_ALPHA_CHECK, format="PNG")


def main() -> None:
    img = build_spritesheet()
    print("Alpha channel per tile:")
    verify_alpha(img)

    img.save(OUT_SPRITESHEET, format="PNG")
    write_alpha_check(img)

    print(f"Spritesheet: {OUT_SPRITESHEET}")
    print(f"Alpha check: {OUT_ALPHA_CHECK} (magenta = visible through transparent pixels)")


if __name__ == "__main__":
    main()

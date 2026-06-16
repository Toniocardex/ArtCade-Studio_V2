"""Generate 8x7 RPG tile spritesheet (32px cells) with RGBA transparency."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SAMPLES_DIR = Path(__file__).resolve().parent
OUT_FILE = SAMPLES_DIR / "rpg_spritesheet_complete.png"

TILE_SIZE = 32
COLS = 8
ROWS = 7


def create_rpg_spritesheet() -> Image.Image:
    width = TILE_SIZE * COLS
    height = TILE_SIZE * ROWS

    spritesheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(spritesheet)

    C = {
        "tr": (0, 0, 0, 0),
        "shadow": (0, 0, 0, 90),
        "dark_shadow": (0, 0, 0, 150),
        "g1": (56, 93, 58, 255),
        "g2": (83, 137, 86, 255),
        "g3": (110, 172, 114, 255),
        "wood_dark": (74, 46, 26, 255),
        "wood_mid": (139, 94, 60, 255),
        "wood_lit": (186, 135, 89, 255),
        "d1": (120, 85, 50, 255),
        "d2": (166, 124, 82, 255),
        "s1": (201, 163, 113, 255),
        "s2": (222, 194, 151, 255),
        "w1": (44, 82, 130, 255),
        "w2": (99, 179, 237, 255),
        "w3": (144, 205, 244, 255),
        "st1": (74, 85, 104, 255),
        "st2": (113, 128, 150, 255),
        "st3": (160, 174, 192, 255),
        "st4": (226, 232, 240, 255),
        "roof1": (180, 50, 50, 255),
        "roof2": (130, 30, 30, 255),
        "wall": (220, 190, 150, 255),
        "wall_dark": (180, 150, 110, 255),
        "fire1": (250, 100, 0, 255),
        "fire2": (250, 200, 0, 255),
        "gold1": (183, 121, 31, 255),
        "gold2": (236, 201, 75, 255),
        "gold3": (255, 240, 130, 255),
        "red1": (155, 44, 44, 255),
        "red2": (229, 62, 62, 255),
        "white": (255, 255, 255, 255),
        "black": (0, 0, 0, 255),
        "skin": (229, 182, 142, 255),
        "skin_shadow": (186, 135, 97, 255),
        "cloth_blue": (49, 130, 206, 255),
        "cloth_dark": (45, 55, 72, 255),
        "goblin": (72, 187, 120, 255),
        "goblin_dark": (39, 121, 74, 255),
    }

    def draw_pixel_matrix(
        start_x: int, start_y: int, matrix: list[str], palette: dict[str, str]
    ) -> None:
        for r_idx, row in enumerate(matrix):
            for c_idx, char in enumerate(row):
                if char not in palette:
                    continue
                color_key = palette[char]
                if color_key == "tr":
                    continue
                draw.point((start_x + c_idx, start_y + r_idx), fill=C[color_key])

    # ---- ROW 0: terrain ----
    tile_x, tile_y = 0, 0
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 31], fill=C["g1"])
    for pt in [
        (4, 5), (5, 5), (4, 6), (18, 3), (19, 3), (18, 4), (10, 12), (11, 12),
        (25, 15), (26, 15), (25, 16), (6, 22), (7, 22), (15, 26), (16, 26), (28, 28),
    ]:
        draw.point((tile_x + pt[0], tile_y + pt[1]), fill=C["g2"])
        draw.point((tile_x + pt[0] + 1, tile_y + pt[1] - 1), fill=C["g3"])

    tile_x = 1 * TILE_SIZE
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 31], fill=C["d2"])
    for pt in [
        (3, 3, "d1"), (4, 3, "d1"), (22, 5, "d1"), (12, 18, "d1"), (28, 12, "d1"),
        (15, 8, "s1"), (8, 25, "s1"), (20, 22, "s1"), (21, 22, "s1"),
    ]:
        draw.point((tile_x + pt[0], tile_y + pt[1]), fill=C[pt[2]])

    tile_x = 2 * TILE_SIZE
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 31], fill=C["s2"])
    for pt in [(5, 10), (6, 10), (7, 11), (8, 11), (20, 20), (21, 20), (22, 21), (23, 21)]:
        draw.point((tile_x + pt[0], tile_y + pt[1]), fill=C["s1"])

    tile_x = 3 * TILE_SIZE
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 31], fill=C["w1"])
    for pt in [(4, 8), (5, 8), (6, 9), (7, 9), (18, 14), (19, 14), (20, 15), (10, 24), (11, 24), (12, 25)]:
        draw.point((tile_x + pt[0], tile_y + pt[1]), fill=C["w2"])

    tile_x = 4 * TILE_SIZE
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 31], fill=C["w1"])
    for pt in [(5, 9), (6, 9), (7, 10), (19, 15), (20, 15), (21, 16), (11, 25), (12, 25), (13, 26)]:
        draw.point((tile_x + pt[0], tile_y + pt[1]), fill=C["w2"])

    tile_x = 5 * TILE_SIZE
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 31], fill=C["d2"])
    draw.rectangle([tile_x, tile_y, tile_x + 31, tile_y + 8], fill=C["g1"])
    for i in range(0, 32, 4):
        draw.point((tile_x + i, tile_y + 8), fill=C["g2"])
        draw.point((tile_x + i + 1, tile_y + 9), fill=C["g1"])

    # ---- ROW 1: obstacles ----
    tile_y = 1 * TILE_SIZE

    tile_x = 0
    draw.ellipse([tile_x + 4, tile_y + 22, tile_x + 28, tile_y + 29], fill=C["shadow"])
    draw.ellipse([tile_x + 4, tile_y + 4, tile_x + 28, tile_y + 26], fill=C["st1"], outline=C["black"], width=1)
    draw.ellipse([tile_x + 6, tile_y + 6, tile_x + 26, tile_y + 24], fill=C["st2"])
    draw.ellipse([tile_x + 8, tile_y + 8, tile_x + 18, tile_y + 16], fill=C["st3"])
    draw.ellipse([tile_x + 10, tile_y + 9, tile_x + 14, tile_y + 12], fill=C["st4"])

    tile_x = 1 * TILE_SIZE
    draw.rectangle([tile_x + 4, tile_y + 27, tile_x + 28, tile_y + 29], fill=C["shadow"])
    draw.rectangle([tile_x + 4, tile_y + 4, tile_x + 28, tile_y + 27], fill=C["wood_mid"], outline=C["black"], width=1)
    draw.rectangle([tile_x + 4, tile_y + 4, tile_x + 7, tile_y + 27], fill=C["wood_dark"])
    draw.rectangle([tile_x + 25, tile_y + 4, tile_x + 28, tile_y + 27], fill=C["wood_dark"])
    draw.rectangle([tile_x + 4, tile_y + 4, tile_x + 28, tile_y + 7], fill=C["wood_dark"])
    draw.rectangle([tile_x + 4, tile_y + 24, tile_x + 28, tile_y + 27], fill=C["wood_dark"])
    draw.rectangle([tile_x + 8, tile_y + 8, tile_x + 24, tile_y + 23], fill=C["wood_mid"])
    draw.line([tile_x + 8, tile_y + 8, tile_x + 24, tile_y + 23], fill=C["wood_dark"], width=2)
    draw.line([tile_x + 24, tile_y + 8, tile_x + 8, tile_y + 23], fill=C["wood_dark"], width=2)
    draw.line([tile_x + 5, tile_y + 5, tile_x + 27, tile_y + 5], fill=C["wood_lit"], width=1)

    tile_x = 2 * TILE_SIZE
    draw.rectangle([tile_x + 14, tile_y + 18, tile_x + 18, tile_y + 28], fill=C["wood_dark"], outline=C["black"])
    draw.ellipse([tile_x + 4, tile_y + 25, tile_x + 28, tile_y + 30], fill=C["shadow"])
    draw.ellipse([tile_x + 4, tile_y + 2, tile_x + 28, tile_y + 22], fill=C["g1"], outline=C["black"])
    draw.ellipse([tile_x + 6, tile_y + 4, tile_x + 26, tile_y + 19], fill=C["g2"])
    draw.ellipse([tile_x + 10, tile_y + 6, tile_x + 22, tile_y + 14], fill=C["g3"])

    tile_x = 3 * TILE_SIZE
    draw.ellipse([tile_x + 10, tile_y + 24, tile_x + 22, tile_y + 27], fill=C["shadow"])
    draw.rectangle([tile_x + 13, tile_y + 16, tile_x + 18, tile_y + 25], fill=C["white"], outline=C["black"])
    draw.chord([tile_x + 7, tile_y + 8, tile_x + 25, tile_y + 20], 180, 360, fill=C["red2"], outline=C["black"])
    draw.rectangle([tile_x + 8, tile_y + 14, tile_x + 24, tile_y + 15], fill=C["red1"])
    for pt in [(11, 11), (16, 10), (21, 12)]:
        draw.point((tile_x + pt[0], tile_y + pt[1]), fill=C["white"])

    # ---- ROW 2: interactables ----
    tile_y = 2 * TILE_SIZE
    chest_palette = {" ": "tr", "b": "black", "k": "wood_dark", "K": "wood_mid", "o": "gold1", "X": "gold3"}

    tile_x = 0
    chest_closed = [
        "  bbbbbbbbbbbbbbbbbbbbbb  ", " bbbkkkkkkkkkkkkkkkkkkbbb ", "bkkkKKKKKKKKKKKKKKKKKKkkkb",
        "bkKKKKKKKKKKKKKKKKKKKKKKkb", "bkkKKKKKKKooooKKKKKKKKKKkb", "bkkKKKKKKKoXXoKKKKKKKKKKkb",
        "bkkKKKKKKKooooKKKKKKKKKKkb", "bkkKKKKKKKKKKKKKKKKKKKKKkb", "bbbbbbbbbbbbbbbbbbbbbbbbbb",
        "bkkkKKKKKKKKKKKKKKKKKKkkkb", "bkkKKKKKKKKKKKKKKKKKKKKKkb", "bkkKKKKKKKKKKKKKKKKKKKKKkb",
        "bkkKKKKKKKKKKKKKKKKKKKKKkb", "bkkKKKKKKKKKKKKKKKKKKKKKkb", " bbbkkkkkkkkkkkkkkkkkkbbb ",
        "  bbbbbbbbbbbbbbbbbbbbbb  ",
    ]
    draw.ellipse([tile_x + 2, tile_y + 24, tile_x + 30, tile_y + 29], fill=C["shadow"])
    draw_pixel_matrix(tile_x + 3, tile_y + 8, chest_closed, chest_palette)

    tile_x = 1 * TILE_SIZE
    chest_open = [
        "  bbbbbbbbbbbbbbbbbbbbbb  ", " bbbkkkkkkkkkkkkkkkkkkbbb ", "bkkkKKKKKKKKKKKKKKKKKKkkkb",
        "bkKKKKKKKKKKKKKKKKKKKKKKkb", "bbbbbbbbbbbbbbbbbbbbbbbbbb", "bXXXYYYYYYYYYYYYYYYYYYXXXb",
        "bXYYYYYYYYYYYYYYYYYYYYYXXb", "bYYYYYYYYYYYYYYYYYYYYYYYXb", "bkkkkkkkkkkkkkkkkkkkkkkkkb",
        "bkkkKKKKKKKKKKKKKKKKKKkkkb", "bkkKKKKKKKKKKKKKKKKKKKKKkb", "bkkKKKKKKKKKKKKKKKKKKKKKkb",
        "bkkKKKKKKKKKKKKKKKKKKKKKkb", " bbbkkkkkkkkkkkkkkkkkkbbb ", "  bbbbbbbbbbbbbbbbbbbbbb  ",
    ]
    open_palette = {**chest_palette, "X": "gold1", "Y": "gold2"}
    draw.ellipse([tile_x + 2, tile_y + 24, tile_x + 30, tile_y + 29], fill=C["shadow"])
    draw_pixel_matrix(tile_x + 3, tile_y + 8, chest_open, open_palette)

    tile_x = 2 * TILE_SIZE
    key_matrix = [
        "      bbbb      ", "    bbXXYYbb    ", "   bXXYYYYYbb   ", "   bXYYbbYYYb   ",
        "   bYYb  bYYb   ", "   bYYb  bYYb   ", "   bXYYbbYYYb   ", "    bbYYYYbb    ",
        "      bYYb      ", "      bYYb      ", "      bYYbXX    ", "      bYYbXX    ",
        "      bYYb      ", "      bYYbXXb   ", "      bYYbXXb   ", "       bbbb     ",
    ]
    draw_pixel_matrix(tile_x + 8, tile_y + 8, key_matrix, {" ": "tr", "b": "black", "X": "gold1", "Y": "gold2"})

    tile_x = 3 * TILE_SIZE
    sign_matrix = [
        "  bbbbbbbbbbbbbbbbbbbb  ", " bXXYYYYYYYYYYYYYYYYXXb ", "bXYYYYYYYYYYYYYYYYYYYXb",
        "bYkkkkkkkkkkkkkkkkkkkYb", "bYkkkkkkkkkkkkkkkkkkkYb", "bXYYYYYYYYYYYYYYYYYYYXb",
        " bXXYYYYYYYYYYYYYYYYXXb ", "  bbbbbbbbbbbbbbbbbbbb  ", "          bkkb          ",
        "          bkkb          ", "          bkkb          ", "          bkkb          ",
        "          bkkb          ", "         bbkkbb         ",
    ]
    draw.ellipse([tile_x + 12, tile_y + 25, tile_x + 20, tile_y + 29], fill=C["shadow"])
    draw_pixel_matrix(
        tile_x + 4, tile_y + 6, sign_matrix,
        {" ": "tr", "b": "black", "X": "wood_dark", "Y": "wood_mid", "k": "wood_dark"},
    )

    # ---- ROW 3: characters ----
    tile_y = 3 * TILE_SIZE

    tile_x = 0
    hero = [
        "      bbbbbb      ", "     bssssssb     ", "    bssssssssb    ", "    bsKKssKKsb    ",
        "    bsbbssbbsb    ", "     bssssssb     ", "    bbbbbbbbbb    ", "   bcccbbbbcccb   ",
        "  bccccbbbbccccb  ", "  bcccbbbbbbcccb  ", "  bcccbbbbbbcccb  ", "   bcbbbbbbbbc    ",
        "     bbbbbbbb     ", "     bkk  kkb     ", "     bkk  kkb     ", "    bbbb  bbbb    ",
    ]
    draw.ellipse([tile_x + 8, tile_y + 26, tile_x + 24, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(
        tile_x + 7, tile_y + 4, hero,
        {" ": "tr", "b": "black", "s": "skin", "K": "skin_shadow", "c": "cloth_blue", "k": "cloth_dark"},
    )

    tile_x = 1 * TILE_SIZE
    villager = [
        "      bbbbbb      ", "     byyyyyyb     ", "    byyyyyyyyb    ", "    byssyssyb     ",
        "    byssbbsb      ", "     bssssb       ", "    bbbbbbbb      ", "   brrrbbbrrrb    ",
        "  brrrrbbbrrrrb   ", "  brrrbbbbbrrrb   ", "   brbbbbbbrrb    ", "     bbbbbb       ",
        "     bkk  kkb     ", "     bkk  kkb     ", "    bbbb  bbbb    ",
    ]
    draw.ellipse([tile_x + 8, tile_y + 26, tile_x + 24, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(
        tile_x + 7, tile_y + 5, villager,
        {" ": "tr", "b": "black", "y": "wood_lit", "s": "skin", "r": "red2", "k": "cloth_dark"},
    )

    tile_x = 2 * TILE_SIZE
    goblin = [
        "   bb          bb   ", "  bGGb        bGGb  ", "  bGgGbbbbbbbbGgGb  ", "   bGgGGGGGGGGgGb   ",
        "    bGkkGGGGkkGb    ", "    bGbbGGGGbbGb    ", "     bGGGGGGGGb     ", "      bGGGGGGb      ",
        "     bbbbbbbbbb     ", "    bKKKbbbbKKKb    ", "   bKKKKbbbbKKKKb   ", "    bKKbbbbbbKKb    ",
        "      bbbbbbbb      ", "      bKK  KKb      ", "      bKK  KKb      ", "     bbbb  bbbb     ",
    ]
    draw.ellipse([tile_x + 6, tile_y + 26, tile_x + 26, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(
        tile_x + 6, tile_y + 4, goblin,
        {" ": "tr", "b": "black", "G": "goblin", "g": "goblin_dark", "k": "red2", "K": "cloth_dark"},
    )

    # ---- ROWS 4-5: buildings & props ----
    hx, hy = 0, 4 * TILE_SIZE
    draw.ellipse([hx + 4, hy + 50, hx + 60, hy + 62], fill=C["shadow"])
    draw.rectangle([hx + 8, hy + 28, hx + 56, hy + 60], fill=C["wall"], outline=C["black"])
    draw.line([hx + 8, hy + 40, hx + 56, hy + 40], fill=C["wall_dark"])
    draw.line([hx + 8, hy + 50, hx + 56, hy + 50], fill=C["wall_dark"])
    draw.polygon([(hx + 2, hy + 28), (hx + 32, hy + 4), (hx + 62, hy + 28)], fill=C["roof1"], outline=C["black"])
    draw.polygon([(hx + 8, hy + 26), (hx + 32, hy + 8), (hx + 56, hy + 26)], fill=C["roof2"])
    draw.rectangle([hx + 24, hy + 40, hx + 40, hy + 60], fill=C["wood_mid"], outline=C["black"])
    draw.line([hx + 32, hy + 40, hx + 32, hy + 60], fill=C["wood_dark"])
    draw.point((hx + 36, hy + 50), fill=C["gold2"])
    draw.rectangle([hx + 12, hy + 36, hx + 20, hy + 44], fill=C["w2"], outline=C["black"])
    draw.rectangle([hx + 44, hy + 36, hx + 52, hy + 44], fill=C["w2"], outline=C["black"])
    draw.line([hx + 14, hy + 38, hx + 18, hy + 42], fill=C["white"])
    draw.line([hx + 46, hy + 38, hx + 50, hy + 42], fill=C["white"])

    bx, by = 2 * TILE_SIZE, 4 * TILE_SIZE
    draw.ellipse([bx + 6, by + 24, bx + 26, by + 29], fill=C["shadow"])
    draw.rectangle([bx + 8, by + 8, bx + 24, by + 26], fill=C["wood_mid"], outline=C["black"])
    for x in (12, 16, 20):
        draw.line([bx + x, by + 8, bx + x, by + 26], fill=C["wood_dark"])
    draw.line([bx + 8, by + 12, bx + 24, by + 12], fill=C["st2"], width=2)
    draw.line([bx + 8, by + 22, bx + 24, by + 22], fill=C["st2"], width=2)

    wx, wy = 3 * TILE_SIZE, 4 * TILE_SIZE
    draw.ellipse([wx + 4, wy + 22, wx + 28, wy + 29], fill=C["shadow"])
    draw.rectangle([wx + 6, wy + 18, wx + 26, wy + 26], fill=C["st2"], outline=C["black"])
    draw.line([wx + 6, wy + 22, wx + 26, wy + 22], fill=C["st1"])
    draw.rectangle([wx + 6, wy + 6, wx + 8, wy + 18], fill=C["wood_dark"])
    draw.rectangle([wx + 24, wy + 6, wx + 26, wy + 18], fill=C["wood_dark"])
    draw.polygon([(wx + 2, wy + 8), (wx + 16, wy + 2), (wx + 30, wy + 8)], fill=C["roof1"], outline=C["black"])
    draw.ellipse([wx + 8, wy + 18, wx + 24, wy + 22], fill=C["dark_shadow"])

    fx, fy = 4 * TILE_SIZE, 4 * TILE_SIZE
    draw.ellipse([fx + 6, fy + 22, fx + 26, fy + 28], fill=C["shadow"])
    draw.line([fx + 10, fy + 20, fx + 22, fy + 26], fill=C["wood_dark"], width=3)
    draw.line([fx + 22, fy + 20, fx + 10, fy + 26], fill=C["wood_dark"], width=3)
    draw.polygon([(fx + 16, fy + 8), (fx + 12, fy + 22), (fx + 20, fy + 22)], fill=C["fire1"])
    draw.polygon([(fx + 16, fy + 12), (fx + 14, fy + 22), (fx + 18, fy + 22)], fill=C["fire2"])

    sx, sy = 5 * TILE_SIZE, 4 * TILE_SIZE
    draw.rectangle([sx, sy + 14, sx + 32, sy + 16], fill=C["wood_mid"])
    draw.rectangle([sx, sy + 22, sx + 32, sy + 24], fill=C["wood_mid"])
    draw.rectangle([sx + 6, sy + 10, sx + 10, sy + 28], fill=C["wood_dark"])
    draw.rectangle([sx + 22, sy + 10, sx + 26, sy + 28], fill=C["wood_dark"])

    px, py = 6 * TILE_SIZE, 4 * TILE_SIZE
    draw.ellipse([px + 8, py + 24, px + 24, py + 28], fill=C["shadow"])
    draw.polygon([(px + 10, py + 26), (px + 8, py + 16), (px + 24, py + 16), (px + 22, py + 26)], fill=C["roof1"], outline=C["black"])
    draw.ellipse([px + 10, py + 6, px + 22, py + 16], fill=C["g2"], outline=C["black"])
    draw.ellipse([px + 12, py + 8, px + 20, py + 14], fill=C["g3"])

    vx, vy = 2 * TILE_SIZE, 5 * TILE_SIZE
    draw.rectangle([vx + 14, vy, vx + 18, vy + 32], fill=C["wood_mid"])
    draw.rectangle([vx + 8, vy + 6, vx + 24, vy + 10], fill=C["wood_dark"])
    draw.rectangle([vx + 8, vy + 22, vx + 24, vy + 26], fill=C["wood_dark"])

    ix, iy = 3 * TILE_SIZE, 5 * TILE_SIZE
    draw.ellipse([ix + 6, iy + 24, ix + 26, iy + 28], fill=C["shadow"])
    draw.rectangle([ix + 10, iy + 22, ix + 22, iy + 26], fill=C["st1"], outline=C["black"])
    draw.rectangle([ix + 12, iy + 16, ix + 20, iy + 22], fill=C["st1"])
    draw.polygon([(ix + 6, iy + 12), (ix + 26, iy + 12), (ix + 26, iy + 16), (ix + 10, iy + 16)], fill=C["st3"], outline=C["black"])

    tx, ty = 4 * TILE_SIZE, 5 * TILE_SIZE
    draw.ellipse([tx + 8, ty + 24, tx + 24, ty + 28], fill=C["shadow"])
    draw.rectangle([tx + 10, ty + 14, tx + 22, ty + 26], fill=C["st3"], outline=C["black"])
    draw.chord([tx + 10, ty + 10, tx + 22, ty + 18], 180, 360, fill=C["st3"], outline=C["black"])
    draw.line([tx + 16, ty + 14, tx + 16, ty + 20], fill=C["st1"])
    draw.line([tx + 14, ty + 16, tx + 18, ty + 16], fill=C["st1"])

    tex, tey = 5 * TILE_SIZE, 5 * TILE_SIZE
    draw.ellipse([tex + 4, tey + 20, tex + 60, tey + 30], fill=C["shadow"])
    draw.polygon([(tex + 8, tey + 26), (tex + 24, tey + 4), (tex + 40, tey + 26)], fill=C["wall"], outline=C["black"])
    draw.polygon([(tex + 24, tey + 4), (tex + 56, tey + 8), (tex + 60, tey + 26), (tex + 40, tey + 26)], fill=C["wall_dark"], outline=C["black"])
    draw.polygon([(tex + 20, tey + 26), (tex + 24, tey + 12), (tex + 28, tey + 26)], fill=C["dark_shadow"])

    # ---- ROW 6: player facing (4 directions) ----
    tile_y = 6 * TILE_SIZE
    player_palette = {
        " ": "tr", "b": "black", "s": "skin", "h": "wood_dark",
        "c": "cloth_blue", "k": "cloth_dark",
    }

    p_front = [
        "      bbbbbb      ", "     bhhhhhhb     ", "    bhhhhhhhhb    ", "    bshhsshhsb    ",
        "    bsbbssbbsb    ", "     bssssssb     ", "    bbbbbbbbbb    ", "   bcccbbbbcccb   ",
        "  bccccbbbbccccb  ", "  bcccbbbbbbcccb  ", "  bcccbbbbbbcccb  ", "   bcbbbbbbbbc    ",
        "     bbbbbbbb     ", "     bkk  kkb     ", "     bkk  kkb     ", "    bbbb  bbbb    ",
    ]
    draw.ellipse([8, tile_y + 26, 24, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(7, tile_y + 4, p_front, player_palette)

    p_back = [
        "      bbbbbb      ", "     bhhhhhhb     ", "    bhhhhhhhhb    ", "    bhhhhhhhhb    ",
        "    bhhhhhhhhb    ", "     bhhhhhhb     ", "    bbbbbbbbbb    ", "   bcccbbbbcccb   ",
        "  bccccbbbbccccb  ", "  bcccbbbbbbcccb  ", "  bcccbbbbbbcccb  ", "   bcbbbbbbbbc    ",
        "     bbbbbbbb     ", "     bkk  kkb     ", "     bkk  kkb     ", "    bbbb  bbbb    ",
    ]
    draw.ellipse([1 * TILE_SIZE + 8, tile_y + 26, 1 * TILE_SIZE + 24, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(1 * TILE_SIZE + 7, tile_y + 4, p_back, player_palette)

    p_right = [
        "      bbbbbb      ", "     bhhhhhhb     ", "    bhhhhhhhhb    ", "    bhhssssssb    ",
        "    bhhssbbssb    ", "     bhsssssb     ", "      bbbbbbbb    ", "      bccccccb    ",
        "      bccccccb    ", "      bccccccb    ", "      bccccccb    ", "      bcbbbbbc    ",
        "       bbbbbb     ", "       bkkkkb     ", "       bkkkkb     ", "      bbbbbbbb    ",
    ]
    draw.ellipse([2 * TILE_SIZE + 8, tile_y + 26, 2 * TILE_SIZE + 24, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(2 * TILE_SIZE + 7, tile_y + 4, p_right, player_palette)

    p_left = [
        "      bbbbbb      ", "     bhhhhhhb     ", "    bhhhhhhhhb    ", "    bsssssshhb    ",
        "    bssbbsshhb    ", "     bssssshb     ", "    bbbbbbbb      ", "    bccccccb      ",
        "    bccccccb      ", "    bccccccb      ", "    bccccccb      ", "    bcbbbbbc      ",
        "     bbbbbb       ", "     bkkkkb       ", "     bkkkkb       ", "    bbbbbbbb      ",
    ]
    draw.ellipse([3 * TILE_SIZE + 8, tile_y + 26, 3 * TILE_SIZE + 24, tile_y + 31], fill=C["shadow"])
    draw_pixel_matrix(3 * TILE_SIZE + 7, tile_y + 4, p_left, player_palette)

    return spritesheet


def main() -> None:
    img = create_rpg_spritesheet()
    img.save(OUT_FILE)
    w, h = img.size
    alpha_px = sum(1 for px in img.getdata() if px[3] < 255)
    print(f"[OK] {OUT_FILE.name} ({w}x{h}px, RGBA, {alpha_px} semi-transparent pixels)")


if __name__ == "__main__":
    main()

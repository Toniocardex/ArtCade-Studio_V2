# -*- coding: utf-8 -*-
"""
Build ArtCade Studio monolithic app icons from SVG (or optional brand PNG).

Outputs (editor/src-tauri/icons/):
  - app-icon.png   (1024×1024 master for `npx tauri icon`)
  - icon.png       (256×256 bundle / fallback)
  - icon.ico       (256, 64, 48, 32, 16 — Windows exe + taskbar)
  - Plus full Tauri set when not using --skip-tauri

Requires: Pillow; SVG via Node + sharp (see editor devDependencies) or optional cairosvg + Cairo
  pip install -r scripts/requirements-icons.txt
  npm install   # installs sharp for SVG rasterization on Windows

Usage (from editor/):
  python scripts/build_app_icons.py
  python scripts/build_app_icons.py --svg scripts/assets/app-icon-monolith.svg
  python scripts/build_app_icons.py --skip-tauri
"""
from __future__ import annotations

import argparse
import io
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Installa Pillow: pip install -r scripts/requirements-icons.txt", file=sys.stderr)
    sys.exit(1)

try:
    import cairosvg
except (ImportError, OSError):
    cairosvg = None  # type: ignore[assignment]

ICO_SIZES = (256, 64, 48, 32, 16)
MASTER_SIZE = 1024
BG_RGBA = (18, 18, 18, 255)  # #121212
CORNER_RADIUS_RATIO = 186 / 1024  # match SVG rx on 1024 canvas
DEFAULT_GLYPH_FILL = 0.86  # AC glyph vs canvas (ready monolith PNG)
GLYPH_LUMA_THRESHOLD = 45


def render_svg_rgba(svg_path: Path, size: int, editor_dir: Path) -> Image.Image:
    if cairosvg is not None:
        try:
            png_bytes = cairosvg.svg2png(
                url=str(svg_path.resolve()),
                output_width=size,
                output_height=size,
            )
            return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
        except OSError:
            pass
    return render_svg_via_sharp(svg_path, size, editor_dir)


def render_svg_via_sharp(svg_path: Path, size: int, editor_dir: Path) -> Image.Image:
    script = editor_dir / "scripts" / "render-icon-svg.mjs"
    tmp = editor_dir / "src-tauri" / "icons" / ".icon-render-tmp.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["node", str(script), str(svg_path.resolve()), str(size), str(tmp)]
    r = subprocess.run(cmd, cwd=editor_dir, capture_output=True, text=True)
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "").strip()
        raise RuntimeError(
            "Rasterizzazione SVG fallita (serve `npm install` in editor/ per sharp). "
            + err
        )
    try:
        return Image.open(tmp).convert("RGBA")
    finally:
        if tmp.is_file():
            tmp.unlink()


def rounded_anthracite_square(side: int) -> Image.Image:
    radius = max(4, int(side * CORNER_RADIUS_RATIO))
    canvas = Image.new("RGBA", (side, side), BG_RGBA)
    mask = Image.new("L", (side, side), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, side, side), radius=radius, fill=255)
    canvas.putalpha(mask)
    return canvas


def luminance_glyph_bbox(im: Image.Image, min_luma: int = GLYPH_LUMA_THRESHOLD) -> tuple[int, int, int, int]:
    """BBox of pixels brighter than the dark squircle background (A + C)."""
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 32 and max(r, g, b) > min_luma:
                xs.append(x)
                ys.append(y)
    if not xs:
        return 0, 0, w - 1, h - 1
    return min(xs), min(ys), max(xs), max(ys)


def ready_monolith_from_png(
    src: Image.Image,
    side: int,
    glyph_fill: float = DEFAULT_GLYPH_FILL,
) -> Image.Image:
    """
    Ready-made squircle icon (no wordmark): keep frame/background, scale up A+C for taskbar legibility.
    """
    base = src.convert("RGBA")
    if base.size != (side, side):
        base = base.resize((side, side), Image.Resampling.LANCZOS)

    x1, y1, x2, y2 = luminance_glyph_bbox(base)
    glyph = base.crop((x1, y1, x2 + 1, y2 + 1))
    bg_pixel = base.getpixel((max(0, int(side * 0.06)), max(0, int(side * 0.06))))

    out = base.copy()
    pad = max(6, int(side * 0.015))
    patch = Image.new("RGBA", (x2 - x1 + 1 + 2 * pad, y2 - y1 + 1 + 2 * pad), bg_pixel)
    out.paste(patch, (x1 - pad, y1 - pad), patch)

    target = int(side * max(0.55, min(0.94, glyph_fill)))
    scale = min(target / max(1, glyph.width), target / max(1, glyph.height))
    nw = max(1, int(glyph.width * scale))
    nh = max(1, int(glyph.height * scale))
    big = glyph.resize((nw, nh), Image.Resampling.LANCZOS)
    out.alpha_composite(big, ((side - nw) // 2, (side - nh) // 2))
    return out


def crop_glyph_from_brand_png(src: Image.Image) -> Image.Image:
    """Strip wordmark from full brand lockup (glyph in upper ~72% of square art)."""
    im = src.convert("RGBA")
    w, h = im.size
    top = 0
    bottom = int(h * 0.72)
    left = int(w * 0.06)
    right = int(w * 0.94)
    return im.crop((left, top, right, bottom))


def compose_monolith_from_glyph(glyph: Image.Image, side: int) -> Image.Image:
    glyph = glyph.convert("RGBA")
    bg = rounded_anthracite_square(side)
    gw, gh = glyph.size
    # Massive glyph: ~94% of canvas short edge
    target = int(side * 0.94)
    scale = target / max(gw, gh)
    nw = max(1, int(gw * scale))
    nh = max(1, int(gh * scale))
    resized = glyph.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (side - nw) // 2
    y = (side - nh) // 2
    bg.alpha_composite(resized, (x, y))
    return bg


def load_master_image(
    svg_path: Path | None,
    png_path: Path | None,
    side: int,
    editor_dir: Path,
    *,
    ready_monolith: bool,
    glyph_fill: float,
) -> Image.Image:
    if svg_path is not None:
        return render_svg_rgba(svg_path, side, editor_dir)
    if png_path is None:
        raise ValueError("Specificare --svg o --source")
    src = Image.open(png_path)
    if png_path.suffix.lower() == ".svg":
        return render_svg_rgba(png_path, side, editor_dir)
    if ready_monolith:
        return ready_monolith_from_png(src, side, glyph_fill)
    glyph = crop_glyph_from_brand_png(src)
    return compose_monolith_from_glyph(glyph, side)


def resize_icon(master: Image.Image, side: int) -> Image.Image:
    if master.size == (side, side):
        return master.copy()
    return master.resize((side, side), Image.Resampling.LANCZOS)


def save_windows_ico(sizes: dict[int, Image.Image], out_path: Path) -> None:
    order = list(ICO_SIZES)
    base = sizes[order[0]].convert("RGBA")
    rest = [sizes[s].convert("RGBA") for s in order[1:]]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(
        out_path,
        format="ICO",
        sizes=[(s, s) for s in order],
        append_images=rest,
    )


def write_png_sizes(master: Image.Image, icons_dir: Path) -> None:
    master.save(icons_dir / "app-icon.png")
    resize_icon(master, 256).save(icons_dir / "icon.png")
    for size in ICO_SIZES:
        resize_icon(master, size).save(icons_dir / f"{size}x{size}.png")
    # Tauri bundle entries
    resize_icon(master, 32).save(icons_dir / "32x32.png")
    resize_icon(master, 128).save(icons_dir / "128x128.png")
    resize_icon(master, 256).save(icons_dir / "128x128@2x.png")


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera icone monolitiche ArtCade da SVG")
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="PNG sorgente (default: scripts/assets/app-icon-source.png)",
    )
    parser.add_argument(
        "--svg",
        type=Path,
        default=None,
        help="Usa SVG al posto del PNG (es. scripts/assets/app-icon-monolith.svg)",
    )
    parser.add_argument(
        "--fill",
        type=float,
        default=DEFAULT_GLYPH_FILL,
        help="Quanto riempie il glifo A+C nel riquadro (default: 0.86)",
    )
    parser.add_argument(
        "--legacy-lockup",
        action="store_true",
        help="PNG con wordmark: ritaglia solo il glifo e ricompone su sfondo",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=MASTER_SIZE,
        help=f"Risoluzione master raster (default: {MASTER_SIZE})",
    )
    parser.add_argument(
        "--skip-tauri",
        action="store_true",
        help="Non eseguire npx tauri icon (solo PNG/ICO locali)",
    )
    parser.add_argument(
        "--no-favicon",
        action="store_true",
        help="Non copiare favicon in public/",
    )
    args = parser.parse_args()

    editor_dir = Path(__file__).resolve().parent.parent
    icons_dir = editor_dir / "src-tauri" / "icons"
    assets_dir = Path(__file__).resolve().parent / "assets"
    default_png = assets_dir / "app-icon-source.png"
    default_svg = assets_dir / "app-icon-monolith.svg"

    svg_path: Path | None = None
    png_path: Path | None = None
    ready_monolith = not args.legacy_lockup

    if args.svg is not None:
        svg_path = args.svg.resolve()
        if not svg_path.is_file():
            print(f"SVG non trovato: {svg_path}", file=sys.stderr)
            return 1
    else:
        png_path = (args.source or default_png).resolve()
        if not png_path.is_file():
            print(f"Sorgente non trovata: {png_path}", file=sys.stderr)
            return 1

    try:
        master = load_master_image(
            svg_path,
            png_path,
            args.size,
            editor_dir,
            ready_monolith=ready_monolith,
            glyph_fill=args.fill,
        )
    except Exception as exc:
        print(f"Errore rendering icona: {exc}", file=sys.stderr)
        return 1

    icons_dir.mkdir(parents=True, exist_ok=True)
    write_png_sizes(master, icons_dir)

    ico_images = {s: resize_icon(master, s) for s in ICO_SIZES}
    save_windows_ico(ico_images, icons_dir / "icon.ico")

    print(f"Master PNG: {icons_dir / 'app-icon.png'} ({args.size}×{args.size})", flush=True)
    print(f"icon.png:   {icons_dir / 'icon.png'} (256×256)", flush=True)
    print(f"icon.ico:   {icons_dir / 'icon.ico'} (layers: {', '.join(map(str, ICO_SIZES))})", flush=True)

    if args.skip_tauri:
        if not args.no_favicon:
            _copy_favicons(editor_dir, icons_dir)
        return 0

    rel_icon = (icons_dir / "app-icon.png").relative_to(editor_dir).as_posix()
    out_rel = "src-tauri/icons"
    cmd_str = f'npx tauri icon "{rel_icon}" -o "{out_rel}"'
    print("Eseguo:", cmd_str, f"(cwd={editor_dir})", flush=True)
    r = subprocess.run(cmd_str, cwd=editor_dir, shell=True)
    if r.returncode != 0:
        return r.returncode

    # Re-apply our ICO (tauri icon may use different layer set)
    save_windows_ico(ico_images, icons_dir / "icon.ico")
    resize_icon(master, 256).save(icons_dir / "icon.png")

    if not args.no_favicon:
        _copy_favicons(editor_dir, icons_dir)

    return 0


def _copy_favicons(editor_dir: Path, icons_dir: Path) -> None:
    public = editor_dir / "public"
    public.mkdir(parents=True, exist_ok=True)
    fav_png = icons_dir / "32x32.png"
    if fav_png.is_file():
        shutil.copy2(fav_png, public / "favicon.png")
        print(f"Favicon: {public / 'favicon.png'}", flush=True)
    fav_ico = icons_dir / "icon.ico"
    if fav_ico.is_file():
        shutil.copy2(fav_ico, public / "favicon.ico")
        print(f"Favicon: {public / 'favicon.ico'}", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())

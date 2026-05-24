# -*- coding: utf-8 -*-
"""
Prepara l'icona quadrata da ico_256x256.png (root repo) e genera il set completo per Tauri
(PNG, ICO, ICNS, Windows Store, Android, iOS) tramite `npx tauri icon`.

Richiede: Pillow, Node.js, @tauri-apps/cli (devDependency dell'editor).

Uso dalla cartella editor:
  python scripts/build_app_icons.py

Opzioni:
  python scripts/build_app_icons.py --source ../altro.png
  python scripts/build_app_icons.py --size 1024 --skip-tauri   # solo PNG quadrato
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Installa Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)


def letterbox_to_square(im: Image.Image, side: int) -> Image.Image:
    """Adatta l'immagine in un canvas quadrato (trasparente) e ridimensiona a side x side."""
    im = im.convert("RGBA")
    w, h = im.size
    box = max(w, h)
    canvas = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    canvas.paste(im, ((box - w) // 2, (box - h) // 2))
    return canvas.resize((side, side), Image.Resampling.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera icone app ArtCade da ico_256x256.png")
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="PNG sorgente (default: ../ico_256x256.png rispetto alla cartella editor)",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=1024,
        help="Lato del PNG quadrato passato a tauri icon (default: 1024)",
    )
    parser.add_argument(
        "--skip-tauri",
        action="store_true",
        help="Non eseguire npx tauri icon (solo crea app-icon.png)",
    )
    parser.add_argument(
        "--no-favicon",
        action="store_true",
        help="Non copiare favicon in public/",
    )
    args = parser.parse_args()

    editor_dir = Path(__file__).resolve().parent.parent
    icons_dir = editor_dir / "src-tauri" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)

    source = args.source
    if source is None:
        source = editor_dir.parent / "ico_256x256.png"
    source = source.resolve()
    if not source.is_file():
        print(f"Sorgente non trovata: {source}", file=sys.stderr)
        return 1

    square_path = icons_dir / "app-icon.png"
    img = Image.open(source)
    square = letterbox_to_square(img, args.size)
    square.save(square_path)
    print(f"PNG quadrato ({args.size}x{args.size}): {square_path}", flush=True)

    if args.skip_tauri:
        return 0

    rel_icon = square_path.relative_to(editor_dir).as_posix()
    out_rel = "src-tauri/icons"
    # Su Windows `npx` è uno shim .cmd: serve shell=True.
    cmd_str = f'npx tauri icon "{rel_icon}" -o "{out_rel}"'
    print("Eseguo:", cmd_str, f"(cwd={editor_dir})", flush=True)
    r = subprocess.run(cmd_str, cwd=editor_dir, shell=True)
    if r.returncode != 0:
        return r.returncode

    if not args.no_favicon:
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

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

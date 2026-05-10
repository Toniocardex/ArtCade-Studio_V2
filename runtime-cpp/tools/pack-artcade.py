#!/usr/bin/env python3
# =============================================================================
# pack-artcade.py — Pack a project directory into a .artcade ZIP archive
#
# Usage:
#   python tools/pack-artcade.py <project_dir> <output.artcade>
#
# The produced archive contains:
#   manifest.json          — version, creation timestamp, file checksums
#   project.json           — game config, entities, scenes
#   scripts/               — Lua source files (*.lua)
#   assets/                — sprites, audio, fonts (if present)
#
# Directories excluded from packing: logs/, __pycache__/, .git/
# =============================================================================

import argparse
import hashlib
import json
import os
import sys
import zipfile
from datetime import datetime, timezone


EXCLUDED_DIRS  = {"logs", "__pycache__", ".git", ".vs", "build", "node_modules"}
EXCLUDED_FILES = {".DS_Store", "Thumbs.db"}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files(src_dir: str) -> list[tuple[str, str]]:
    """Return list of (absolute_path, archive_relative_path) for all packable files."""
    files = []
    for root, dirs, filenames in os.walk(src_dir):
        # Prune excluded directories in-place
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        for fname in sorted(filenames):
            if fname in EXCLUDED_FILES:
                continue
            full = os.path.join(root, fname)
            rel  = os.path.relpath(full, src_dir).replace("\\", "/")
            files.append((full, rel))
    return files


def build_manifest(src_dir: str, files: list[tuple[str, str]]) -> dict:
    proj_path = os.path.join(src_dir, "project.json")
    proj_name    = "Unknown"
    proj_version = "1.0.0"
    if os.path.exists(proj_path):
        with open(proj_path, encoding="utf-8") as f:
            proj = json.load(f)
        proj_name    = proj.get("projectName", proj_name)
        proj_version = proj.get("version",     proj_version)

    checksums = {rel: sha256_file(full) for full, rel in files}

    return {
        "format":         "artcade",
        "version":        "2.0.0",
        "projectName":    proj_name,
        "projectVersion": proj_version,
        "created":        datetime.now(timezone.utc).isoformat(),
        "files":          checksums,
    }


def pack(src_dir: str, out_path: str) -> bool:
    src_dir = os.path.abspath(src_dir)

    if not os.path.isdir(src_dir):
        print(f"[FAIL] Source directory not found: {src_dir}", file=sys.stderr)
        return False

    if not os.path.exists(os.path.join(src_dir, "project.json")):
        print(f"[FAIL] project.json not found in: {src_dir}", file=sys.stderr)
        return False

    files = collect_files(src_dir)
    if not files:
        print("[FAIL] No files found to pack", file=sys.stderr)
        return False

    manifest      = build_manifest(src_dir, files)
    manifest_json = json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8")

    out_dir = os.path.dirname(os.path.abspath(out_path))
    os.makedirs(out_dir, exist_ok=True)

    with zipfile.ZipFile(out_path, "w",
                         compression=zipfile.ZIP_DEFLATED,
                         compresslevel=6) as zf:
        # manifest.json first (convention: always entry #0)
        zf.writestr("manifest.json", manifest_json)
        for full, rel in files:
            zf.write(full, rel)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"[OK]  {len(files) + 1} files packed → {out_path}  ({size_kb:.1f} KB)")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Pack a project directory into a .artcade ZIP archive"
    )
    parser.add_argument("src_dir", help="Project source directory (must contain project.json)")
    parser.add_argument("output",  help="Output .artcade file path")
    args = parser.parse_args()

    return 0 if pack(args.src_dir, args.output) else 1


if __name__ == "__main__":
    sys.exit(main())

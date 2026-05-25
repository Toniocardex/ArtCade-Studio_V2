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
# Excluded directories and files are listed in EXCLUDED_DIRS / EXCLUDED_FILES /
# EXCLUDED_EXTENSIONS below. The goal is to keep build artefacts, IDE caches,
# and prior .artcade outputs from bloating the bundle (and from making the
# pack non-deterministic between rebuilds).
# =============================================================================

import argparse
import fnmatch
import hashlib
import json
import os
import sys
import zipfile
from datetime import datetime, timezone


EXCLUDED_DIRS = {
    # VCS / IDE / OS metadata
    ".git", ".hg", ".svn", ".vs", ".vscode", ".idea", ".DS_Store",
    # Python / Node / Rust / CMake caches and build outputs
    "__pycache__", "node_modules", "target",
    "build", "build-native", "build-wasm", "build-msvc", "build-nmake",
    "out", "dist", "cmake-build-debug", "cmake-build-release",
    # Editor scaffolding sometimes co-located with sample projects
    "editor", "src-tauri", "runtime-cpp",
    # Misc
    "logs",
}
EXCLUDED_FILES = {
    ".DS_Store", "Thumbs.db",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
}
# Glob patterns matched against the file BASENAME (so users can also drop
# stray .log / .artcade files at the project root without bloating the pack).
EXCLUDED_PATTERNS = ("*.log", "*.artcade", "*.tmp", "*.bak", "*~")


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_excluded_file(fname: str) -> bool:
    if fname in EXCLUDED_FILES:
        return True
    return any(fnmatch.fnmatch(fname, pat) for pat in EXCLUDED_PATTERNS)


def collect_files(src_dir: str) -> list[tuple[str, str]]:
    """Return list of (absolute_path, archive_relative_path) for all packable files."""
    files = []
    for root, dirs, filenames in os.walk(src_dir):
        # Prune excluded directories in-place
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        for fname in sorted(filenames):
            if _is_excluded_file(fname):
                continue
            full = os.path.join(root, fname)
            rel  = os.path.relpath(full, src_dir).replace("\\", "/")
            files.append((full, rel))
    return files


def project_value(project: dict, camel: str, snake: str, default):
    return project.get(camel, project.get(snake, default))


def load_project(src_dir: str) -> dict | None:
    proj_path = os.path.join(src_dir, "project.json")
    if not os.path.exists(proj_path):
        return None
    try:
        with open(proj_path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[FAIL] Invalid project.json: {exc}", file=sys.stderr)
        return None


def validate_project(src_dir: str, project: dict) -> bool:
    main_script = project_value(project, "mainScriptPath", "main_script_path", "scripts/main.luac")
    if not isinstance(main_script, str) or not main_script.strip():
        print("[FAIL] mainScriptPath must be a non-empty string", file=sys.stderr)
        return False

    normalized = main_script.replace("\\", "/").lstrip("/")
    full = os.path.abspath(os.path.join(src_dir, normalized))
    root = os.path.abspath(src_dir)
    # commonpath raises ValueError when paths live on different drives
    # (Windows). Treat that as "escapes root" rather than crashing.
    try:
        inside = os.path.commonpath([root, full]) == root
    except ValueError:
        inside = False
    if not inside:
        print(f"[FAIL] mainScriptPath escapes project root: {main_script}", file=sys.stderr)
        return False
    if not os.path.exists(full):
        print(f"[FAIL] mainScriptPath not found: {main_script}", file=sys.stderr)
        return False

    return True


def build_manifest(project: dict, files: list[tuple[str, str]]) -> dict:
    proj_name    = project_value(project, "projectName", "project_name", "Unknown")
    proj_version = project.get("version", "1.0.0")
    license_tier = project_value(project, "licenseTier", "license_tier", "free")
    if license_tier not in {"free", "pro"}:
        license_tier = "free"

    checksums = {rel: sha256_file(full) for full, rel in files}

    return {
        "format":         "artcade",
        "version":        "2.0.0",
        "projectName":    proj_name,
        "projectVersion": proj_version,
        "licenseTier":    license_tier,
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
    project = load_project(src_dir)
    if project is None:
        return False
    if not validate_project(src_dir, project):
        return False

    files = collect_files(src_dir)
    if not files:
        print("[FAIL] No files found to pack", file=sys.stderr)
        return False

    manifest      = build_manifest(project, files)
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
    print(f"[OK]  {len(files) + 1} files packed -> {out_path}  ({size_kb:.1f} KB)")
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

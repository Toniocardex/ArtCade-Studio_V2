# ArtCade Studio — Qt editor

**Product UI:** `artcade-editor-qt` (Qt 6.8 Quick/QML) + `artcade_editor_core` (C++).  
**React/Tauri:** removed (2026-07-15). Do not reintroduce a dual editor path.

## Locked decisions

| Item | Value |
|---|---|
| Qt | **6.8.3 LTS** Community (`win64_msvc2022_64`) |
| Kit | `C:\Qt\6.8.3\msvc2022_64` (see `.qt-prefix.path`) |
| License | LGPL v3 + dynamic DLLs — [qt-lgpl-compliance.md](qt-lgpl-compliance.md) |
| Project format | **C++-owned** (`formatVersion` **5**). React v4 is not supported. |
| Authority | Single `ProjectDoc` in `EditorCoordinator` |
| Play | **Separate** native `game.exe` process (Raylib). Never mutates `ProjectDoc`. |

## Architecture guardrails (do not violate)

1. **One ProjectDoc** — only `EditorCoordinator` mutates persisted authoring data (commands + undo).
2. **QML is intents/IDs only** — no document copies, no dual sync.
3. **Workspace ≠ dirty** — selection, active layer, pan/zoom do not bump revision.
4. **Play ≠ authoring** — Play reads the **on-disk** project directory via `game.exe <dir>`; if dirty, user must **Save** first. No write-back from the play process into `ProjectDoc`.
5. **Qt owns the editor window** — Raylib is not embedded in QML; Play opens its own window.

## Layout

```
src/application/   artcade_editor_core (commands, load/save, dirty)
src/qt/            Qt adapter + artcade-editor-qt (+ PlayProcessHost)
qml/ArtCade/       QML presentation only
tests/fixtures/    Editor fixtures (format 5)
runtime-cpp/       Game runtime (Raylib / WASM) — not the authoring UI
dist/wasm/         WASM build copy target (from build_wasm.bat)
```

## Build & run (Windows)

```powershell
powershell -File .\scripts\install-qt-6.8.ps1   # once
$env:ARTCADE_QT_PREFIX = (powershell -File .\scripts\resolve-qt-prefix.ps1)
cmake -S . -B build-qt -G "Visual Studio 18 2026" -A x64 `
  -DARTCADE_BUILD_QT_EDITOR=ON `
  "-DCMAKE_PREFIX_PATH=$env:ARTCADE_QT_PREFIX" `
  "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
cmake --build build-qt --config Release --target artcade-editor-qt
powershell -File .\scripts\run-artcade-editor-qt.ps1
```

`ARTCADE_BUILD_QT_EDITOR` defaults to **ON** on native Windows.  
Building `artcade-editor-qt` also builds `game` and copies `game.exe` beside the editor for Play.  
Override: `$env:ARTCADE_GAME_EXE = "D:\path\to\game.exe"`.

## MVP slice (current)

Open / Fixture → Hierarchy → Select → Rename / SetPosition → Layers/Assets → Scene View (pick/drag) → Save → **Play** (`game.exe`) → unsaved close guard.

Next (Qt only): Logic Board, Script, packaging/LGPL notices.  
Done: shell + Hierarchy + Layers/Assets + Scene View + Play process host.

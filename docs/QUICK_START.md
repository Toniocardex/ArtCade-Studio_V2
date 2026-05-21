# ArtCade V2: Quick Start Guide

> Last updated: 2026-05-20  
> Status: MVP integrated

## Prerequisites

- Node.js/npm installed for the React editor.
- CMake 3.20+.
- Windows native build: Visual Studio Build Tools / MSVC.
- WASM build: Emscripten SDK active, plus the MSVC environment used by `runtime-cpp\build_wasm.bat`.
- Git.

The repo already vendors or configures the runtime third-party dependencies used by CMake. Do not clone Raylib/Lua/Sol2 manually unless the repository is missing them.

## Frontend / Editor

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"
npm run build
```

Run the Tauri editor:

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2\editor"
npm run tauri:dev
```

Inside the editor:

- `File -> Open Project` loads a `project.json`.
- `Save Project` writes the normalized `ProjectDoc`.
- `PACK .ARTCADE` writes a package through `runtime-cpp/tools/pack-artcade.py`.
- `BUILD .EXE` builds the native runtime and creates a runnable bundle.

Native build output from the editor:

```text
runtime-cpp\build-msvc\src\app\game.exe
runtime-cpp\build-msvc\src\app\game.artcade
```

Both files must stay in the same folder for double-click launch.

## Native Runtime

From a Developer Command Prompt or an equivalent MSVC environment:

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"
cmake -S runtime-cpp -B runtime-cpp\build-msvc -DARTCADE_BUILD_TESTS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build runtime-cpp\build-msvc --config Release
ctest --test-dir runtime-cpp\build-msvc --output-on-failure
```

Run a loose project:

```powershell
runtime-cpp\build-msvc\src\app\game.exe runtime-cpp\test-project
```

Run a packed project from the app output folder:

```powershell
cd runtime-cpp\build-msvc\src\app
.\game.exe
```

The no-argument run expects `game.artcade` next to `game.exe`.

## WASM Runtime

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"
runtime-cpp\build_wasm.bat
```

The script builds Emscripten output and copies:

```text
editor\public\runtime\game.js
editor\public\runtime\game.wasm
editor\public\runtime\game.data
```

The editor preview loads those files from `/runtime/`.

## Packaging

```powershell
python runtime-cpp\tools\pack-artcade.py runtime-cpp\test-project runtime-cpp\build-msvc\src\app\game.artcade
```

The package contains `manifest.json`, `project.json`, scripts/assets when present, checksums and `licenseTier` with default `free`.

## Current Architecture Notes

- The editor and runtime share `ProjectDoc`.
- The preview canvas is a black box; React talks to WASM through imperative bridge calls and buffered callbacks.
- Runtime entity access goes through `RuntimeEntityGateway` → `EntityRegistry` (EnTT-backed). Scene lists live in `SceneManager`.
- CodeMirror runs in an iframe to avoid editor flicker and keep the Tauri CSP safe.

## Next Work

- Harden arbitrary image asset import for packaged/WASM runtime.
- Expose WASM build from the editor UI.
- Add Lua diagnostics/markers in the CodeMirror iframe.
- Add structured undo/redo for editor operations.

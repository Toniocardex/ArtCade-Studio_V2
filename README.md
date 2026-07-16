# ArtCade V2

**Qt Studio editor** + **C++ dual-runtime** (native Raylib + WebAssembly).

## Vision

1. **Editor** — Qt 6.8 Quick/QML (`artcade-editor-qt`) over C++ `artcade_editor_core`
2. **Native Runtime** — C++ + Raylib → Windows/macOS/Linux
3. **Web Runtime** — same C++ via Emscripten → `.wasm`

React/Tauri has been **removed**. Do not reintroduce a second authoring UI.

## Architecture

```
QML (presentation)
    ↓ intents / stable IDs
Qt adapter (EditorSession, models)
    ↓
artcade_editor_core (ProjectDoc, Commands, load/save)
    ↓
project.json (formatVersion 5, C++-owned)
    ↓
C++ Runtime (native .exe / WASM)
```

## Project Structure

```
ArtCade-Studio_V2/
├── src/application/     # artcade_editor_core
├── src/qt/              # artcade-editor-qt
├── qml/ArtCade/         # QML UI
├── runtime-cpp/         # Game engine
├── tests/fixtures/      # Editor fixtures
├── dist/wasm/           # WASM copy output (build_wasm.bat)
├── docs/qt-migration/   # Editor build + LGPL notes
├── scripts/             # Qt install / run helpers
└── CMakeLists.txt
```

## Quick start (Windows)

```powershell
powershell -File .\scripts\install-qt-6.8.ps1
cmake -S . -B build-qt -G "Visual Studio 18 2026" -A x64 `
  "-DCMAKE_PREFIX_PATH=C:/Qt/6.8.3/msvc2022_64" `
  "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
cmake --build build-qt --config Release --target artcade-editor-qt
powershell -File .\scripts\run-artcade-editor-qt.ps1
```

Runtime-only:

```powershell
npm run build:cpp
npm run build:wasm
```

## Documentation

- Editor / Qt: [docs/qt-migration/README.md](docs/qt-migration/README.md)
- Agent rules: [`.cursor/rules/cursorrules-artcade.mdc`](.cursor/rules/cursorrules-artcade.mdc)
- Architecture: [AGENTS.md](AGENTS.md), [docs/README.md](docs/README.md)

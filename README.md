# ArtCade V2

**Dual-Runtime 2D Game Engine**: TypeScript Editor + C++ Native Runtime + WebAssembly

## Vision

ArtCade V2 is a complete redesign focused on **solid software architecture** with two execution targets:

1. **Native Runtime** (C++ + Raylib) → Windows/macOS/Linux executables
2. **Web Runtime** (C++ compiled to WASM via Emscripten) → Browser + Tauri preview

Same codebase, compiled twice, deterministic Lua scripting logic.

## Architecture

```
Editor (React + Tauri)
    ↓ (.artcade project file)
    ├─→ C++ Runtime (Windows .exe)
    ├─→ WASM Runtime (Browser via Emscripten)
    └─→ Tauri Preview (WASM in WebView)
```

## Project Structure

```
ArtCade V2/
├── editor/              # React TypeScript editor + Tauri
│   ├── src/             # panels, store, wasm-bridge, CodeMirror iframe
│   ├── public/runtime/  # game.js + game.wasm (preview; .wasm gitignored)
│   └── package.json
│
├── runtime-cpp/         # C++ game engine (dual-compile)
│   ├── src/modules/     # renderer, physics, lua-runtime, editor-api, …
│   ├── test-project/    # Demo project (project.json, scripts)
│   ├── build_wasm.bat   # WASM → editor/public/runtime/
│   ├── CMakeLists.txt
│   └── build-*/         # CMake output (gitignored)
│
├── docs/                # Architecture & design (see docs/README.md)
├── UI/                  # Design mockups (reference PNGs)
├── CLAUDE.md            # Development guidelines
├── .gitignore
└── CMakeLists.txt       # Root build config
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Editor UI** | React 19 + TailwindCSS + TypeScript | Logic Board, inspector, timeline |
| **Editor Bridge** | Tauri (Rust) | File I/O, system integration, preview |
| **Game Engine** | C++ (C++17) | Core game loop, deterministic |
| **Graphics** | Raylib (C) | 2D rendering (native + WASM) |
| **Physics** | Box2D 2.4 (C++) | 2D collisions, rigid bodies |
| **Scripting** | Lua 5.4 + Sol2 | Game logic (bytecode compiled) |
| **Audio** | Raylib Audio (OpenAL) | Sound, music |
| **Build (Native)** | CMake + MSVC/GCC/Clang | Windows/Linux/macOS .exe |
| **Build (Web)** | Emscripten | C++ → .wasm/.js |
| **Distribution** | .artcade (ZIP) | Project package (scripts + assets) |

## Documentation

- **Index (all docs):** [docs/README.md](docs/README.md)
- **Engine integration roadmap:** [docs/ENGINE_INTEGRATION_ROADMAP.md](docs/ENGINE_INTEGRATION_ROADMAP.md)
- **Splash screen & Free/Pro licenses (editor + export + runtime):** [docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md](docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md)
- **End-to-end integration:** [docs/ARCHITECTURE_INTEGRATION.md](docs/ARCHITECTURE_INTEGRATION.md)
- **Global logic & UI (sensors, platformer feel, world UI, text juice):** [docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md](docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md)

## Getting Started

```powershell
cd "C:\Users\Antonio\Desktop\ArtCade V2"

# Frontend build + schema validators
npm run build

# Tauri desktop app
cd editor
npm run tauri:dev
```

Native runtime and WASM builds require the matching local toolchain:

```powershell
# Native runtime: MSVC / CMake environment
cmake -S runtime-cpp -B runtime-cpp\build-msvc -DARTCADE_BUILD_TESTS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build runtime-cpp\build-msvc --config Release

# WASM runtime: MSVC + EMSDK environment
runtime-cpp\build_wasm.bat
```

`BUILD .EXE` in the editor produces the runnable native bundle under:

`runtime-cpp\build-msvc\src\app\game.exe` + `runtime-cpp\build-msvc\src\app\game.artcade`

## Current Status

- Runtime C++ MVP: complete native/WASM loop, Lua 5.4, Raylib, Box2D, asset loader, `.artcade` package loading.
- Editor MVP: React/Tauri app, project open/save, script save, Logic Board, Scene Editor, asset import, console copy, dark/light theme.
- Preview: WASM canvas is treated as a black box; React communicates through imperative bridge functions and buffered callbacks.
- Logic Board: entity-first authoring, schema-driven forms, Ajv build-time validators for Tauri CSP, Lua compiler, runtime APIs for spawn/sensor/lifecycle/shaders.
- Export: deterministic packer with `manifest.json`, `project.json`, scripts/assets, `licenseTier`, and native runnable bundle.

## Roadmap

Historical roadmap is tracked in [ROADMAP_INTEGRATIVA.md](ROADMAP_INTEGRATIVA.md). The next useful work is:

- Asset pipeline hardening for arbitrary imported images in packaged/WASM runtime.
- Build WASM action exposed directly from the editor UI.
- Lua diagnostics/markers inside the CodeMirror iframe.
- Structured undo/redo for transform, tile painting, scene/objects panel and Logic Board edits.
- Steamworks/no-op integration in a later release phase.

## License

GPL-3.0-or-later

---

**Status**: MVP integration / release polish  
**Started**: 2026-05-09  
**Last updated**: 2026-05-20

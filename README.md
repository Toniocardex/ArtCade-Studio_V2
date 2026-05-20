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
- **Splash screen & Free/Pro licenses (editor + export + runtime):** [docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md](docs/GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md)
- **End-to-end integration:** [docs/ARCHITECTURE_INTEGRATION.md](docs/ARCHITECTURE_INTEGRATION.md)
- **Global logic & UI (sensors, platformer feel, world UI, text juice):** [docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md](docs/GLOBAL_LOGIC_UI_ARCHITECTURE.md)

## Getting Started

(Coming soon in CLAUDE.md)

## Roadmap

- **Week 1-2**: Architecture finalization, CMake setup
- **Week 3-6**: C++ engine core (Raylib loop, physics, Lua host)
- **Week 7-9**: WASM build, Emscripten integration
- **Week 10-12**: Editor integration, polish, testing

## License

GPL-3.0-or-later

---

**Status**: Initialization phase  
**Started**: 2026-05-09

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
├── editor/              # React TypeScript editor
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── panels/      # Inspector, LogicBoard, etc.
│   │   └── utils/
│   ├── public/
│   └── package.json
│
├── runtime-cpp/         # C++ game engine (dual-compile)
│   ├── src/
│   │   ├── engine/      # Core: renderer, physics, input, audio
│   │   ├── game/        # Game state, entity manager
│   │   ├── steam/       # Steam integration (future)
│   │   └── utils/
│   ├── libs/            # Third-party (raylib, lua, sol2, …); Box2D via FetchContent nel modulo physics
│   ├── CMakeLists.txt   # Build config (Win + Emscripten)
│   └── build/
│
├── runtime-wasm/        # WASM build target (Emscripten output)
│   ├── src/             # TypeScript glue layer (minimal)
│   └── build/
│
├── docs/                # Architecture, design docs
│   └── ARCHITECTURE_DUAL_RUNTIME.md
│
├── scripts/             # Build, asset packing scripts
├── tools/               # Asset tools, validators
├── .github/workflows/   # CI/CD
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

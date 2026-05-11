# ArtCade V2 Development Guidelines

## Project Vision

**Dual-Runtime 2D Game Engine**: Same C++ codebase compiles to:
- Windows/macOS/Linux native executables (Raylib)
- WebAssembly (Emscripten) for browsers + Tauri preview

Lua 5.4 bytecode as the game logic layer, deterministic and portable.

---

## Key Architectural Decisions

### 1. Raylib + Emscripten (Not Rust/WASM)
**Why**: Raylib is C, born for Emscripten. Write once (C++), compile twice (native .exe + .wasm).
Zero rendering logic rewrite. 99% code identical across targets.

### 2. Fresh Start (No Legacy Code)
**Why**: Old codebase is schema-driven + Logic Board AST. New engine is Lua + Raylib + Sol2.
Mixing them creates technical debt. Cleaner to rewrite.

### 3. Tauri Preview Integration
**Why**: Tauri loads the WASM build inside WebView. What you see in editor preview is
exactly what users see in browser. No sync issues.

### 4. Lua for Game Logic
**Why**: Portable, deterministic, easy Lua<->C++ binding via Sol2. Bytecode compiled.
No Logic Board visual AST complexity.

### 5. .artcade Format (ZIP-based)
**Why**: Single-file distribution, fast web loading, asset encryption (future), version manifest.

---

## Code Organization

### `runtime-cpp/` — Game Engine (C++)

**Language**: C++17 (modern but compatible)  
**Build System**: CMake (generates Windows .exe + Emscripten .wasm)

```
runtime-cpp/
├── src/
│   ├── main.cpp                    # Entry point
│   ├── engine/
│   │   ├── renderer.h/.cpp         # Raylib wrapper
│   │   ├── physics.h/.cpp          # Box2D 2.4 wrapper
│   │   ├── input.h/.cpp            # Keyboard, mouse, gamepad
│   │   ├── audio.h/.cpp            # Raylib audio system
│   │   ├── game-api.h/.cpp         # Lua binding layer (Sol2)
│   │   ├── lua-host.h/.cpp         # Lua VM + bytecode loader
│   │   └── types.h                 # Shared types (Entity, Transform, etc.)
│   ├── game/
│   │   ├── entity-manager.h/.cpp   # Entity pool, instance tracking
│   │   ├── scene-manager.h/.cpp    # Scene loading, active scene
│   │   ├── asset-loader.h/.cpp     # ProjectDoc + .artcade parser
│   │   └── world.h/.cpp            # Main game state container
│   ├── steam/                      # (Future) Steamworks SDK
│   └── utils/
│       ├── json.h/.cpp             # JSON parsing
│       ├── zip.h/.cpp              # .artcade ZIP handling
│       ├── logger.h/.cpp           # Debug logging
│       └── math.h                  # Vector, matrix helpers
├── libs/                           # Third-party source
│   ├── raylib-5.0/
│   ├── lua-5.4/
│   └── (Box2D 2.4 via FetchContent nel modulo physics, non in libs/)
├── CMakeLists.txt                  # Root build config
└── build/                          # Cmake output (gitignored)
```

**Compile Targets**:
- `cmake .. -DCMAKE_BUILD_TYPE=Release` → Windows MSVC → `game.exe`
- `emcmake cmake .. -DCMAKE_TOOLCHAIN_FILE=$EMSDK/cmake/Modules/Platform/Emscripten.cmake` → WASM → `game.js + game.wasm`

### `editor/` — React TypeScript

**Framework**: React 19 + Vite + TailwindCSS  
**Language**: TypeScript

```
editor/
├── src/
│   ├── main.tsx                    # Entry
│   ├── App.tsx                     # Root layout
│   ├── components/
│   │   ├── LogicBoardEditor.tsx    # Lua script editor with syntax highlight
│   │   ├── Inspector.tsx            # Entity/scene properties
│   │   ├── Timeline.tsx             # Sequence timeline
│   │   └── ...
│   ├── panels/
│   │   ├── ScenePanel.tsx
│   │   ├── AssetBrowser.tsx
│   │   └── ...
│   ├── utils/
│   │   ├── api.ts                  # IPC to Tauri
│   │   ├── project.ts              # ProjectDoc utilities
│   │   └── ...
│   └── types/
│       └── index.ts                # Shared types (EntityDef, SceneDef, etc.)
├── public/
└── package.json
```

### `runtime-wasm/` — Emscripten Output

Mostly CMake output. Thin TypeScript glue if needed.

```
runtime-wasm/
├── src/
│   ├── index.ts                    # TypeScript entry (if using)
│   └── index.html                  # HTML template
├── build/                          # CMake Emscripten output
│   ├── game.js
│   ├── game.wasm
│   └── index.html
```

### `docs/` — Design Documentation

```
docs/
├── ARCHITECTURE_DUAL_RUNTIME.md    # Complete architecture spec (50 pages)
├── LUA_GAME_API.md                 # Game API reference (function by function)
├── ASSET_PIPELINE.md               # .artcade format spec
├── BUILD_INSTRUCTIONS.md           # CMake, Emscripten setup
└── DEVELOPER_SETUP.md              # Local dev environment
```

---

## Game Loop Architecture

### Main Loop (C++)

```cpp
// Pseudocode
int main() {
    Engine engine;
    engine.init(projectPath);           // Load ProjectDoc + assets

    Renderer renderer;
    Physics physics;
    LuaHost lua;
    GameAPI api(&renderer, &physics, ...);

    lua.load(engine.getMainScript());   // Load bytecode from .artcade

    while (!shouldExit) {
        // Fixed timestep ~60fps
        float dt = getFrameDelta();
        
        // 1. Input
        Input input = pollInput();
        api.setCurrentInput(input);
        
        // 2. Lua tick
        lua.call("tick", dt);             // Run game logic
        
        // 3. Physics
        physics.step(dt);
        
        // 4. Render
        renderer.beginFrame();
        renderEntities(engine.getActiveScene());
        renderer.endFrame();
    }
    
    engine.shutdown();
    return 0;
}
```

---

## Lua Game API Contract

**Deterministic, no randomness without seeding.**

### Core Functions

```lua
-- Entity & Pool
entity.velocity(entityId)              → {x, y}
entity.setVelocity(entityId, vx, vy)
entity.position(entityId)              → {x, y}
entity.setPosition(entityId, x, y)
entity.destroy(entityId)
pool.getAll(className)                 → [entityId, ...]
pool.count(className)                  → count

-- Collision
collision.overlap(id1, id2)            → bool
collision.raycast(x1, y1, x2, y2)      → {hit, entityId}
collision.touchingClass(entityId, className) → bool

-- Input
input.isKeyDown(keyCode)               → bool
input.wasKeyPressed(keyCode)           → bool
input.wasKeyReleased(keyCode)          → bool

-- Audio
audio.playSound(assetPath, volume, pitch)
audio.playMusic(assetPath, loop)
audio.stopAll()

-- Global State
state.get(key)                         → value
state.set(key, value)
state.add(key, amount)                 → new value

-- Debug
debug.log(msg)
debug.drawLine(x1, y1, x2, y2, color)
```

**Full spec in `docs/LUA_GAME_API.md`**

---

## .artcade File Format

ZIP archive containing:

```
project.artcade (ZIP)
├── manifest.json                    # Version, checksums, metadata
├── game.json                        # Game config (resolution, fps, etc.)
├── project.json                     # Full ProjectDoc (entities, scenes)
├── scripts/
│   ├── main.luac                    # Compiled bytecode
│   └── [scriptId].luac
├── assets/
│   ├── sprites/
│   │   └── [spriteId].png
│   ├── audio/
│   │   └── [audioId].ogg
│   └── fonts/
│       └── [fontId].ttf
└── thumbnails/                      # Editor preview images
    └── [sceneId].png
```

**Loading in C++**:
```cpp
ProjectDoc project;
project.load("path/to/game.artcade");  // Unzip + parse JSON
engine.init(project);
```

---

## Tauri Preview Integration

Editor runs Tauri app which:
1. Compiles C++ to WASM (on save)
2. Loads WASM in embedded WebView
3. Previews game in-editor in real-time

Same WASM binary that users will download = zero surprises.

```
Editor (React)
    ↓ (onSave)
CMake Emscripten compile
    ↓ (game.wasm + game.js)
Load in Tauri WebView
    ↓
Preview panel shows live game
```

---

## Development Workflow

### 1. Setup (Day 1)

```bash
cd "C:\Users\Antonio\Desktop\ArtCade V2"

# Install dependencies
npm install                           # (in editor/)
cargo build --release                # (Tauri)

# Setup C++ toolchain
# - MSVC (Windows)
# - Emscripten SDK
# - CMake

# First CMake build
cd runtime-cpp
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
```

### 2. Iterative Development

```bash
# Terminal 1: Edit C++, rebuild on save
cd runtime-cpp/build
cmake --watch --build .

# Terminal 2: Edit React, rebuild on save
cd editor
npm run dev

# Terminal 3: Run Tauri app (embeds WebView)
cd .
cargo tauri dev
```

### 3. Testing

- **Native**: Run `game.exe` directly, test gameplay
- **Web**: Open `game.html` in browser, test same binary
- **Editor**: Use Tauri preview panel

### 4. Shipping

```bash
# Build for distribution
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Output: game.exe (native) + game.wasm (web)

# Pack .artcade for distribution
./scripts/pack-artcade.sh project-name
# Output: MyGame.artcade (ZIP, signed)
```

---

## Collaboration Notes

- **C++ implementation**: You (primary)
- **Architecture guidance**: Claude (design, code review)
- **React/TypeScript**: You + Claude
- **Build system**: Shared (CMake decisions together)
- **Testing**: You (run locally), Claude (logic verification)

---

## Immediate Next Steps

1. ✅ Project structure created
2. ⏳ Design document: `docs/ARCHITECTURE_DUAL_RUNTIME.md` (in progress)
3. ⏳ CMakeLists.txt template (in progress)
4. ⏳ C++ code skeletons (in progress)
5. ⏳ Lua API specification (in progress)

---

**Status**: Initialization  
**Last Updated**: 2026-05-09  
**Author**: Antonio + Claude

# ArtCade V2 Development Guidelines

**Cursor / AI agents:** delivery pipeline (implement → test → **diff audit** → pre-commit review → commit → builds), pre-commit checks, and code-review format live in [`.cursor/rules/cursorrules-artcade.mdc`](.cursor/rules/cursorrules-artcade.mdc) (canonical; versioned in git). This file covers architecture and repo layout — not step-by-step agent workflow.

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

### 2. Hybrid authoring (Logic Board + Lua + dialogs)
**Why**: Gameplay ships as compiled Lua, but the editor provides a visual Logic Board (JSON schemas → Lua compiler), a script tab, and RPG-style dialog graphs (`dialogs/*.json`). The C++ runtime is Lua + Raylib + Sol2 without the old monolithic AST runtime.

### 3. Tauri Preview Integration
**Why**: Tauri loads the WASM build inside WebView. What you see in editor preview is
exactly what users see in browser. No sync issues.

### 4. Lua for Game Logic
**Why**: Portable, deterministic, easy Lua<->C++ binding via Sol2. Native builds use bytecode; editor preview hot-reloads Lua source via WASM.

### 5. ProjectRuntimeSettings (editor ↔ runtime contract)
**Why**: Preview and native exe must share timing and physics. `editor/src/utils/runtime-fingerprint.ts` (`RuntimeProjectPayload` / fingerprint `fps` + `pm`) mirrors C++ `ProjectRuntimeSettings` in `runtime-cpp/src/core/types.h`, applied by `Application::applyRuntimeSettings()` on load.

### 6. .artcade Format (ZIP-based)
**Why**: Single-file distribution, fast web loading, asset encryption (future), version manifest.

### 7. ProjectDocument as the Authoring Authority
**Why**: ArtCade is an editor, not a loose collection of UI stores. Durable project data must have one owner so save/load, undo/redo, preview sync, migrations, and AI-generated edits cannot drift apart.

- `ProjectDocument` / `ProjectDoc` is the only source of truth for persisted authoring data: scenes, objects, assets, prefab/object types, components, Logic Board data, dialogs, and project settings.
- UI components display snapshots, dispatch commands/intents, and receive updated snapshots. They must not directly mutate durable entities, scenes, assets, prefab/object types, or rulesheets.
- Every persistent authoring change must flow through the command/intent path that validates, updates revision/dirty state, and records undo/redo where appropriate.
- Do not keep two equivalent mutable representations synchronized by hand. If two representations exist, one must be deterministically derived from the other.
- Use stable IDs for objects, scenes, assets, prefab/object types, components, and rulesheets. Names are display labels only and must not be internal keys.
- Duplicate names in the same authoring scope are not allowed for generated objects/prefabs. Block the operation or require an explicit unique name.

### 8. Editor State vs Game State
**Why**: Preview/play must never corrupt authoring data.

- `ProjectDocument` / `ProjectDoc`: saved project data.
- `EditorWorkspaceState`: temporary editor state such as selection, zoom, visible grid, open panels, focus mode, rulers, and tool palette state.
- `PlaySession`: runtime state during play/test.
- `PlaySession` must not write back into `ProjectDocument` unless the user performs an explicit authoring command.
- UI-only toggles, zoom, selection, panel layout, and editor grid visibility must not mark the project dirty or create undo/redo entries.

### 9. Validation, Versioning, and Assets
**Why**: Every entry point into the project model must enforce the same contract.

- Every document mutation must pass centralized schema/validator logic. UI code is not the validity authority.
- Import, paste, AI generation, drag/drop, manual edit, and file load must use the same validation path.
- Every saved `ProjectDocument` carries a `schemaVersion`; every breaking saved-format change requires an explicit migration.
- Silent saved-format changes are forbidden.
- Assets are referenced through registry-backed `AssetRef` / stable asset IDs, not scattered raw paths.
- Import, move, rename, and delete must update the asset registry atomically. Deleting referenced assets requires dependency checks first.

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
│   │   ├── physics.h/.cpp          # Custom 2D physics (collision_math + raymath)
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
│   └── (Physics: custom solver in src/modules/physics; raymath header from libs/raylib)
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
│   │   ├── EngineScriptEditor.tsx  # CodeMirror host (iframe MPA)
│   │   └── ...
│   ├── codemirror-frame/           # Isolated editor document (postMessage)
│   ├── codemirror/                 # Lua mode, theme, completions
│   ├── panels/
│   │   ├── ScriptEditorPanel.tsx
│   │   ├── LogicBoardPanel.tsx     # Visual board + Lua sync → script store
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

### WASM preview bundle

Emscripten output is built under `runtime-cpp/build-wasm/` and copied to `editor/public/runtime/` via `runtime-cpp/build_wasm.bat`. The editor loads `game.js` / `game.wasm` from there (`editor/src/utils/runtime-path.ts`).

### `docs/` — Design Documentation

Full index: **`docs/README.md`** (architecture, Logic Board, CodeMirror, integration, roadmap links). Do not delete files under `docs/`.

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
- **Architecture guidance**: Codex (design, code review)
- **React/TypeScript**: You + Codex
- **Build system**: Shared (CMake decisions together)
- **Testing**: You (run locally), Codex (logic verification)

---

## Immediate Next Steps

1. ✅ Project structure created
2. ✅ Architecture docs (`docs/TECHNICAL_OVERVIEW.md`, `docs/README.md`)
3. ✅ CMakeLists.txt + C++ modules
4. ✅ Lua API + Logic Board compiler
5. ✅ Build pipeline (see root `README.md`)

---

**Status**: Phase 20 - Release Polish (Early Access Prep)  
**Last Updated**: 2026-05-17  
**Current Phase**: 20 (Watermark system + SplashState, release notes, smoke test)  
**Projected Early Access Launch**: 2026-05-21  
**Schedule Status**: 2 weeks ahead of 12-week original roadmap  
**Author**: Antonio + Codex

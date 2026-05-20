# ArtCade V2: Dual-Runtime Architecture

**Version**: 2.0.0  
**Date**: 2026-05-09  
**Author**: Antonio + Claude  
**Status**: Design Document (Implementation Phase)

---

## Table of Contents

1. [Vision & Overview](#vision--overview)
2. [Architecture High-Level](#architecture-high-level)
3. [Core Systems](#core-systems)
4. [Lua Game API Specification](#lua-game-api-specification)
5. [Build System Strategy](#build-system-strategy)
6. [Asset Pipeline (.artcade Format)](#asset-pipeline-artcade-format)
7. [Tauri Preview Integration](#tauri-preview-integration)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Code Structure Reference](#code-structure-reference)

---

## Vision & Overview

### The Problem

ArtCade V1 was:
- Schema-driven (ProjectDoc + Logic Board AST)
- Compiled to JavaScript only
- No native runtime
- Impossible to ship to Steam

### The Solution: Dual-Runtime Architecture

**One codebase, compiled twice:**

1. **C++ Native** (Raylib) → `game.exe` (Windows/macOS/Linux)
2. **WebAssembly** (Emscripten) → `game.wasm + game.js` (Browser)

Same game logic (Lua bytecode), different rendering targets.

### Key Design Principles

- **Write Once**: C++ engine written once, compiles to both targets
- **Deterministic**: Lua bytecode is portable, same behavior everywhere
- **Asset Agnostic**: `.artcade` ZIP loads identically in both runtimes
- **Editor Parity**: Tauri preview runs WASM, so editor shows exact browser experience

---

## Architecture High-Level

```
┌─────────────────────────────────────────────────────────────┐
│                 Game Engine (C++)                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Renderer │  │ Physics  │  │ Input    │  │ Audio    │   │
│  │(Raylib) │  │(Box2D)  │  │(Raylib) │  │(Raylib) │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Game API (Sol2 Lua Bindings)               │  │
│  │  entity.*, pool.*, collision.*, input.*, etc.        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ▲                                  │
│                          │                                  │
│                    ┌─────────────┐                          │
│                    │  Lua VM     │                          │
│                    │ (main.luac) │                          │
│                    └─────────────┘                          │
│                                                              │
│  Main Loop:                                                 │
│    1. Poll input                                            │
│    2. Call lua.tick(dt)                                     │
│    3. Physics.step(dt)                                      │
│    4. Render entities                                       │
└─────────────────────────────────────────────────────────────┘
     │                                                    │
     ▼                                                    ▼
┌─────────────┐                                   ┌──────────────┐
│ WINDOWS EXE │                                   │  WASM BINARY │
│ (Native)    │                                   │  (Browser)   │
│             │                                   │              │
│ Windows/Mac │                                   │  Emscripten  │
│ Linux       │                                   │  + PixiJS    │
│             │                                   │  (optional)  │
└─────────────┘                                   └──────────────┘
```

### Data Flow

```
Editor (React)
    │ (Save project)
    ▼
.artcade file (ZIP)
    │
    ├─→ game.json (config)
    ├─→ project.json (full ProjectDoc)
    ├─→ scripts/main.luac (compiled Lua)
    ├─→ assets/sprites/*.png
    ├─→ assets/audio/*.ogg
    └─→ manifest.json (checksums)
    │
    ├─────────────────────────────────────────────────────┐
    │                                                     │
    ▼                                                     ▼
Runtime-C++                                        Runtime-WASM
(Native .exe)                                  (Emscripten compiled)
    │                                                     │
    ├─ Load .artcade                                      ├─ Load .artcade
    ├─ Initialize Raylib                                  ├─ Initialize PixiJS + Raylib WASM
    ├─ Initialize Box2D                                   ├─ Initialize Box2D (WASM)
    ├─ Load Lua bytecode                                  ├─ Load Lua bytecode
    ├─ Main loop (tick, physics, render)                  ├─ Main loop (RAF, physics, render)
    └─→ Output to screen                                  └─→ Output to Canvas
```

---

## Core Systems

### 1. Renderer (Raylib)

**Responsibility**: 2D rendering via Raylib.

**API**:
```cpp
class Renderer {
    bool init(uint32_t width, uint32_t height, const std::string& title);
    void beginFrame(const glm::vec4& clearColor);
    void endFrame();
    bool shouldClose() const;

    void drawSprite(const AssetId& id, const glm::vec2& pos, float rot,
                    const glm::vec2& scale, const glm::vec4& tint, float alpha);
    void drawRectangle(float x, float y, float w, float h, const glm::vec4& color);
    void drawLine(float x1, float y1, float x2, float y2, const glm::vec4& color);

    uint32_t loadTexture(const std::string& path);
    void unloadTexture(uint32_t handle);
};
```

**Implementation Notes**:
- Raylib is C, use C bindings from `raylib.h`
- On Emscripten, Raylib auto-compiles to WebGL
- Y-sorting handled by render order (entity property)
- Alpha blending via Raylib blend modes

### 2. Physics (Box2D)

**Responsibility**: 2D rigid body physics via Box2D 2.4 (C++, linked via CMake FetchContent).

**API**:
```cpp
class Physics {
    void init(const glm::vec2& gravity);
    void step(float dt, uint32_t substeps = 1);

    uint32_t createBody(EntityId id, const PhysicsComponent& comp);
    void destroyBody(uint32_t handle);

    void setLinearVelocity(uint32_t handle, const glm::vec2& vel);
    glm::vec2 getLinearVelocity(uint32_t handle) const;

    bool areOverlapping(uint32_t h1, uint32_t h2) const;
    RaycastHit raycast(const glm::vec2& from, const glm::vec2& to) const;
};
```

**Implementation Notes**:
- Box2D: include `<box2d/box2d.h>`, `b2World` + bodies/fixtures; same code path native and Emscripten where applicable
- Fixed timestep (deterministic)
- Collider shapes: Rectangle, Circle
- BodyTypes: Dynamic, Static, Kinematic

### 3. Input (Raylib)

**Responsibility**: Keyboard, mouse, gamepad polling.

**API**:
```cpp
class Input {
    void poll();
    bool isKeyDown(const std::string& keyCode) const;      // e.g., "KeyW", "Space"
    bool wasKeyPressed(const std::string& keyCode) const;  // This frame only
    bool wasKeyReleased(const std::string& keyCode) const; // This frame only
};
```

**Implementation Notes**:
- Use Raylib's `IsKeyDown()`, `IsKeyPressed()`, `IsKeyReleased()`
- Map string codes (e.g., "KeyW") to Raylib key codes
- Input state cleared at end of frame (`resetFrameState()`)

### 4. Audio (Raylib)

**Responsibility**: Sound and music playback.

**API**:
```cpp
class Audio {
    void playSound(const std::string& path, float vol, float pitch);
    void playMusic(const std::string& path, bool loop);
    void stopAll();
    void setMasterVolume(float vol);
};
```

**Implementation Notes**:
- Raylib uses OpenAL internally
- Support OGG, WAV formats
- No spatial audio in V1 (2D panning future)

### 5. Lua Host (Sol2)

**Responsibility**: Lua 5.4 VM, bytecode loading, script execution.

**API**:
```cpp
class LuaHost {
    void init(GameAPI* api);
    bool loadBytecode(const std::string& path);
    bool loadBytecodeFromBuffer(const uint8_t* data, size_t size);

    void tick(float deltaTime);  // Call lua.tick(dt)
    void callFunction(const std::string& name, const sol::object& arg = sol::nil);
};
```

**Implementation Notes**:
- Use Sol2 C++ binding library (header-only)
- Compiled Lua bytecode (not text scripts)
- All game logic runs here
- Bindings to GameAPI

### 6. Game API (Sol2 Bindings)

**Responsibility**: Expose engine to Lua scripts.

**Bindings** (via Sol2):
```cpp
// Entity API
api.entity.velocity(id)              → glm::vec2
api.entity.setVelocity(id, vx, vy)
api.entity.position(id)              → glm::vec2
api.entity.setPosition(id, x, y)
api.entity.destroy(id)

// Pool API (class-based queries)
api.pool.getAll(className)           → [id1, id2, ...]
api.pool.count(className)            → number

// Collision API
api.collision.overlap(id1, id2)      → bool
api.collision.touchingClass(id, cls) → bool
api.collision.raycast(x1, y1, x2, y2) → {hit, id, x, y, dist}

// Input API
api.input.isKeyDown(code)            → bool
api.input.wasKeyPressed(code)        → bool
api.input.mousePosition()            → {x, y}

// Audio API
api.audio.playSound(path, vol, pitch)
api.audio.playMusic(path, loop)
api.audio.stopAll()

// State API
api.state.get(key)                   → value
api.state.set(key, value)
api.state.add(key, amount)           → new value

// Debug API
api.debug.log(msg)
api.debug.drawLine(x1, y1, x2, y2, color)
```

**Implementation Notes**:
- Sol2 makes C++ ↔ Lua binding automatic
- All functions return sol::object (Lua-compatible)
- String keys for class/tag filtering

### 7. Entity & World Management

**EntityManager**:
```cpp
class EntityManager {
    EntityId createEntity(const EntityDef& def);
    void destroyEntity(EntityId id);
    EntityDef* getEntity(EntityId id);
    std::vector<EntityId> getPool(const std::string& className) const;
    std::vector<EntityId> getEntitiesByTag(const std::string& tag) const;
};
```

**SceneManager**:
```cpp
class SceneManager {
    void loadScene(const SceneId& id);
    SceneId getActiveSceneId() const;
    SceneDef* getActiveScene();
};
```

**World**:
```cpp
class World {
    void init(const ProjectDoc& doc);
    bool loadScene(const SceneId& id);
    EntityManager& getEntityManager();
    GlobalStateValue getGlobalState(const std::string& key);
    void setGlobalState(const std::string& key, const GlobalStateValue& val);
};
```

---

## Lua Game API Specification

### Complete Function Reference

#### Entity Functions

```lua
-- Get position of entity
x, y = entity.position(entityId)

-- Set position
entity.setPosition(entityId, x, y)

-- Get velocity
vx, vy = entity.velocity(entityId)

-- Set velocity
entity.setVelocity(entityId, vx, vy)

-- Destroy entity
entity.destroy(entityId)

-- Get entity state (custom data)
entity.getState(entityId, key)
entity.setState(entityId, key, value)
```

#### Pool Functions

```lua
-- Get all entities with given className
entities = pool.getAll(className)  -- Returns: {id1, id2, id3, ...}

-- Count entities of class
count = pool.count(className)  -- Returns: integer

-- Example: Move all enemies
for _, enemyId in ipairs(pool.getAll("Enemy")) do
    local x, y = entity.position(enemyId)
    entity.setPosition(enemyId, x + 1, y)
end
```

#### Collision Functions

```lua
-- Check if two entities overlap
isOverlapping = collision.overlap(id1, id2)  -- Returns: boolean

-- Check if entity touches any entity of class
isTouching = collision.touchingClass(entityId, className)  -- Returns: boolean

-- Raycast from point to point
result = collision.raycast(x1, y1, x2, y2)
-- Returns: {hit=bool, entityId=int, x=float, y=float, distance=float}
```

#### Input Functions

```lua
-- Check if key is currently pressed
isDown = input.isKeyDown("KeyW")  -- Returns: boolean

-- Check if key was just pressed this frame
wasPressed = input.wasKeyPressed("Space")  -- Returns: boolean

-- Check if key was just released this frame
wasReleased = input.wasKeyReleased("Space")  -- Returns: boolean

-- Get mouse position
x, y = input.mousePosition()  -- Returns: two floats

-- Supported key codes (strings):
-- "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
-- "KeyW", "KeyA", "KeyS", "KeyD"
-- "KeyX", "KeyZ", "Enter", "Escape"
-- ... (more as needed)
```

#### Audio Functions

```lua
-- Play sound effect
audio.playSound("assets/jump.ogg", volume, pitch)
-- volume: 0.0-1.0 (default 1.0)
-- pitch: 0.5-2.0 (default 1.0)

-- Play background music (loops by default)
audio.playMusic("assets/background.ogg", loop)
-- loop: boolean (default true)

-- Stop all sounds and music
audio.stopAll()

-- Set volume levels
audio.setVolume(master, music, sfx)
-- All 0.0-1.0
```

#### Global State Functions

```lua
-- Get a global variable
value = state.get("score")  -- Returns: any Lua type

-- Set a global variable
state.set("score", 100)

-- Add to a numeric variable
newValue = state.add("health", -10)  -- Returns: new value

-- Example: Simple HP system
local maxHP = 100
state.set("playerHP", maxHP)

-- Later, when player is hit:
local newHP = state.add("playerHP", -10)
if newHP <= 0 then
    -- Player died
end
```

#### Debug Functions

```lua
-- Log a message (visible in console/logs)
debug.log("Player position: " .. x .. ", " .. y)

-- Draw debug line (visible in-game)
debug.drawLine(x1, y1, x2, y2, color)
-- color: string like "red", "green", "blue", "#FFFFFF" (or RGB hex)
```

### Example: Player Movement Script

```lua
-- Main game loop callback (called every fixed frame)
function tick(dt)
    local playerId = 1  -- Assume player entity has ID 1
    
    -- Handle input
    local moveX = 0
    if input.isKeyDown("KeyW") then moveX = moveX + 200 end
    if input.isKeyDown("KeyA") then moveX = moveX - 200 end
    if input.isKeyDown("KeyD") then moveX = moveX + 200 end
    
    -- Set velocity
    local vx, vy = entity.velocity(playerId)
    entity.setVelocity(playerId, moveX, vy)
    
    -- Jump on space
    if input.wasKeyPressed("Space") then
        entity.setVelocity(playerId, vx, 500)
        audio.playSound("assets/jump.ogg", 1.0, 1.0)
    end
    
    -- Collision with enemies
    if collision.touchingClass(playerId, "Enemy") then
        state.add("playerHP", -10)
        debug.log("Player hit! HP: " .. state.get("playerHP"))
        
        if state.get("playerHP") <= 0 then
            entity.destroy(playerId)
            state.set("gameOver", true)
        end
    end
    
    -- Debug draw
    local x, y = entity.position(playerId)
    debug.drawLine(x, y, x + 50, y, "green")
end
```

---

## Build System Strategy

### CMake Structure

**Root CMakeLists.txt**:
- Defines project name, version, C++ standard
- Detects Emscripten via `EMSCRIPTEN` variable
- Includes `runtime-cpp/CMakeLists.txt`

**runtime-cpp/CMakeLists.txt**:
- Configures libraries: Raylib, Lua, Sol2, Box2D (physics module)
- Defines `game` target (executable)
- Sets compiler flags per platform
- Links Emscripten flags if building WASM

### Compiling for Native (Windows)

```bash
cd ArtCade\ V2/runtime-cpp
mkdir build && cd build

# MSVC (Windows)
cmake .. -G "Visual Studio 17 2022" -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Output: game.exe
```

### Compiling for WASM (Emscripten)

```bash
cd ArtCade\ V2/runtime-cpp/build

# Setup Emscripten environment
source $EMSDK/emsdk_env.sh

# Configure for WASM
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build .

# Output: game.js + game.wasm
```

### CMake Platform Detection

```cmake
if(EMSCRIPTEN)
    # WASM-specific compile flags
    target_compile_options(game PRIVATE -fexceptions)
    target_link_options(game PRIVATE
        --preload-file assets@/assets
        -s WASM=1
        -s ALLOW_MEMORY_GROWTH=1
    )
else()
    # Native-specific compile flags
    if(MSVC)
        target_compile_options(game PRIVATE /W4)
    else()
        target_compile_options(game PRIVATE -Wall -Wextra)
    endif()
endif()
```

---

## Asset Pipeline (.artcade Format)

### .artcade File Structure

`.artcade` is a ZIP archive containing:

```
MyGame.artcade
├── manifest.json              # Version, checksums, metadata
├── game.json                  # Game config
├── project.json               # Full ProjectDoc
├── scripts/
│   ├── main.luac             # Compiled Lua bytecode
│   └── [scriptId].luac        # Other scripts
├── assets/
│   ├── sprites/
│   │   ├── player.png
│   │   ├── enemy.png
│   │   └── background.png
│   ├── audio/
│   │   ├── jump.ogg
│   │   ├── background.ogg
│   │   └── hit.ogg
│   └── fonts/
│       └── Arial.ttf
└── thumbnails/                # Editor preview images
    └── [sceneId].png
```

### JSON Schemas

**manifest.json**:
```json
{
  "version": "2.0.0",
  "projectVersion": "1.0",
  "createdAt": "2026-05-09T10:30:00Z",
  "checksums": {
    "project.json": "abc123def456...",
    "scripts/main.luac": "xyz789...",
    "assets/sprites/player.png": "..."
  }
}
```

**game.json**:
```json
{
  "projectName": "My Awesome Game",
  "resolution": { "width": 1280, "height": 720 },
  "targetFPS": 60,
  "startScene": "scene_1"
}
```

**project.json**: Full ProjectDoc (see types.h for schema)

### Loading in C++

```cpp
AssetLoader loader;
ProjectDoc doc;

// Load from .artcade
if (!loader.loadProject("MyGame.artcade", doc)) {
    Logger::error("Failed to load project");
    return false;
}

// ProjectDoc is now populated, ready for World::init()
World world;
world.init(doc);
```

### Development Workflow

**Dev Mode** (loose files):
```
assets-dev/
├── sprites/
│   ├── player.png
│   └── enemy.png
├── audio/
├── scripts/
│   └── main.luac
├── game.json
└── project.json
```

Just point loader to this directory for instant iteration.

**Distribution Mode** (.artcade):
```bash
./scripts/pack-artcade.sh assets-dev/ MyGame.artcade
# Creates ZIP, signs manifest, outputs MyGame.artcade
```

---

## Tauri Preview Integration

### Architecture

```
Editor (React)
    ↓ (onSave)
CMake Emscripten compile
    ↓ (outputs game.js + game.wasm)
Tauri command: preview(projectPath)
    ↓
Emscripten HTML template → WebView
    ↓
Game renders in preview panel
```

### Implementation

**Tauri Rust Handler**:
```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn preview_project(project_path: String) -> Result<String, String> {
    // 1. Compile project to WASM
    let output = Command::new("emcmake")
        .args(&["cmake", &project_path, "-DCMAKE_BUILD_TYPE=Release"])
        .output()
        .map_err(|e| e.to_string())?;
    
    // 2. Load compiled WASM into preview panel
    // 3. Return WebView content
    Ok(format!("file://{}/wasm-build/index.html", project_path))
}
```

**React Editor Integration**:
```typescript
// editor/src/Preview.tsx
const [isCompiling, setIsCompiling] = useState(false);

async function handlePreview() {
    setIsCompiling(true);
    const htmlUrl = await invoke('preview_project', { projectPath: currentProject.path });
    setWebViewSrc(htmlUrl);
    setIsCompiling(false);
}
```

### Key Benefit

The WASM binary in preview is the **exact same binary** users will download for browser play.
No surprises, no sync issues.

---

## Implementation Roadmap

### Week 1-2: Foundation

- [ ] **CMakeLists.txt finalized** (both targets)
- [ ] **Raylib integration** (window creation, basic rendering)
- [ ] **Sol2 setup** (Lua VM, test binding)
- [ ] **Types.h complete** (all struct definitions)
- [ ] **First triangle renders**

**Deliverable**: Engine window opens, Lua can call one API function.

### Week 3-4: Core Systems

- [ ] **Renderer complete** (sprite drawing, layer ordering, colors)
- [ ] **Physics wrapper** (Box2D, bodies, collision detection)
- [ ] **Input system** (keyboard polling, key mapping)
- [ ] **Audio system** (sound/music playback via Raylib)
- [ ] **Entity + World managers** (create, destroy, pool queries)

**Deliverable**: Simple test game with movement, collision, sound.

### Week 5-6: Lua & Game API

- [ ] **GameAPI implementation** (all 30+ functions bound)
- [ ] **LuaHost implementation** (bytecode loading, tick loop)
- [ ] **Asset loading** (.artcade ZIP parsing, PNG/OGG loading)
- [ ] **ProjectDoc deserialization** (JSON to structs)
- [ ] **Test Lua script** (player movement, enemy spawning)

**Deliverable**: Full game loop functional, Lua scripts execute.

### Week 7-8: Emscripten WASM

- [ ] **Emscripten toolchain setup** (emsdk, CMake cross-compile)
- [ ] **WASM build pipeline** (same code → game.wasm)
- [ ] **WebGL rendering** (Raylib WASM output)
- [ ] **fengari Lua integration** (optional, for browser console debugging)
- [ ] **Test WASM binary** (run in browser, verify physics/input)

**Deliverable**: Same game plays natively AND in browser.

### Week 9: Tauri Integration

- [ ] **Tauri setup** (Rust scaffolding)
- [ ] **Preview command** (compile → WebView)
- [ ] **React editor integration** (preview button, live updates)
- [ ] **File I/O** (load/save projects from filesystem)

**Deliverable**: Editor shows live preview of game in real-time.

### Week 10-11: Polish & Testing

- [ ] **Performance optimization** (profiling, bottleneck fixes)
- [ ] **Error handling** (graceful Lua crashes, asset loading errors)
- [ ] **Cross-platform testing** (Windows, macOS, Linux)
- [ ] **Debug visualizer** (optional: ImGui overlay)
- [ ] **Documentation** (API reference, examples, tutorials)

**Deliverable**: v2.0.0-alpha ready for external testing.

### Week 12: Shipping Prep

- [ ] **Deployment scripts** (package .exe, .wasm, .artcade)
- [ ] **Steam SDK integration** (optional, defer if time-constrained)
- [ ] **Release notes** (changes from v1)
- [ ] **Public demo** (game.artcade file for showcase)

**Deliverable**: v2.0.0 stable, shipping.

---

## Code Structure Reference

### Key Files

```
runtime-cpp/src/
├── main.cpp                     # Entry point, main loop template
├── engine/
│   ├── types.h                  # All struct definitions
│   ├── renderer.h/cpp           # Raylib wrapper
│   ├── physics.h/cpp            # Box2D wrapper
│   ├── input.h/cpp              # Input polling
│   ├── audio.h/cpp              # Raylib audio
│   ├── lua-host.h/cpp           # Lua VM + bytecode
│   └── game-api.h/cpp           # Sol2 bindings
├── game/
│   ├── entity-manager.h/cpp     # Entity storage + pool
│   ├── scene-manager.h/cpp      # Scene switching
│   ├── asset-loader.h/cpp       # ProjectDoc + ZIP loading
│   └── world.h/cpp              # Main orchestrator
└── utils/
    ├── logger.h/cpp             # Logging
    ├── zip.h/cpp                # ZIP extraction
    └── math.h                   # GLM helpers
```

### Compilation Sequence

```
C++ source files (.cpp)
    ↓ (MSVC/GCC/Clang)
Object files (.obj/.o)
    ↓ (Linker)
Native: game.exe (Windows)

C++ source files (.cpp)
    ↓ (Emscripten compiler)
LLVM IR
    ↓ (Emscripten optimizer)
WebAssembly bytecode
    ↓ (Emscripten binaryen)
game.wasm + game.js (Browser)
```

### Main Loop Pseudocode

```cpp
while (!renderer.shouldClose()) {
    // Input phase
    input.poll();
    
    // Fixed timestep accumulator
    accumulator += deltaTime;
    while (accumulator >= fixedTimestep) {
        // Game logic phase
        lua.tick(fixedTimestep);
        
        // Physics phase
        physics.step(fixedTimestep);
        
        // Update entities (positions from physics)
        world.updateActiveScene();
        
        accumulator -= fixedTimestep;
    }
    
    // Render phase
    renderer.beginFrame(bgColor);
    for (auto entityId : world.getActiveSceneEntities()) {
        // Render entity sprite
    }
    renderer.endFrame();
    
    // Cleanup
    input.resetFrameState();
}
```

---

## Next Steps

This document is now the baseline architecture reference. The implementation has advanced past the original "ready for implementation" state:

1. Native runtime, WASM runtime, Lua host, physics, packaging and Tauri editor are implemented at MVP level.
2. `RuntimeEntityGateway` is the current migration layer over `EntityManager` / `SceneManager`; EnTT remains a future storage target.
3. Preview uses the documented black-box canvas pattern with buffered C++ -> React callbacks.
4. `.artcade` packaging is implemented with `manifest.json`, `project.json`, scripts/assets and `licenseTier`.
5. Remaining work is tracked in `ROADMAP_INTEGRATIVA.md` and `docs/TECHNICAL_OVERVIEW.md`: asset pipeline hardening, WASM build from UI, Lua diagnostics, undo/redo and future Steam support.

---

**Document Version**: 2.0.0  
**Last Updated**: 2026-05-20  
**Status**: MVP Implemented / Architecture Reference

# ArtCade V2: Next Steps for Implementation

## What Was Created

✅ **Complete project structure** ready for C++ implementation:

```
ArtCade V2/
├── runtime-cpp/           # C++ game engine (READY FOR CODING)
│   ├── CMakeLists.txt    # Build configuration (native + WASM)
│   ├── src/
│   │   ├── main.cpp      # Entry point skeleton
│   │   ├── engine/       # All system headers defined
│   │   └── game/         # Entity/scene managers defined
│   └── libs/             # (To be populated with raylib, lua, etc.)
│
├── editor/               # React TypeScript UI (SKELETON ONLY)
├── docs/                 # Complete architecture & implementation guide
│   ├── ARCHITECTURE_DUAL_RUNTIME.md  (50 pages, ultra-detailed)
│   └── QUICK_START.md               (setup instructions)
├── CLAUDE.md             # Development guidelines
└── package.json          # Root npm config
```

## What You Have Now

1. **Type Definitions** (`types.h`) — All structs for Entity, Physics, Transform, Collider, etc.
2. **API Contracts** (header files) — Clear interfaces for Renderer, Physics, Input, Audio, Lua, GameAPI
3. **CMake Build System** — Compiles to both native .exe (MSVC/GCC) and WASM (Emscripten)
4. **Main Loop Template** (`main.cpp`) — Fixed timestep, Lua tick, physics step, rendering
5. **Architecture Document** — 50-page spec with examples, roadmap, Lua API reference
6. **Git Repository** — Ready to track your implementation

## Immediate Next Steps (In Order)

### 1. **Setup Development Environment** (1-2 hours)

```bash
# 1a. Download & extract third-party libraries
cd runtime-cpp/libs

# Raylib
git clone https://github.com/raysan5/raylib.git raylib

# Lua 5.4
git clone https://github.com/lua/lua.git lua

# Sol2 (header-only)
git clone https://github.com/ThePhD/sol2.git sol2

# 1b. Verify CMake can find them
cd ..
mkdir build && cd build
cmake ..
# Should show: Found Raylib, Found Lua, etc.
```

### 2. **Implement Renderer** (1-2 weeks)

**File**: `runtime-cpp/src/engine/renderer.cpp`

Start with:
```cpp
bool Renderer::init(...) {
    // 1. SetConfigFlags(FLAG_MSAA_4X_HINT)
    // 2. InitWindow(width, height, title.c_str())
    // 3. SetTargetFPS(60)
    // 4. LoadDefaultFont()
    return true;
}

void Renderer::beginFrame(...) {
    // 1. BeginDrawing()
    // 2. ClearBackground(...)
}

void Renderer::endFrame() {
    // 1. EndDrawing()
}

bool Renderer::shouldClose() {
    // return WindowShouldClose()
}
```

**Goal**: Render a simple colored window and a test sprite.

### 3. **Implement Physics** (1-2 weeks)

**File**: `runtime-cpp/src/modules/physics/src/physics.cpp`

Box2D integration:
```cpp
void Physics::init(...) {
    // 1. Create b2World + gravity
    // 2. Configure contact listener if needed
}

uint32_t Physics::createBody(...) {
    // 1. Create b2Body + fixtures in Box2D
    // 2. Return handle for later lookup
}

void Physics::step(float dt, uint32_t substeps) {
    // 1. Call b2World::Step (fixed timestep)
}
```

**Goal**: Two sprites colliding and bouncing realistically.

### 4. **Implement Input** (3-4 days)

**File**: `runtime-cpp/src/engine/input.cpp`

```cpp
void Input::poll() {
    // 1. Read all Raylib key states
    // 2. Compare with previous frame
    // 3. Set pressed/released flags
}
```

**Goal**: WASD movement, Space to jump, Esc to quit.

### 5. **Implement Audio** (2-3 days)

**File**: `runtime-cpp/src/engine/audio.cpp`

```cpp
void Audio::playSound(const std::string& path, float vol, float pitch) {
    // 1. LoadSound(path.c_str())
    // 2. PlaySound(sound, vol, pitch)
}
```

**Goal**: Background music + SFX when colliding.

### 6. **Implement Lua Host** (1-2 weeks)

**File**: `runtime-cpp/src/engine/lua-host.cpp`

```cpp
void LuaHost::init(GameAPI* api) {
    // 1. Create sol::state
    // 2. Register all GameAPI functions
    // 3. lua.new_usertype<Entity>(...) etc.
}

void LuaHost::tick(float dt) {
    // 1. Call lua["tick"](dt)
}
```

**Goal**: Lua scripts can move entities, detect collisions.

### 7. **Implement Game API** (1-2 weeks)

**File**: `runtime-cpp/src/engine/game-api.cpp`

Register 30+ functions via Sol2:
```cpp
void GameAPI::registerLuaBindings(sol::state& lua) {
    // entity.position(id)
    lua.set_function("entity_position", 
        [this](EntityId id) { return this->entityGetPosition(id); });
    
    // collision.overlap(id1, id2)
    lua.set_function("collision_overlap",
        [this](EntityId id1, EntityId id2) { return this->collisionOverlap(id1, id2); });
    
    // ... repeat for all functions
}
```

**Goal**: All Lua API functions callable from scripts.

### 8. **Implement Entity/World Managers** (1 week)

**Files**:
- `runtime-cpp/src/game/entity-manager.cpp`
- `runtime-cpp/src/game/scene-manager.cpp`
- `runtime-cpp/src/game/world.cpp`

```cpp
class EntityManager {
    std::unordered_map<EntityId, EntityDef> entities_;
    std::unordered_map<std::string, std::vector<EntityId>> classIndex_;
    
    // Create/destroy/query entities
};
```

**Goal**: Can load scenes, create/destroy entities at runtime.

### 9. **Implement Asset Loader** (1 week)

**File**: `runtime-cpp/src/game/asset-loader.cpp`

```cpp
bool AssetLoader::loadProject(const std::string& path, ProjectDoc& out) {
    // 1. Open ZIP (.artcade)
    // 2. Extract to temp dir
    // 3. Parse game.json, project.json
    // 4. Load assets (PNG, OGG)
    // 5. Load Lua bytecode
}
```

**Goal**: Can load a `.artcade` file and populate ProjectDoc.

### 10. **Emscripten WASM Build** (1-2 weeks)

Once native is working:
```bash
# Setup Emscripten environment
source emsdk/emsdk_env.sh

# Compile to WASM
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .

# Run in browser
python -m http.server 8000
# Open http://localhost:8000/game.html
```

**Goal**: Same game binary runs in browser via WASM.

---

## Architecture Reference You Have

📖 **Read `docs/ARCHITECTURE_DUAL_RUNTIME.md`** for:
- Complete Lua Game API specification (with examples)
- Implementation notes per system
- Main loop pseudocode
- CMake cross-compile strategy
- .artcade format specification
- Tauri preview integration
- Week-by-week roadmap

---

## Daily Workflow

```bash
cd "C:\Users\Antonio\Desktop\ArtCade V2"

# 1. Edit C++ code (e.g., renderer.cpp)
# 2. Rebuild
cd runtime-cpp/build
cmake --build . --config Release

# 3. Run & test
./Release/game.exe

# 4. Iterate, commit
git add -A
git commit -m "feat: implement renderer window creation"
```

---

## Collaboration Model

- **You**: Implement C++ (follow architecture spec)
- **Me**: Code review, architecture guidance, troubleshooting
- **Communication**: Use git commits + messages as documentation

When stuck:
1. Read relevant section in `ARCHITECTURE_DUAL_RUNTIME.md`
2. Check type definitions in `types.h` for struct shapes
3. Look at API signature in header file (e.g., `renderer.h`)
4. Ask me for guidance on specific implementation detail

---

## Checkpoint Targets

Track progress via these deliverables:

- [ ] **Week 1-2**: Window renders, can read keys → First visual test
- [ ] **Week 3-4**: Physics working, sprites collide → Basic gameplay
- [ ] **Week 5-6**: Lua scripts execute, entity pool queries work → Full game loop
- [ ] **Week 7-8**: WASM build succeeds, game runs in browser → Dual-runtime
- [ ] **Week 9-10**: Polish, error handling, cross-platform testing → Alpha ready
- [ ] **Week 11-12**: Documentation, examples, release prep → v2.0.0 shipped

---

## Critical Files to Read First

1. **`CLAUDE.md`** — Development guidelines & decisions
2. **`docs/ARCHITECTURE_DUAL_RUNTIME.md`** — Complete spec
3. **`runtime-cpp/src/engine/types.h`** — Struct definitions (your foundation)
4. **`runtime-cpp/src/main.cpp`** — Main loop template (fill in the TODOs)

---

## You're Ready!

All the architecture is defined. Headers are written. CMake is set up.

Now it's **implementation time**. 

Start with `renderer.cpp`, get that Raylib window open, and build from there.

**First commit target**: Get this test to work:

```cpp
Renderer renderer;
renderer.init(800, 600, "ArtCade V2");
while (!renderer.shouldClose()) {
    renderer.beginFrame({0.1f, 0.1f, 0.1f, 1.0f});
    // Draw a test rectangle
    renderer.drawRectangle(100, 100, 50, 50, {1.0f, 0.0f, 0.0f, 1.0f});
    renderer.endFrame();
}
renderer.shutdown();
```

Good luck! 🚀

---

**Status**: Initialization Complete  
**Next Phase**: Implementation  
**Timeline**: 12 weeks to v2.0.0 stable

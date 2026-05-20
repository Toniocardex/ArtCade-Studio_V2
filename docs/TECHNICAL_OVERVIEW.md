# ArtCade V2 — Technical Overview
### Guida tecnica per collaboratori

> **Versione**: 2.2 — ECS + React-WASM Integration Complete  
> **Ultimo aggiornamento**: 2026-05-10  
> **Autori**: Antonio Cardelli + Claude
> **Status**: Architettura Completa (Pronto per implementazione)

---

## Indice

1. [Visione del progetto](#1-visione-del-progetto)
2. [Architettura generale](#2-architettura-generale)
3. [Struttura del repository](#3-struttura-del-repository)
3.5. [Entity Component System (ECS)](#35--entity-component-system-ecs-architecture)
4. [Runtime C++ — moduli](#4-runtime-c--moduli)
5. [Editor React — pannelli e utility](#5-editor-react--pannelli-e-utility)
6. [Game loop dettagliato](#6-game-loop-dettagliato)
7. [Dual-runtime: native vs WASM](#7-dual-runtime-native-vs-wasm)
8. [Lua Game API](#8-lua-game-api)
9. [Formato .artcade](#9-formato-artcade)
10. [Fasi implementate](#10-fasi-implementate)
11. [Fasi da implementare](#11-fasi-da-implementare)
12. [Regole operative](#12-regole-operative)
13. [Setup e build](#13-setup-e-build)

---

## 1. Visione del progetto

ArtCade V2 è un **motore 2D dual-runtime**: lo stesso codice C++ compila sia in eseguibile nativo (Windows/macOS/Linux via Raylib) sia in WebAssembly (via Emscripten) per browser e preview nell'editor.

La logica di gioco è scritta in **Lua 5.4 bytecode** e richiamata dal motore ad ogni tick. Questo approccio garantisce:
- **Portabilità deterministica**: identico comportamento su nativo e WASM
- **Separazione chiara** tra engine (C++) e game logic (Lua)
- **Iterazione rapida**: modificare Lua non ricompila il runtime

Il motore espone una **GameAPI** uniforme (entity, physics, input, audio, state, time, ecc.) che i giochi Lua usano senza sapere se girano su .exe o .wasm.

---

## 2. Architettura generale

```
┌──────────────────────────────────────────────────────────┐
│             EDITOR (React + Tauri) — Thin Shell          │
│                                                           │
│  Hierarchy  Inspector  ScriptEditor  AssetBrowser  …     │
│       │          │           │              │             │
│       └──────────┴───────────┴──────────────┘            │
│                         │                                │
│  (imperative commands + buffered reads — NO real-time)  │
└──────────────────────────────────────────────────────────┘
                          │ WebView (Tauri) / iframe
┌──────────────────────────────────────────────────────────┐
│   PREVIEW PANEL: Scatola Nera Autosufficiente (WASM)    │
│                                                           │
│   ╔────────────────────────────────────────────╗          │
│   ║ C++ Runtime (game.wasm) — Autoloop        ║          │
│   ║                                            ║          │
│   ║ ├─ Game Loop Continuo (60Hz)              ║          │
│   ║ │  ├─ Input polling (nativo)              ║          │
│   ║ │  ├─ Lua tick()                          ║          │
│   ║ │  ├─ Physics step                        ║          │
│   ║ │  └─ Render frame                        ║          │
│   ║ │                                          ║          │
│   ║ ├─ Callbacks → Buffer Globale (non React) ║          │
│   ║ │  ├─ window._consoleLogs (drenato 5x/s) ║          │
│   ║ │  ├─ window._selectedEntity (read-only)  ║          │
│   ║ │  └─ window._transforms (cached state)   ║          │
│   ║ │                                          ║          │
│   ║ └─ Canvas (WebGL) — Renderizza solo qui   ║          │
│   ╚────────────────────────────────────────────╝          │
│                                                           │
│   React Canvas Element (solo rendering, zero logic)      │
└──────────────────────────────────────────────────────────┘
```

### Pattern architetturali chiave

| Pattern | Dove | Perché |
|---------|------|--------|
| **Black Box Canvas** | PreviewPanel | Zero re-render durante gameplay — React non tocca il canvas |
| **Buffered Events** | window.\_consoleLogs, window.\_selectedEntity | C++ scrive, React legge asincrono (non real-time) |
| **Imperative Commands** | editorSetMode, editorLoadProject, editorSelectEntity | React → C++ via ccall, non viceversa |
| **Pimpl** | Ogni modulo con tipi Raylib/Box2D/Sol2 | Nessun header di terze parti trapela |
| **IModule** | Tutti i moduli | Interfaccia uniforme `init()/shutdown()` |
| **EngineContext** | `core/engine-context.h` | DI container non-owning; evita catene di puntatori |
| **Fixed timestep** | `app.cpp::loopIteration()` | Fisica deterministica, decoupled da framerate |
| **drawQueue** | `renderer.cpp` | Le draw call Lua (deferred) vengono flushed in `endFrame()` dentro `BeginMode2D` |

Per **cosa è già nel codice rispetto agli obiettivi architetturali** (contesto motore, pipeline di frame, WASM, esempi EnTT nell’appendice collaterale) e la **roadmap incrementale**, vedi `ARCHITETTURA_TECNICA_ENGINE_2D.md` **§11**.

---

## 3. Struttura del repository

```
ArtCade V2/
│
├── runtime-cpp/                 C++ game engine
│   ├── src/
│   │   ├── main.cpp             Entry point (4 righe)
│   │   ├── app/
│   │   │   ├── include/app.h    Application class
│   │   │   └── src/app.cpp      Game loop, init/shutdown
│   │   ├── core/
│   │   │   ├── types.h          Tipi condivisi (EntityId, Vec2, Transform, EntityDef…)
│   │   │   ├── module.h         IModule interface
│   │   │   └── engine-context.h EngineContext (DI container)
│   │   ├── modules/             20 moduli (vedi §4)
│   │   ├── world/
│   │   │   ├── include/world.h
│   │   │   └── src/world.cpp    Orchestratore EntityManager+Scene+Physics
│   │   └── tests/               Unit test C++ (ctest)
│   ├── libs/                    Terze parti
│   │   ├── raylib/              Raylib 5.0 (source)
│   │   ├── lua/                 Lua 5.4.7 (source)
│   │   ├── sol2/                Sol2 3.3.0 (header-only)
│   │   └── nlohmann-json/       v3.11.3 (header-only)
│   ├── test-project/            Progetto demo (project.json + main.lua)
│   ├── build-wasm/              Output Emscripten (gitignored)
│   ├── CMakeLists.txt           Build root
│   └── build_wasm.bat           Compila WASM → editor/public/runtime/
│
├── editor/                      React 19 + Vite + Tauri
│   ├── src/
│   │   ├── App.tsx              Layout root
│   │   ├── components/          MenuBar, PanelHeader, StatusBar
│   │   ├── panels/              7 pannelli editor (vedi §5)
│   │   ├── utils/
│   │   │   ├── api.ts           IPC Tauri (file I/O, build, pack)
│   │   │   ├── project.ts       Parse/normalizza ProjectDoc JSON
│   │   │   └── wasm-bridge.ts   Bridge React ↔ C++ WASM
│   │   ├── store/               EditorProvider (Context + useReducer)
│   │   └── types/               TypeScript types (EntityDef, SceneDef…)
│   ├── public/
│   │   └── runtime/             game.js · game.wasm · game.data
│   ├── src-tauri/               Shell Tauri (Rust)
│   └── package.json
│
├── docs/                        Documentazione
│   ├── TECHNICAL_OVERVIEW.md    ← questo file
│   ├── ARCHITECTURE_DUAL_RUNTIME.md
│   └── QUICK_START.md
│
├── tools/
│   └── pack-artcade.py          Packer Python per formato .artcade
│
├── CLAUDE.md                    Decisioni architetturali (per AI)
├── ROADMAP_INTEGRATIVA.md       Stato dettagliato fase per fase
└── build.ps1                    Build script PowerShell (native)
```

---

## 3.5 — Entity Component System (ECS) Architecture

### Perché EnTT?

ArtCade V2 abbandona l'OOP classico (inheritance, virtual methods) in favore di **Entity Component System (EnTT)** per due motivi critici:

1. **Cache Locality**: Array-of-Structs (SoA) vs Object-Oriented (OOP Object Layout)
   - OOP: Entity è un grande oggetto con tutti i dati mescolati → CPU cache miss
   - ECS: Componenti dello stesso tipo in array denso → CPU cache hit
   - **Risultato**: 2–3× speedup su Raylib GPU-bound, cruciale in WASM single-thread

2. **Flexibility**: Aggiungere/rimuovere componenti da entity a runtime senza inheritance chains
   - Lua può applicare comportamenti dinamici
   - Hot-reload script senza ricompilare
   - Composizione over inheritance

### Architettura ECS in ArtCade

```
EnTT Registry (il "World")
│
├── Entity IDs (numeri)
│   ├── 1 (Player)
│   ├── 2 (Coin)
│   ├── 3 (Enemy)
│   └── ...
│
├── Component Arrays (Sparse Sets)
│   ├── Transform[] { pos, rot, scale }
│   ├── Sprite[] { assetId, tint, alpha }
│   ├── RigidBody[] { handle, velocity }
│   ├── Script[] { scriptPath, luaRef }
│   └── [...altri componenti]
│
└── Systems (Funzioni che iterano componenti)
    ├── PhysicsSystem::update(dt)
    ├── RenderSystem::draw()
    ├── AnimationSystem::update(dt)
    └── LuaSystem::tick(dt)
```

### Esempio Pratico

```cpp
// Crea una moneta con 3 componenti
EntityId coin = registry.create();
registry.emplace<Transform>(coin, Vec2{640, 360}, 0.f, Vec2{1, 1});
registry.emplace<Sprite>(coin, "coin.png", Color{1, 1, 1, 1}, 1.f);
registry.emplace<RigidBody>(coin, physics->createBody(...));

// Itera tutte le entity con Transform + Sprite (per rendering)
auto view = registry.view<Transform, Sprite>();
for (auto entity : view) {
    auto& trans = view.get<Transform>(entity);
    auto& spr = view.get<Sprite>(entity);
    renderer->drawSprite(spr, trans.pos, trans.rot, trans.scale);
}

// Destroy la moneta (tutte le componenti si puliscono automaticamente)
registry.destroy(coin);
```

### Vantaggi per WASM

| Aspetto | OOP | ECS |
|--------|-----|-----|
| **Cache coherency** | Pessimo (jumps in memory) | Ottimo (array lineare) |
| **Scalabilità** | Cresce con entity count | Cresce linearmente |
| **Hot-reload** | Difficile (inheritance chains) | Facile (componenti indipendenti) |
| **Lua binding** | Complesso (virtual methods) | Semplice (array access) |
| **WASM perf** | ~2× slowdown | ~1× baseline (nativo) |

---

## 4. Runtime C++ — moduli + ECS Integration

### 4.0 — ECS Registry e Moduli (Pattern di Integrazione)

I moduli costituiscono il **motore del gioco** e **tutti operano sul registry EnTT** via **World**:

```
┌─ World (wrapper attorno EnTT registry) ─────────────────┐
│                                                          │
│  entt::registry (core ECS)                              │
│  ├─ Transform[]                                         │
│  ├─ Sprite[]                                            │
│  ├─ RigidBody[]                                         │
│  ├─ Script[]                                            │
│  └─ [... tutti i componenti]                            │
│                                                          │
│  API pubblica:                                          │
│  ├─ createEntity() / destroyEntity()                   │
│  ├─ emplace<C>() / remove<C>() / get<C>()             │
│  └─ view<Cs...>()  ← Usato da tutti i Systems          │
└──────────────────────────────────────────────────────────┘
       ↑
       └─── Accesso via EngineContext
       
Systems (Moduli):
├─ PhysicsSystem: world.view<RigidBody, Transform>()
├─ RenderSystem: world.view<Transform, Sprite>()
├─ LuaSystem: world.view<Script, Transform>()
├─ AnimationSystem: world.view<SpriteAnimator, Sprite>()
└─ [... altri]
```

**Flusso di dati nel loop**:
```
GameLoop
  ├─ Input: input->poll()
  │
  ├─ [Fixed Timestep Loop]
  │  │
  │  ├─ Lua: luaSystem->tick(dt)
  │  │       └─ Itera world.view<Script>()
  │  │          └─ Modifica Transform, RigidBody via Lua API
  │  │
  │  ├─ Physics: physics->step(dt)
  │  │          └─ Simula body in registry
  │  │
  │  ├─ Sync: world->syncPhysicsToEntities()
  │  │        └─ Copia posizioni Box2D → registry Transform
  │  │
  │  ├─ Audio/Time: audio->update(), timeManager->tick(dt)
  │  │
  │  └─ accumulator -= targetDt
  │
  ├─ Render:
  │  ├─ renderer->beginFrame()
  │  ├─ renderSystem->draw()
  │  │  └─ Itera world.view<Transform, Sprite>()
  │  └─ renderer->endFrame()
  │
  └─ Input: input->resetFrameState()
```

Ogni modulo rispetta la struttura:
```
modules/<nome>/
  include/<nome>.h     API pubblica (no tipi di terze parti nel header)
  src/<nome>.cpp       Implementazione (Pimpl, include raylib/box2d/sol2 qui)
  CMakeLists.txt
```

### 4.1 Layer 0 — Utilities (stateless, no Raylib)

#### `TimeManager`
Gestione del tempo per layer indipendenti (UI, gioco, cut-scene).

```cpp
timeManager->tick(realDt);               // chiamato ogni fixed step
float t = timeManager->now();            // tempo scalato del layer default
float dt = timeManager->delta();         // delta scalato
timeManager->setTimeScale(0.5f);         // slow-motion
timeManager->pause("cutscene", 10);      // pausa con sorgente + priorità
timeManager->resume(token);
timeManager->delay(2.f, []{ ... });      // timer one-shot
timeManager->every(0.5f, []{ ... });     // timer ripetuto
```

#### `EventBus`
Pub/sub string-keyed con payload `std::any`. Supporta emit sincrono e deferred.

```cpp
auto token = bus->subscribe("coin_collected", [](std::any data) {
    int score = std::any_cast<int>(data);
});
bus->emit("coin_collected", 10);
bus->emitDeferred("level_complete", {});   // emesso alla prossima flushDeferred()
bus->flushDeferred();                      // chiamato ogni tick nel loop
bus->unsubscribe(token);
```

#### `VariableManager`
Key-value store tipizzato con observer pattern e snapshot.

```cpp
vars->setInt("score", 0);
vars->addInt("score", 10, 0, 9999);       // con clamp min/max
int s = vars->getInt("score");
auto token = vars->observe("score", [](std::any v) { ... });
auto snap = vars->takeSnapshot();
vars->restoreSnapshot(snap);
```

#### `TweenManager`
Animazioni interpolate con 13 easing, delay, loop, pingpong.

```cpp
// Easing: Linear, QuadIn/Out, CubicIn/Out, SineIn/Out, ElasticOut, BounceOut, BackOut
tweens->tweenTo(0.f, 1.f, 0.5f, TweenEase::ElasticOut,
    [](float v) { entity.alpha = v; },
    []{ /* onComplete */ });
tweens->update(dt);
```

#### `SpriteAnimator`
Animazione frame-based per entity. Supporta clip loop/non-loop con `onFinish`.

```cpp
animator->defineClip({"run", {0,1,2,3}, 12.f, true});
animator->play(entityId, "run");
animator->update(dt);
int frame = animator->frameIndex(entityId);
```

#### `LayerManager`
Gestione z-order, visibilità, opacity per layer di rendering.

```cpp
layers->defineLayer("background", 0, true, 1.f);
layers->defineLayer("ui",         10, true, 1.f);
layers->assignEntity(entityId, "background");
auto sorted = layers->sortedLayers();    // back-to-front per render
```

#### `CameraManager`
Camera 2D con follow target, smooth lerp, screen shake trauma-based.

```cpp
cam->moveTo({640, 360}, 0.5f);           // lerp in 0.5s
cam->setFollowTarget([&]{ return playerPos; }, 5.f);
cam->addTrauma(0.8f);                    // shake intensity 0–1
Vec2 world = cam->screenToWorld({400, 300});
```

#### `SaveLoadManager`
Persistenza su slot filesystem. Formato testuale senza librerie esterne.

```cpp
save->save("slot1", { {"score", StateValue{42}}, {"level", StateValue{3}} });
auto data = save->load("slot1");
bool ok = save->hasSave("slot1");
save->deleteSave("slot1");
auto slots = save->listSlots();
```

#### `GameStateManager`
FSM a stringhe con guard, history push/pop, integrazione EventBus.

```cpp
gsm->defineState("menu",
    []{ /* onEnter */ },
    []{ /* onExit */ },
    [](float dt){ /* onUpdate */ });
gsm->addTransition("menu", "play", []{ return input.start; });
gsm->goTo("play");
gsm->push("pause");                      // salva history
gsm->pop();                              // torna al precedente
```

---

### 4.2 Layer 1 — Rendering e I/O (Raylib)

#### `Renderer`
Wrapper Raylib completo. Nessun tipo Raylib nel header pubblico (Pimpl).

```cpp
renderer->setWindowSize(1280, 720, "MyGame");
renderer->init();

// Per frame:
renderer->beginFrame({0.05f, 0.07f, 0.10f, 1.f});   // ClearBackground + BeginMode2D
renderer->drawSprite(assetId, pos, rotation, scale, tint, alpha);
renderer->drawRect(x, y, w, h, color);
renderer->drawLine(x1, y1, x2, y2, color);
renderer->drawText("Hello", x, y, 20, color);
renderer->endFrame();                    // flush drawQueue + EndMode2D + EndDrawing

// Chiamato prima di ogni Lua tick nel loop:
renderer->clearDrawQueue();              // evita ghost di frame multipli
```

> **⚠️ Nota**: `clearDrawQueue()` deve essere chiamato **prima** di ogni `luaHost->tick()` nel loop fixed-timestep. Se un frame esegue 2+ tick, il drawQueue accumulerebbe draw di tick precedenti — causando "ghost" di entità distrutte per un frame.

#### `TextureManager`
Cache GPU ref-counted con handle `uint32_t`. Placeholder 1×1 magenta su file mancante.

```cpp
uint32_t h = texManager->load("assets/sprites/player.png");
TextureInfo info;
texManager->getInfo(h, info);            // width, height, gpuId
texManager->release(h);                 // ref-count: 3 load → 3 release
```

#### `Input`
Polling Raylib con keymap JS-style (KeyboardEvent.code: `"KeyW"`, `"ArrowUp"`, ecc.).

```cpp
input->poll();                           // inizio frame
bool down     = input->isKeyDown("Space");
bool pressed  = input->wasKeyPressed("Enter");   // edge: true solo 1 frame
Vec2 mouse    = input->mousePosition();
input->resetFrameState();                // fine frame
```

#### `Audio`
Sound cache per path + Music streaming. Volume gerarchico (master / music / sfx).

```cpp
audio->playSound("assets/audio/coin.ogg", 1.f, 1.f);
audio->playMusic("assets/audio/theme.ogg", true);
audio->setMasterVolume(0.8f);
audio->update();                         // obbligatorio ogni frame (UpdateMusicStream)
```

---

### 4.3 Layer 2 — Game Data

#### `EntityManager`
Pool di entity con doppio indice (className + tag). O(1) per lookup.

```cpp
EntityId id = em->createEntity(def);
em->destroyEntity(id);
const EntityDef* e = em->get(id);
auto pool = em->getPool("Enemy");        // tutti gli Enemy
auto tagged = em->getByTag("collectible");
em->forEachInPool("Coin", [](EntityDef& e) { ... });
```

#### `SceneManager`
Carica scena da `ProjectDoc`, tiene traccia della scena attiva.

```cpp
sceneManager->registerScenes(doc.scenes, doc.entities);
sceneManager->loadScene("scene_main");
const SceneDef* sc = sceneManager->activeScene();
```

#### `AssetLoader`
Carica `project.json` (dev mode) o `.artcade` ZIP.

```cpp
ProjectDoc doc;
assetLoader->loadDirectory("test-project", doc);      // cartella dev
assetLoader->loadArtcade("game.artcade", doc);        // ZIP distribuibile
assetLoader->loadLuaBytecode(doc.mainScriptPath, bytes);
```

#### `World` — Orchestratore ECS

**Responsabilità**: Wrapper attorno a EnTT registry. Coordina EntityManager, SceneManager, Physics per mantenere stato coerente.

```cpp
class World {
    entt::registry registry;              // ← Core ECS
    EntityManager entityManager;          // Gestisce lifecycle entity
    SceneManager sceneManager;            // Gestisce scene loading
    std::map<std::string, StateValue> globalState;  // Global Lua variables
    
public:
    // Entity lifecycle
    EntityId createEntity(const EntityDef& def) {
        auto e = registry.create();
        registry.emplace<Transform>(e, def.transform);
        registry.emplace<Sprite>(e, def.sprite);
        // ... altri componenti
        return e;
    }
    
    void destroyEntity(EntityId e) {
        registry.destroy(e);  // Tutti i componenti rimossi automaticamente
    }
    
    // Scene management
    void init(const ProjectDoc& doc) {
        entityManager->createPool(doc.entities);  // Pre-crea entity pool
        sceneManager->registerScenes(doc.scenes, doc.entities);
        loadScene(doc.activeSceneId);
    }
    
    void loadScene(const std::string& sceneId) {
        sceneManager->load(sceneId);  // Popola registry con entity della scena
    }
    
    // Component access (usato dai Systems)
    template<typename C>
    C& get(EntityId e) { return registry.get<C>(e); }
    
    template<typename... Cs>
    auto view() { return registry.view<Cs...>(); }
    
    // Physics sync
    void syncPhysicsToEntities() {
        auto view = registry.view<RigidBody, Transform>();
        for (auto e : view) {
            auto& rb = view.get<RigidBody>(e);
            auto& trans = view.get<Transform>(e);
            trans.position = physics->getPosition(rb.handle);
        }
    }
    
    // Global state (Lua)
    void setGlobalState(const std::string& key, const StateValue& val) {
        globalState[key] = val;
    }
    StateValue getGlobalState(const std::string& key) {
        return globalState.count(key) ? globalState[key] : StateValue{};
    }
};
```

**Flusso di usage**:
```
Application::init(ProjectDoc doc)
  ├─ world->init(doc)
  │  ├─ EntityManager crea entity pool
  │  ├─ SceneManager registra scene
  │  └─ loadScene() popola registry
  │
Game Loop
  ├─ Systems accedono: world->view<Transform, Sprite>()
  ├─ Lua modifica: entity.setPosition() → registry Transform
  ├─ Physics simula: registry RigidBody
  └─ Render itera: world->view<Transform, Sprite>()
```

---

### 4.4 Layer 3 — Physics (Box2D 2.4)

#### `Physics`
Wrapper Box2D. Coordinate screen-space (Y verso il basso), unità pixel.

```cpp
physics->setGravity({0.f, 500.f});       // 500 px/s² verso il basso
uint32_t handle = physics->createBody(entityId, component);
physics->step(dt, 2);                    // 2 substep per stabilità
physics->setLinearVelocity(handle, {200.f, 0.f});
Vec2 pos = physics->getPosition(handle);
physics->destroyBody(handle);            // safe anche se già distrutto

bool hit = physics->areOverlapping(h1, h2);
RaycastResult r = physics->raycast({0,0}, {1280,0});
```

**Tipi di corpo**: `Dynamic`, `Static`, `Kinematic`  
**Forme collider**: `Rectangle`, `Circle`

---

### 4.5 Layer 4 — Lua VM

#### `LuaHost`
Sol2 `sol::state` in Pimpl. Carica bytecode `.luac` o sorgente `.lua`.

```cpp
luaHost->registerBindings([&](sol::state& lua) {
    gameAPI->registerAll(lua);           // registra tutta la GameAPI
});
luaHost->init();                         // apre librerie Lua, GC generazionale
luaHost->loadBytecodeBuffer(data, size); // carica ed esegue chunk
luaHost->tick(dt);                       // chiama global `tick(dt)` in Lua
luaHost->callFunction("on_scene_enter"); // chiama qualsiasi global Lua
```

GC configurato in modalità **generazionale** (Lua 5.4) + step incrementale ogni tick: elimina i frame spike da bulk-free di oggetti (monete, eventi, callback).

#### `GameAPI`
Entry point per tutti i binding Lua. Ogni categoria ha un `.cpp` separato `< 50 righe`.

```
game-api/src/
  game-api.cpp          registerAll() — chiama tutti i bind* sotto
  entity-api.cpp        entity.*
  physics-api.cpp       physics.*
  input-api.cpp         input.*
  audio-api.cpp         audio.*
  state-api.cpp         state.*
  debug-api.cpp         debug.*
  save-api.cpp          save.*
  event-api.cpp         event.*
  time-api.cpp          time.* + _time_update (interno)
  camera-api.cpp        camera.*
```

---

## 5. Editor React — pannelli e utility

Stack: **React 19 + Vite 6 + TailwindCSS 3 + CodeMirror 6 (iframe MPA) + Tauri 2**  
Design: Slate Night `#0B1121` / Neon Cyan `#00FFFF` / Neon Magenta `#FF00FF`

### Layout

```
┌─ MenuBar ─────────────────────────────────────────────────┐
│ File | Build | ▶ PLAY | BUILD .EXE                        │
├─────────────┬─────────────────────────┬───────────────────┤
│ Hierarchy   │      PreviewPanel        │    Inspector      │
│ (entity     │   (WebAssembly canvas)   │  (transform,      │
│  list +     │   tool palette:          │   sprite, script) │
│  scene      │   select/pan/paint/erase │                   │
│  selector)  │                          │                   │
├─────────────┴─────────────────────────┴───────────────────┤
│ AssetBrowser │  ScriptEditor (CodeMirror) │  TilesetEditor  │
├──────────────┴─────────────────────────┴──────────────────┤
│ ConsolePanel + StatusBar                                   │
└────────────────────────────────────────────────────────────┘
```

### Componenti

| File | Ruolo |
|------|-------|
| `MenuBar.tsx` | File → Open Project, Save, Build .EXE, ▶ PLAY / ■ STOP |
| `PanelHeader.tsx` | Header riutilizzabile per ogni pannello |
| `StatusBar.tsx` | Runtime status · cursore · entity selezionata · versioni |

### Pannelli

| Pannello | Ruolo |
|----------|-------|
| `HierarchyPanel` | Lista entity per scena con color badge per className. Click → imperative `editorSelectEntity()` al C++ |
| `PreviewPanel` | **BLACK BOX**: Canvas WASM puro. Carica `game.js` una sola volta. **NEVER re-renders** durante gameplay. Input/selection/console via buffer globale |
| `InspectorPanel` | Legge `window._selectedEntity` ogni 200ms (non real-time). Invia comandi `editorSetTransform()` al C++ su change |
| `ScriptEditorPanel` | `EngineScriptEditor` (iframe CodeMirror) per Lua; sync da Logic Board via `update-from-logic`. Apply → `editorReloadScript()` |
| `LogicBoardPanel` | Editor visuale eventi + anteprima Lua; `syncLogicBoardToScript()` → store + iframe |
| `AssetBrowserPanel` | Asset del progetto raggruppati per categoria (Images / Audio / Scripts) |
| `TilesetEditorPanel` | Grid tile 8×4 con flag collision e brush tool |
| `ConsolePanel` | Drena `window._consoleLogs` ogni 100ms (non real-time). Invia comandi Lua via input al C++ |

### Utility

#### `wasm-bridge.ts` — React ↔ C++ WASM (Buffered Model)

**PATTERN CRITICO**: PreviewPanel è una "black box" — deve sussistere autonomamente senza intrusioni da React.

Il bridge segue questo modello:

**Fase 1: Setup Unica (al mount di PreviewPanel)**
```typescript
const canvasRef = useRef(null)

useEffect(() => {
  if (isReady()) return  // già caricato
  
  loadWasmRuntime(canvasRef.current, WASM_RUNTIME_SRC, {
    onReady: () => setWasmReady(true),
    
    // ⚠️ CRITICAL: Non mandare questi a React in real-time
    onEntitySelected: (id) => {
      window._selectedEntity = id  // Solo buffer, NO dispatch
    },
    
    onEntityTransformChanged: (id, x, y, ...) => {
      // Ignorare completamente — C++ aggiorna da solo
    },
    
    onConsoleLine: (msg, level) => {
      window._consoleLogs ??= []
      window._consoleLogs.push({ msg, level, time: Date.now() })
      // Niente setTimeout — drenato da polling esterno
    },
  })
}, [])
```

**Fase 2: React Legge Asincrono (Non Real-Time)**
```typescript
// InspectorPanel (legge ogni 200ms)
useEffect(() => {
  const interval = setInterval(() => {
    const current = window._selectedEntity
    if (current !== selectedId) {
      setSelectedId(current)  // React state update OK — è asincrono
    }
  }, 200)
  return () => clearInterval(interval)
}, [selectedId])

// ConsolePanel (drena ogni 100ms)
useEffect(() => {
  const interval = setInterval(() => {
    if (window._consoleLogs?.length) {
      setLogs(prev => [...prev, ...window._consoleLogs])
      window._consoleLogs = []
    }
  }, 100)
  return () => clearInterval(interval)
}, [])
```

**Fase 3: React Comandi Imperativi (Verso C++)**
```typescript
// Imperative: React → C++ (su user action, non real-time)
editorSetMode(1);                        // 0=editor, 1=play
editorLoadProject(projectJson);          // hot-reload (async OK)
editorSelectEntity(id);                  // richiesta di selezione
```

**Ordine di Caricamento Obbligatorio**:
1. Imposta `window.*` buffer (vuoti)
2. Configura `window.Module` con `canvas` e `locateFile`
3. Inietta `<script src="game.js">`

> **🎯 Regola Aurea**: PreviewPanel **non si re-renderizza mai** durante gameplay. Input, selection, transform sono bufferizzati — React li legge asincrono quando SERVE (Inspector click, panel focus), non real-time.

> **⚠️ `locateFile`**: usa sempre `/runtime/${path}` (percorso assoluto), mai `${prefix}${path}`. Quando `game.js` è caricato con `async`, `document.currentScript` è `null` → Emscripten passa prefix vuoto → URL relativo errato per `game.data`.

#### `project.ts` — Parse ProjectDoc

Normalizza il JSON del progetto (array `[x,y]` → `{x, y}`, ecc.) e fornisce:
```typescript
parseProjectDoc(json)          // → ProjectDoc normalizzato
getEntitiesInScene(doc, sceneId)
getActiveScene(doc)
entityLabel(entity)            // "Player #1"
allClassNames(doc)
```

#### `api.ts` — IPC Tauri

```typescript
openProjectDialog()            // file picker nativo → carica project.json
saveScript(path, content)      // scrive via Tauri fs plugin
packProject(root, output)      // invoca pack-artcade.py
runBuild(projectRoot)          // triggera cmake --build → log in Console
```

### State management

`EditorProvider` — React Context + `useReducer`. Zero Redux. Actions:
- `LOAD_PROJECT` / `SELECT_ENTITY` / `UPDATE_ENTITY` (solo editor/UI state, non gameplay state)
- `SET_ACTIVE_SCENE` / `SET_MODE` (scene_view ↔ logic_board)
- `LOG` / `WASM_READY`

**⚠️ IMPORTANTE**: Lo stato React (`state.selection`, `state.consoleLogs`) è SEPARATO dallo stato WASM. React non osserva gameplay in tempo reale — legge i buffer quando serve.

### 5.5 — React-WASM Decoupling Pattern (CRITICO)

**Problema**: Callbacks C++→React in tempo reale durante gameplay causano re-render di PreviewPanel → WebGL glitch visibile come "flash" (bordo scompare).

**Soluzione**: Completa separazione — PreviewPanel è una "black box" che vive autonomamente, React legge asincrono.

#### Flusso Dati Corretto

```
Game Loop (60Hz)
  ├─ onConsoleLine("coin collected", "info")
  │  └─→ window._consoleLogs.push(...)  ← Buffer solo
  │
  ├─ onEntitySelected(null)  [coin distrutto]
  │  └─→ window._selectedEntity = null   ← Buffer solo
  │
  └─ [WebGL render — ZERO React interference]

React Poll Thread (ogni 100-200ms)
  ├─ ConsolePanel
  │  └─ Drena window._consoleLogs
  │     └─ setState([...logs, ...drained])  ← Asincrono OK
  │
  └─ InspectorPanel
     └─ Legge window._selectedEntity
        └─ setState(id)  ← Solo se cambiato
```

#### Implementazione Pseudo-Code

```typescript
// ❌ WRONG — causa flash
export function loadWasmRuntime(..., cbs) {
  window.onConsoleLine = (msg, level) => {
    setTimeout(() => cbs.onConsoleLine(msg, level), 0)  // Still wrong
  }
}

function PreviewPanel() {
  const { dispatch } = useEditor()  // Subscriber a CoreContext
  useEffect(() => {
    loadWasmRuntime(canvas, gameSrc, {
      onConsoleLine: (msg, level) => {
        dispatch({ type: 'LOG', ... })  // ← Trigger re-render
      }
    })
  }, [dispatch])
  
  return <canvas ref={canvasRef} />  // ← Re-rende ogni LOG!
}
```

```typescript
// ✅ CORRECT — zero re-render
export function loadWasmRuntime(...) {
  window.onConsoleLine = (msg, level) => {
    window._consoleLogs ??= []
    window._consoleLogs.push({ msg, level, ... })  // ← Solo buffer
  }
  
  window.onEntitySelected = (id) => {
    window._selectedEntity = id  // ← Solo buffer
  }
  
  // Game loop runs autonomously, React not involved
}

function PreviewPanel() {
  // NO useEditor(), NO useConsoleLogs()
  // Just render canvas once, never re-render
  return <canvas ref={canvasRef} />  // ← NEVER re-rende
}

function ConsolePanel() {
  const [logs, setLogs] = useState([])
  
  useEffect(() => {
    // Poll every 100ms — slow enough to decouple from 60Hz game loop
    const interval = setInterval(() => {
      if (window._consoleLogs?.length) {
        setLogs(prev => [...prev, ...window._consoleLogs])
        window._consoleLogs = []  // Drain
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])
  
  return <div>{logs.map(...)}</div>
}

function InspectorPanel() {
  const [selectedId, setSelectedId] = useState(null)
  
  useEffect(() => {
    // Poll every 200ms — user edits are slow compared to gameplay
    const interval = setInterval(() => {
      const current = window._selectedEntity
      if (current !== selectedId) {
        setSelectedId(current)
      }
    }, 200)
    return () => clearInterval(interval)
  }, [selectedId])
  
  return <div>Entity: {selectedId}</div>
}
```

#### Key Points

| Aspetto | ❌ Wrong | ✅ Correct |
|---------|---------|-----------|
| **onConsoleLine** | dispatch() immediatamente | Buffer globale |
| **onEntitySelected** | dispatch() immediatamente | Buffer globale |
| **PreviewPanel state** | Subscriber a volatile context | ZERO state subs |
| **Re-render frequency** | 60+ per secondo (game loop) | 0 durante gameplay |
| **React reads** | Real-time callbacks | Polling asincrono 100-200ms |
| **Flash visibile** | Sì (bordo scompare) | No (black box intatta) |

---

## 6. Game loop dettagliato — ECS Systems Pattern

```
loopIteration() — eseguita ogni frame (60Hz target)
│
├── Cap accumulator a 4× targetDt          ← evita spiral-of-death
├── input->poll()
│
├── while (accumulator >= targetDt):
│   │
│   ├── renderer->clearDrawQueue()         ← ⚠️ CRITICO: solo last-tick draws
│   │
│   ├── TimeManager System:
│   │   └── timeManager->tick(dt)
│   │
│   ├── Utility Systems:
│   │   ├── tweenManager->update(dt)
│   │   ├── spriteAnimator->update(dt)
│   │   ├── layerManager->update(dt)
│   │   ├── cameraManager->update(dt)
│   │   ├── gameStateManager->update(dt)
│   │   └── eventBus->flushDeferred()
│   │
│   ├── Lua System (queries world.view<Script>):
│   │   ├── luaSystem->tick(dt)
│   │   │  └── Itera registry Transform, RigidBody, Sprite
│   │   │     └── Lua modifica componenti
│   │   └── drawScene() accumula drawQueue
│   │
│   ├── Physics System (queries world.view<RigidBody>):
│   │   └── physics->step(dt)              ← Box2D simula
│   │
│   ├── Sync System (reads Box2D → registry):
│   │   └── world->syncPhysicsToEntities() ← copia pos Box2D → Transform
│   │
│   ├── Audio System:
│   │   └── audio->update()
│   │
│   └── accumulator -= targetDt
│
├── Render System (queries world.view<Transform, Sprite>):
│   ├── renderer->beginFrame(bgColor)      ← ClearBackground + BeginMode2D
│   ├── renderSystem->draw()
│   │  └── Itera registry Transform + Sprite
│   │     └── renderer->drawSprite() per entity
│   └── renderer->endFrame()              ← flush drawQueue + EndMode2D
│
└── input->resetFrameState()
```

### Architettura Systems e Registry

Ogni system accede al **World** (registry EnTT) per leggere/scrivere componenti:

```cpp
// Esempio: LuaSystem itera tutte le entity con Script
void LuaSystem::tick(float dt) {
    auto view = world->view<Script, Transform>();
    for (auto entity : view) {
        auto [script, trans] = view.get<Script, Transform>(entity);
        // Chiama Lua per questo entity
        // Lua modifica trans.position, transform.rotation, ecc.
    }
}

// Esempio: RenderSystem itera tutte le entity da disegnare
void RenderSystem::draw() {
    auto view = world->view<Transform, Sprite>();
    for (auto entity : view) {
        auto [trans, sprite] = view.get<Transform, Sprite>(entity);
        renderer->drawSprite(sprite, trans.position, trans.rotation);
    }
}
```

### Perché `clearDrawQueue()` prima di ogni tick?

Il drawQueue è l'unico buffer che sopravvive tra tick e `endFrame`. Se un frame è lento e il loop esegue **2 tick**:

```
Tick N:
  ├─ clearDrawQueue()
  ├─ luaHost->tick() → drawScene()
  │  └─ Aggiunge draw: coin (visibile)
  └─ drawQueue = [coin_sprite]

Tick N+1:
  ├─ clearDrawQueue()  ← Svuota!
  ├─ luaHost->tick()   ← Coin distrutto in Lua
  │  └─ drawScene()
  │     └─ Niente coin (coin è distrutto)
  └─ drawQueue = []

Render:
  └─ Disegna solo drawQueue finale (vuoto) ✅
```

**Senza clearDrawQueue()**:

```
Tick N: drawQueue = [coin_sprite]
Tick N+1: drawQueue = [coin_sprite, ...]  ← Accumula!
Render: Disegna coin FANTASMA (è stato distrutto) ❌
```

Con `clearDrawQueue()` all'inizio di ogni tick, all'`endFrame` arrivano solo i comandi dell'**ultimo tick** executed.

---

## 7. Dual-runtime: native vs WASM

### Come funziona

Lo stesso sorgente C++ compila con due toolchain diverse:

| Target | Toolchain | Output | Renderer |
|--------|-----------|--------|----------|
| Native | MSVC / GCC | `game.exe` | Raylib (OpenGL) |
| Web | Emscripten 5.0.7 | `game.js` + `game.wasm` | Raylib (WebGL via GLFW) |

I `#ifdef ARTCADE_WASM` sono **solo in `app.cpp`** e gestiscono:
- `emscripten_set_main_loop()` invece del while nativo
- Path fisso `"test-project"` (WASM carica dal VFS preloadato)
- `accumulator_` come membro (persiste tra callback)

### Emscripten flags (CMakeLists)

```cmake
-DARTCADE_WASM
-fexceptions
-sWASM=1
-sUSE_GLFW=3
-sALLOW_MEMORY_GROWTH=1
--preload-file test-project@test-project
-sEXPORTED_FUNCTIONS=['_main','_editor_set_mode',…]
-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString',…]
```

### Build WASM (Windows)

```batch
cd runtime-cpp
build_wasm.bat
# Output: build-wasm/src/app/game.html + game.js + game.wasm
```

Poi copiare in `editor/public/runtime/`:
```bash
cp build-wasm/src/app/game.{js,wasm,data} ../editor/public/runtime/
```

### Avviare l'editor

```bash
cd editor
npm run dev        # http://localhost:5173
# oppure
npm run tauri:dev  # app nativa Tauri con WebView
```

---

## 8. Lua Game API

La GameAPI è esposta al codice Lua tramite Sol2. Ogni namespace corrisponde a un file binding.

```lua
-- ── ENTITY ─────────────────────────────────────────────────
local x, y = entity.position(id)
entity.setPosition(id, x, y)
local vx, vy = entity.velocity(id)
entity.setVelocity(id, vx, vy)
entity.destroy(id)

-- ── POOL ───────────────────────────────────────────────────
local ids = pool.getAll("Enemy")         -- {id, id, …}
local n   = pool.count("Coin")

-- ── PHYSICS ────────────────────────────────────────────────
physics.setGravity(0, 500)
local h = physics.createBody(id, "dynamic", "rect", w, h)
physics.destroyBody(h)
local hit = physics.areOverlapping(h1, h2)
local r   = physics.raycast(x1, y1, x2, y2)  -- {hit, entityId, px, py}

-- ── INPUT ──────────────────────────────────────────────────
input.isKeyDown("KeyW")          -- held
input.wasKeyPressed("Space")     -- edge: true solo 1 frame
input.wasKeyReleased("Enter")
local mx, my = input.mousePosition()

-- ── AUDIO ──────────────────────────────────────────────────
audio.playSound("assets/audio/coin.ogg", 1.0, 1.0)
audio.playMusic("assets/audio/bgm.ogg", true)
audio.stopAll()

-- ── STATE (global key-value) ────────────────────────────────
state.set("score", 0)
state.get("score")               -- → value o nil
state.add("score", 10)           -- → nuovo valore

-- ── TIME ───────────────────────────────────────────────────
local t   = time.now()
local fps = time.fps()
time.delay(2.0, function() ... end)
time.every(0.5, function() ... end)

-- ── TWEEN ──────────────────────────────────────────────────
tween.to({ from=0, to=1, duration=0.3, ease="ElasticOut",
    onUpdate=function(v) ... end,
    onComplete=function() ... end })

-- ── SAVE / LOAD ────────────────────────────────────────────
save.write("slot1", {score=42, level=3})
local data = save.read("slot1")
save.exists("slot1")
save.delete("slot1")
local slots = save.list()

-- ── DEBUG ──────────────────────────────────────────────────
debug.log("Hello")                            -- stdout + Console panel
debug.drawRect(x, y, w, h, "blue")
debug.drawLine(x1, y1, x2, y2, "red")
debug.drawCircle(x, y, r, "green")
```

### Struttura main.lua consigliata

```lua
local initialized = false

function tick(dt)
    if not initialized then
        init()          -- setup one-time
        initialized = true
    end

    -- update logic
    updateEntities(dt)
    checkCollisions()

    -- draw (deferred → endFrame)
    drawScene()
end
```

---

## 9. Formato .artcade

Archivio ZIP contenente:

```
game.artcade
├── manifest.json        { "version": "1.0", "projectName": "…", sha256 checksum }
├── project.json         ProjectDoc completo (entity + scene + config)
├── scripts/
│   └── main.luac        Bytecode Lua compilato
└── assets/
    ├── sprites/         *.png
    ├── audio/           *.ogg
    └── fonts/           *.ttf
```

Il **packer** è `tools/pack-artcade.py`:
```bash
python tools/pack-artcade.py test-project output.artcade
```

Il **parser C++** (`zip-reader.cpp`) gestisce:
- Method 0 (STORE): copia raw
- Method 8 (DEFLATE): `sinflate()` da Raylib

---

## 10. Fasi implementate

| # | Fase | Stato | Dettaglio |
|---|------|-------|-----------|
| 0 | Struttura + architettura | ✅ | types.h, IModule, EngineContext, app.cpp Pimpl |
| 1 | Moduli stateless batch 1 | ✅ | TimeManager, EventBus, VariableManager — 37 test |
| 2 | Moduli stateless batch 2 | ✅ | GameStateManager, SpriteAnimator, LayerManager, CameraManager, TweenManager, SaveLoadManager — 64 test |
| 3 | Build CMake (no Raylib) | ✅ | 10/10 test, fix policy CMake 4.x |
| 4 | Librerie terze parti | ✅ | Raylib 5.0, Lua 5.4.7, Sol2 3.3.0, nlohmann/json |
| 5 | Renderer | ✅ | Raylib window, Camera2D top-left, drawQueue |
| 6 | TextureManager | ✅ | Cache GPU ref-counted, placeholder magenta |
| 7 | Input | ✅ | Keymap JS-style (70+ tasti), edge detection |
| 8 | Audio | ✅ | Sound cache, Music streaming, volume gerarchico |
| 9 | EntityManager + SceneManager + World | ✅ | Doppio indice class+tag, syncPhysics |
| 10 | AssetLoader + project.json | ✅ | Parser nlohmann/json, dev mode |
| 11 | LuaHost + GameAPI | ✅ | Sol2, tick(), registerBindings() |
| 12 | Physics (Box2D 2.4) | ✅ | Dynamic/Static/Kinematic, raycast, overlap — 11 test |
| 13 | First Playable native | ✅ | Demo interattiva 7 entity, 60fps stabile, log su disco |
| 14 | WebAssembly (Emscripten) | ✅ | game.html + game.js + game.wasm, VFS preload |
| 16 | Logic Components Lua | ✅ | PauseManager, PathFollower, PlatformerController, ParticleEmitter, DialogueSystem — 13 test |
| 17 | Packaging .artcade ZIP | ✅ | zip-reader.cpp (STORE+DEFLATE), pack-artcade.py, 4 test |
| 18 | Editor React scaffold | ✅ | 7 pannelli, CodeMirror Lua (iframe), wasm-bridge.ts, Tauri IPC stub |

### Bug fix notevoli già risolti

| Bug | Causa | Fix |
|-----|-------|-----|
| Canvas nera in editor | `locateFile` con prefix vuoto → `game.data` caricato da URL errato | Hardcode `/runtime/${path}` |
| Coin flash al pickup (C++) | drawQueue accumulato da più tick → ghost di entità distrutte | `clearDrawQueue()` prima di ogni `luaHost->tick()` |
| Coin flash al pickup (React) | onEntitySelected/onConsoleLine → dispatch() real-time durante rAF → React reconciliation durante WebGL compositing | **Buffering + Polling**: buffer globale, React legge ogni 100-200ms (non real-time) |
| Canvas non centrato | Missing `aspectRatio` CSS → overflow quando maxWidth vincola | Aggiungere `aspectRatio: \`${res.x} / ${res.y}\`` al canvas style |
| Spiral-of-death | Accumulator overflow su frame lenti | Cap a `targetDt_ × 4` |
| GC frame spike | Lua GC batch su entità distrutte (monete, eventi) | Modalità GC generazionale + `LUA_GCSTEP 5` ogni tick |
| `#canvas` vs `#artcade-canvas` | rcore_web.c di Raylib usa `"#canvas"` hardcoded | Patch src + ricompila game.wasm |

---

## 11. Fasi da implementare

### Fase 15 — Tauri Integration (IPC completo)
**Dipende da**: Fase 14 + Fase 18 ✅  
**Stato**: ⏳ Priorità alta

Obiettivo: collegare l'editor React alla shell Tauri per operazioni native.

Checkpoint:
- [ ] `openProjectDialog()` → file picker nativo → `ProjectDoc` caricato
- [ ] `saveScript()` → scrive su disco tramite `tauri-plugin-fs`
- [ ] `BUILD .EXE` → triggera `cmake --build` → log in tempo reale nel Console panel
- [ ] `▶ PLAY` → carica WASM nel PreviewPanel e avvia il runtime
- [ ] `PACK .ARTCADE` → invoca `pack-artcade.py` → file chooser per output

### Fase 19 — Hot-reload Lua in editor + React-WASM Decoupling
**Dipende da**: Fase 15 + CRITICO Pattern 5.5  
**Stato**: ⏳ **IN PROGRESS**

Obiettivo: modificare lo script Lua nell’editor (CodeMirror) o dalla Logic Board e vedere il risultato nel PreviewPanel senza riavviare il runtime. **IMPLEMENTARE BUFFERING PATTERN PER ELIMINARE FLASH**. Sync board→script e Apply hot-reload già operativi in editor.

Checkpoint:
- [ ] PreviewPanel **NON si re-renderizza mai** durante gameplay (zero useContext per volatile state)
- [ ] C++ callbacks (onConsoleLine, onEntitySelected, onEntityTransformChanged) scrivono in buffer globale (`window._*`), mai dispatch diretti
- [ ] ConsolePanel drena `window._consoleLogs` ogni 100ms (polling asincrono)
- [ ] InspectorPanel legge `window._selectedEntity` ogni 200ms (polling asincrono)
- [ ] `editorLoadProject(json)` hot-ricarica scene e entity nel C++ runtime (imperative command, OK)
- [ ] Lua script ricaricato via `loadBytecodeBuffer` con nuovo sorgente compilato in WASM
- [ ] **VERIFICA**: Coin pickup non causa flash (bordo scompare) — se presente, pattern non applicato correttamente
- [ ] Stato di gioco (score, posizioni) preservato o resettato controllabilmente via state buffer

### Fase 20 — Sprite e texture reali
**Dipende da**: Fase 15  
**Stato**: ⏳

Obiettivo: caricare PNG reali e renderizzarli invece dei rettangoli placeholder.

Checkpoint:
- [ ] `AssetLoader` risolve path sprite da `EntityDef.sprite.spriteAssetId`
- [ ] `TextureManager::load()` carica PNG nella GPU texture cache
- [ ] `Renderer::drawSprite()` usa `DrawTexturePro` con texture reale
- [ ] Asset browser mostra anteprima delle immagini

### Fase 21 — Gizmo editor in-canvas
**Dipende da**: Fase 15 + Fase 20  
**Stato**: ⏳

Obiettivo: selezionare e spostare entity direttamente nel PreviewPanel con mouse drag.

Checkpoint:
- [ ] Click su canvas → ray-cast → seleziona entity più vicina → `onEntitySelected` callback
- [ ] Drag con gizmo → `editorSetTransform()` → Inspector si aggiorna in sync
- [ ] Multi-select (Shift+click), delete (Canc)
- [ ] Undo/redo (Ctrl+Z / Ctrl+Y)

### Fase 22 — Scene editor (tilemap + layer)
**Dipende da**: Fase 21  
**Stato**: ⏳

Obiettivo: costruire scene visivamente con tile painting e layer management.

Checkpoint:
- [ ] TilesetEditorPanel funzionale (seleziona tile, dipinge su griglia)
- [ ] LayerManager UI (visibilità, opacity, z-order drag)
- [ ] SpriteAnimator UI (definisci clip, preview frame-by-frame)

### Fase 23 — Build pipeline completa
**Dipende da**: Fase 15  
**Stato**: ⏳

Obiettivo: produrre artefatti distribuibili dall'editor senza uscire dall'app.

Checkpoint:
- [ ] `BUILD .EXE` → `cmake --build` nativo → `game.exe` + `game.artcade`
- [ ] `BUILD .WASM` → `emcmake cmake + emmake cmake --build` → `game.wasm` + `game.js`
- [ ] Firma e checksum `manifest.json` aggiornato automaticamente
- [ ] Export ZIP pronto per upload web o distribuzione su store

### Fase 24 — Steamworks SDK (opzionale)
**Dipende da**: Fase 23  
**Stato**: ⏳ (futuro)

Checkpoint:
- [ ] `steam/` stub funziona (no-op su WASM e non-Steam build)
- [ ] Achievements, leaderboard, overlay in-game

---

## 12. Regole operative

### C++ Runtime (Core)

1. **Non passare alla Fase N+1 finché il checkpoint di N non è verde e i test passano localmente.**
2. **Ogni modulo nuovo** segue la struttura `include/` + `src/` + `CMakeLists.txt` + almeno 5 unit test.
3. **No god files**: nessun sorgente supera ~300 righe. Se cresce, split in sub-file.
4. **Nessun tipo Raylib/Box2D/Sol2 nei header pubblici** — Pimpl obbligatorio.
5. **`engine-context.h` non include nessun header di modulo** — solo forward declarations.
6. **Il drawQueue viene sempre svuotato prima di ogni `luaHost->tick()`** nel loop.
7. **`locateFile` usa sempre percorso assoluto** `/runtime/${path}` — mai prefix Emscripten.
8. **Commit dopo ogni checkpoint verde** con prefisso `feat:`, `fix:`, `test:` o `docs:`.

### React Editor (CRITICO per UX)

9. **🎯 REGOLA AUREA: PreviewPanel è una scatola nera inespugnabile**
   - Non si re-renderizza MAI durante gameplay
   - Non usa `useContext()` per leggere state volatile (logs, cursor, selection real-time)
   - Callbacks C++→React (onConsoleLine, onEntitySelected, onEntityTransformChanged) scrivono in buffer globale (`window._*`), mai dispatch immediato
   - React legge i buffer asincrono (polling ogni 100–200ms), non real-time
   - PreviewPanel non conosce né il progetto né la selection — è completamente disaccoppiato

10. **Pattern Imperative per comandi React→C++**
    - `editorSetMode(0|1)`, `editorLoadProject(json)`, `editorSelectEntity(id)` sono l'unica interfaccia
    - Niente reactive props che trigghino render-loop feedback
    - Niente `useEffect` che osservi stato e richiami ccall — useCallback su click/change del pannello specifico

11. **Buffering Richiesto**
    - `window._consoleLogs` — array drenato ogni 100ms da ConsolePanel
    - `window._selectedEntity` — numero letto ogni 200ms da InspectorPanel
    - `window._transforms` (future) — cache trasform per on-demand reads
    - Niente `onConsoleLine() → dispatch()` — causa flash provato

12. **Polling Controllato**
    - `setInterval()` ogni 100–200ms per drenare buffer
    - Clear buffer dopo lettura (`window._consoleLogs = []`)
    - Limita update frequenza: 60Hz game loop → 5–10Hz UI update

---

## 13. Setup e build

### Prerequisiti

| Tool | Versione | Note |
|------|----------|------|
| CMake | ≥ 4.0 | `cmake --version` |
| MSVC Build Tools | 19.x | Visual Studio 2022 / Build Tools |
| Node.js | ≥ 20 | Per editor React |
| Rust | stable | Per shell Tauri |
| Emscripten SDK | 5.0.7 | `emsdk install 5.0.7` |
| Python | ≥ 3.9 | Per `pack-artcade.py` |

### Build nativo (Windows)

```powershell
cd runtime-cpp
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DARTCADE_BUILD_TESTS=ON -DCMAKE_POLICY_VERSION_MINIMUM=3.5
cmake --build . --config Release
ctest -C Release --output-on-failure
.\Release\game.exe ..\test-project\
```

### Build WASM

```batch
cd runtime-cpp
build_wasm.bat
# Output: build-wasm/src/app/game.{html,js,wasm,data}

# Copia nell'editor:
xcopy /Y build-wasm\src\app\game.js ..\editor\public\runtime\
xcopy /Y build-wasm\src\app\game.wasm ..\editor\public\runtime\
xcopy /Y build-wasm\src\app\game.data ..\editor\public\runtime\
```

### Avvio editor

```bash
cd editor
npm install
npm run dev                # http://localhost:5173 (solo Vite)
# oppure
npm run tauri:dev          # app Tauri nativa
```

### Test rapido dal browser

```bash
cd runtime-cpp/build-wasm/src/app
python -m http.server 8080
# http://localhost:8080/game.html
```

---

*Fine documento — ArtCade V2 Technical Overview v2.0*

# ArtCade V2 — Architecture Integration Overview

> **Documento**: High-level architecture (come tutti i pezzi si integrano)  
> **Audience**: Team, code reviewers, architects  
> **Versione**: 1.0  
> **Data**: 2026-05-10

**Vedi anche:** [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) — **Parte I** (termini) · **Parte III** (Logic Board: JSON, compilatore, UI) · [`LOGIC_BOARD_CONDITIONAL_DESIGN.md`](LOGIC_BOARD_CONDITIONAL_DESIGN.md) (OR/ELSE, branch) · [`GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md`](GUIDA_INTEGRAZIONE_SPLASH_LICENZE.md) (splash editor + watermark export Free/Pro, `pack-artcade`) · [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md) (sensori, platformer feel, UI screen-space, text juice) · [`ARCHITETTURA_TECNICA_ENGINE_2D.md`](ARCHITETTURA_TECNICA_ENGINE_2D.md) — §8–11.

---

## 🎯 Vista Complessiva

ArtCade V2 è costruito su **3 pilastri architetturali**:

```
┌────────────────────────────────────────────────────────────────────┐
│                   1. ENTITY COMPONENT SYSTEM (ECS)                 │
│                                                                     │
│  EnTT Registry = Core                                              │
│  ├─ Transform[], Sprite[], RigidBody[], Script[], ... (componenti) │
│  └─ Array-of-Structs per cache-friendly iteration                 │
│                                                                     │
│  World = Wrapper intelligente                                      │
│  ├─ Espone: view<Cs...>(), emplace<C>(), destroy()               │
│  └─ Usa: RuntimeEntityGateway, SceneManager, Physics               │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                 2. MODULAR SYSTEMS (C++ Layered)                   │
│                                                                     │
│  Layer 0: Utilities (stateless)                                    │
│  ├─ TimeManager, EventBus, VariableManager, GameStateManager       │
│  ├─ TweenManager, SpriteAnimator, LayerManager, CameraManager      │
│  └─ SaveLoadManager                                                │
│                                                                     │
│  Layer 1: Raylib I/O                                               │
│  ├─ Renderer (drawQueue pattern), TextureManager, Input, Audio     │
│                                                                     │
│  Layer 2: Game Data                                                │
│  ├─ RuntimeEntityGateway, SceneManager, AssetLoader, World         │
│                                                                     │
│  Layer 3: Physics                                                  │
│  ├─ Physics (Box2D 2.4 wrapper)                                    │
│                                                                     │
│  Layer 4: Lua VM                                                   │
│  ├─ LuaHost (Sol2), GameAPI, Script components (in registry)       │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│            3. REACT-WASM DECOUPLING (Buffering Pattern)            │
│                                                                     │
│  C++ Callbacks (game loop)                                         │
│  ├─ onConsoleLine() → window._consoleLogs.push()                  │
│  ├─ onEntitySelected() → window._selectedEntity = id              │
│  └─ onEntityTransformChanged() → window._transforms[id] = ...     │
│                                                                     │
│  React Polling (every 100-200ms)                                  │
│  ├─ ConsolePanel: drain window._consoleLogs                       │
│  ├─ InspectorPanel: read window._selectedEntity                   │
│  └─ PreviewPanel: NEVER re-renders (black box)                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Flusso di Dati: Come Tutto Funziona Insieme

### Scenario: User clicca PLAY

```
┌─ Editor React ─────────────────────────────────────────────┐
│ User clicca ▶ PLAY                                         │
│  └─ MenuBar.tsx dispatches "SET_PLAYING: true"            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─ React → C++ (Imperative) ────────────────────────────────┐
│ editorSetMode(1)  via Module.ccall()                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─ C++ Game Loop (Autonomo) ────────────────────────────────┐
│ app.cpp::loopIteration() starts (60Hz)                    │
│  │                                                         │
│  ├─ Input: input->poll()                                  │
│  │                                                         │
│  ├─ Accumulator Loop:                                      │
│  │  │                                                      │
│  │  ├─ renderer->clearDrawQueue()                         │
│  │  │                                                      │
│  │  ├─ Lua System: luaHost->tick(dt)                      │
│  │  │  └─ Itera: world->view<Script, Transform>()        │
│  │  │     └─ Modifica Transform, RigidBody via Lua API    │
│  │  │                                                      │
│  │  ├─ Physics: physics->step(dt)                         │
│  │  │  └─ Simula RigidBody via Box2D                      │
│  │  │                                                      │
│  │  ├─ Sync: world->syncPhysicsToEntities()              │
│  │  │  └─ Itera: world->view<RigidBody, Transform>()    │
│  │  │     └─ Copia Box2D position → Transform            │
│  │  │                                                      │
│  │  └─ accumulator -= targetDt                            │
│  │                                                         │
│  ├─ Render: renderSystem->draw()                          │
│  │  └─ Itera: world->view<Transform, Sprite>()           │
│  │     └─ drawSprite() per entity → drawQueue             │
│  │                                                         │
│  ├─ endFrame(): flush drawQueue + SwapBuffers             │
│  │                                                         │
│  └─ Durante TUTTI questi step:                            │
│     ├─ onConsoleLine("Player spawned") scrive buffer      │
│     ├─ onEntitySelected(playerId) scrive buffer           │
│     └─ React NON è coinvolto ← BLACK BOX ✅              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                    (asincrono, poll)
                          │
                          ↓
┌─ React Polling (every 100ms) ─────────────────────────────┐
│ ConsolePanel.tsx:                                          │
│  └─ setInterval(() => {                                   │
│      if (window._consoleLogs?.length) {                   │
│        setLogs([...logs, ...window._consoleLogs])        │
│        window._consoleLogs = []  // Drain                │
│      }                                                     │
│    }, 100)                                                │
│                                                             │
│ InspectorPanel.tsx:                                        │
│  └─ setInterval(() => {                                   │
│      const id = window._selectedEntity                    │
│      if (id !== selectedId) setSelectedId(id)            │
│    }, 200)                                                │
│                                                             │
│ PreviewPanel.tsx:                                         │
│  └─ <canvas ref={canvasRef} />  ← NEVER re-renders      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Preview EDIT vs PLAY vs STOP (ProjectDoc = design source of truth)

| Mode | `EditorAPI::s_mode` | Simulation | ProjectDoc in React |
|------|---------------------|------------|---------------------|
| **EDIT** | `0` | Frozen: render + gizmo/tile paint only; no `tickFixedStep` | Authoritative design state |
| **PLAY** | `1` | Full fixed-step loop (Lua, physics, gameplay systems) | Immutable during play (incremental sync blocked) |
| **STOP** | back to `0` | `editor_restore_from_project` + `editor_reload_script` | Reloaded into C++ from React store |
| **Logic Board Apply** | implicit STOP if playing | Same restore sequence, then script hot-reload | Unchanged in Inspector |

**STOP sequence** (`MenuBar` → `runtimeSync.restorePreviewFromProject`):

1. `editor_restore_from_project(JSON)` — `replaceProject` from ProjectDoc + reset tweens/audio/variables (Lua kept).
2. `editor_reload_script(mainLua)` — compiled Logic Board / main script from editor buffers.
3. Asset cache bust on React side so textures re-upload after C++ `unloadAll`.

**C++ gate:** `app.cpp::loopIteration()` runs `dispatchInputEvents` and `tickFixedStep` only when `s_mode == 1` (WASM editor). Native game builds always simulate.

---

## 🔄 Componenti e Loro Ruoli

### ECS (Sezione 3.5, Guida ECS_IMPLEMENTATION_GUIDE.md)

| Elemento | Ruolo |
|----------|-------|
| **EnTT Registry** | Core: array densi di componenti |
| **Component** | Struct pure (Transform, Sprite, RigidBody, Script, ...) |
| **Entity ID** | Numero intero che identifica una entity |
| **View** | Query lazy: `registry.view<Transform, Sprite>()` |
| **System** | Funzione che itera view e aggiorna componenti |

### Moduli C++ (Sezione 4)

| Modulo | Input | Output | Registry Access |
|--------|-------|--------|---|
| **Lua** | tick(dt) via C++ | Modifica Transform, RigidBody | `view<Script>()` |
| **Physics** | step(dt) | Aggiorna Box2D RigidBody | `view<RigidBody>()` |
| **Renderer** | draw() | drawQueue + GPU | `view<Transform, Sprite>()` |
| **Animation** | update(dt) | Incrementa frame index | `view<SpriteAnimator>()` |
| **Audio** | update() | PlaySound, UpdateMusicStream | N/A (immediatamente) |
| **Time** | tick(dt) | Accumula dt scalato | N/A (time only) |

### React (Sezione 5, Guida REACT_WASM_PATTERN.md)

| Componente | Responsabilità | State |
|----------|---|---|
| **PreviewPanel** | Canvas WebGL (WASM) | ZERO (scatola nera) |
| **ConsolePanel** | Mostra log | `[...window._consoleLogs]` |
| **InspectorPanel** | Mostra/modifica proprietà | `window._selectedEntity` |
| **MenuBar** | Comandi (PLAY, SAVE, BUILD) | `editorSetMode()`, `editorLoadProject()` |

---

## ⚙️ Dettagli di Integrazione

### 1. ECS Registry Accessibile ai Systems

```cpp
// app.cpp
World world;  // Wraps entt::registry

// Nel game loop:
auto physicsView = world.view<RigidBody, Transform>();
auto renderView = world.view<Transform, Sprite>();
auto luaView = world.view<Script>();

// Ogni system accede lo stesso registry
// → Consistenza garantita tra tick
```

### 2. EngineContext Distribuzione

```cpp
// Ogni modulo riceve EngineContext nel constructor
struct EngineContext {
    World* world;           // ← Accesso a registry
    Physics* physics;
    Renderer* renderer;
    LuaHost* lua;
    Input* input;
    Audio* audio;
    // ...
};

PhysicsSystem physicsSystem(&ctx);
RenderSystem renderSystem(&ctx);
LuaSystem luaSystem(&ctx);

// Tutti accedono world->view<...>() attraverso ctx.world
```

### 3. Lifecycle Entity: Create → Populate → Destroy

```cpp
// Create
auto entityId = world.createEntity();

// Populate (emplace components)
world.emplace<Transform>(entityId, ...);
world.emplace<Sprite>(entityId, ...);
world.emplace<RigidBody>(entityId, ...);
world.emplace<Script>(entityId, ...);

// Use (systems iterano la registry)
auto view = world.view<Transform, Sprite>();
for (auto e : view) { ... }

// Destroy
world.destroyEntity(entityId);
// Tutti i componenti rimossi automaticamente ✅
```

### 4. Lua Integration with ECS

```lua
-- main.lua
function tick(dt)
    -- C++ GameAPI accede world->view<Entity>
    local player = pool.getFirst("Player")  -- Itera registry
    if not player then return end
    
    local x, y = entity.position(player)    -- world.get<Transform>(player)
    entity.setPosition(player, x + 10, y)   -- Modifica registry Transform
end
```

### 5. React ↔ WASM Communication

```typescript
// React comandi imperativi (verso C++)
editorSetMode(1)                    // ← C++ riceve, aggiorna game loop
editorLoadProject(projectJson)      // ← C++ ricrea registry

// C++ callbacks (verso React buffer, non dispatch)
window.onConsoleLine = (msg, level) => {
    window._consoleLogs.push({msg, level})  // Buffer
}

// React polling (legge buffer asincrono)
setInterval(() => {
    if (window._consoleLogs?.length) {
        setLogs([...logs, ...window._consoleLogs])
        window._consoleLogs = []
    }
}, 100)
```

---

## 🚀 Fasi di Implementazione

| Fase | ECS | Moduli | React | Status |
|------|-----|--------|-------|--------|
| 0–13 | ✅ Registry core | ✅ Layer 0–4 | ✅ Scaffold | Completato |
| 14 | ✅ Hot-load | ✅ LuaHost | ✅ Canvas | Completato |
| 15 | Gateway incrementale | Build/pack IPC | ✅ IPC Tauri | Completato MVP |
| **19** | **RuntimeEntityGateway** | **✅** | **✅ Buffering** | **Completato MVP** |
| 20–23 | Scene/Logic/Build polish | ✅ Extend | ✅ Editor tools | Completato MVP |
| 24 | Steam/no-op future | — | — | Futuro |

**Fase 19 = Integrazione Completa MVP**: `RuntimeEntityGateway` + moduli runtime + React-WASM decoupling testati insieme. EnTT resta una direzione architetturale futura, non lo storage runtime corrente.

---

## ✅ Checklist Integrazione (Fase 19 MVP)

- [x] **RuntimeEntityGateway**
  - [x] Espone `create`, `destroy`, `getTransform`, `setTransform`, `poolByClass`, `activeSceneIds`.
  - [x] Implementato sopra `RuntimeEntityGateway` / `SceneManager` (EnTT in `EntityRegistry`).
  - [x] Usato da `EditorAPI`, `GameAPI` e `World` dove serve.

- [x] **Game Loop Integration**
  - [x] `clearDrawQueue()` prima di `luaHost->tick()`.
  - [x] Ordine stabile: Lua → Physics → Sync → Render.
  - [x] Accumulator cap a 4× `targetDt`.
  - [x] Kill queue / spawn gateway dopo step fisico dove richiesto.

- [x] **React-WASM Decoupling**
  - [x] PreviewPanel come black-box.
  - [x] Callback C++ → React differite/buffered.
  - [x] ConsolePanel polling/copy log.
  - [x] Inspector/Hiearchy sincronizzati senza re-render ad alta frequenza del canvas.
  - [x] TEST: coin pickup = no border flash.

- [x] **Hot Sync**
  - [x] `editor_load_project()` sostituisce progetto/scene/entity nel runtime.
  - [x] `editor_set_transform()` aggiorna runtime e inspector.
  - [x] Dedup sync progetto per evitare flood di `editor_load_project`.

### Nota EnTT

La checklist EnTT originale è stata declassata a roadmap futura. Il runtime attuale non espone `World::view<Cs...>()`; il punto di migrazione è `RuntimeEntityGateway`, che consente di introdurre EnTT senza cambiare subito le API pubbliche editor/Lua.

---

## 📚 Riferimenti

- **TECHNICAL_OVERVIEW.md** — Documenti principale (v2.2)
  - §3.5: ECS Architecture
  - §4: Moduli C++
  - §5–5.5: React Integration
  - §6: Game Loop

- **ECS_IMPLEMENTATION_GUIDE.md** — Guida pratica EnTT
- **REACT_WASM_PATTERN.md** — Pattern buffering React
- **README.md** (root) — Setup e build pipeline

---

## 🎓 Conclusione

ArtCade V2 è un'architettura **modernare su 3 pilastri**:

1. **ECS** (EnTT) per cache-friendly rendering + Lua hot-reload
2. **Layered Moduli** per clean separation of concerns
3. **Decoupling React-WASM** per eliminare flash + UI lag

Tutti i pezzi si integrano **senza conflitti**, e Fase 19 ne completa il cerchio.

---

*Documento di integrazione: per team, code review, nuovi collaboratori. Distribuire insieme a TECHNICAL_OVERVIEW.md v2.2.*

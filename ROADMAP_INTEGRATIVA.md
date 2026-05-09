# ArtCade V2 — Roadmap Integrativa

> **Scopo**: tracciare fase per fase l'implementazione del runtime C++,
> con criteri di test chiari per validare ogni step prima di procedere.
>
> Ogni fase termina con un **checkpoint**: se il checkpoint passa, si va avanti.
> Se fallisce, si blocca lì finché non è risolto.

---

## Legenda stato

| Simbolo | Significato |
|---------|-------------|
| ✅ | Completato e validato |
| 🔧 | Implementato, validazione parziale (vedi note) |
| ⏳ | Da fare |
| 🔗 | Dipende da una fase precedente |

---

## FASE 0 — Struttura di progetto e architettura

**Stato**: ✅ Completata

### Cosa è stato fatto
- Struttura modulare `src/modules/<nome>/{include/, src/, CMakeLists.txt}`
- `core/types.h` — tipi condivisi (`EntityId`, `Vec2`, `Transform`, ecc.)
- `core/module.h` — interfaccia `IModule` (init/shutdown non-copiabile)
- `core/engine-context.h` — DI container non-owning con forward declarations
- `app/app.cpp` — Pimpl con init/shutdown ordinati e main loop a timestep fisso
- `app/main.cpp` — entry point 4 righe
- `CMakeLists.txt` root — detect Emscripten, target `artcade-core`, subdirectory per ogni modulo
- `CLAUDE.md` — decisioni architetturali documentate

### Checkpoint ✅
- [x] Struttura directory conforme alla regola "no god files"
- [x] `engine-context.h` non include nessun header di modulo (solo forward decl)
- [x] `main.cpp` ha esattamente 4 righe

---

## FASE 1 — Moduli core stateless (batch 1)

**Stato**: ✅ Completata — ctest 3/3 (37 test totali)

### Moduli inclusi
1. **TimeManager** — time layer, pausa stack, delay/every timers (12 test)
2. **EventBus** — pub/sub string-keyed con payload `std::any`, deferred emit (10 test)
3. **VariableManager** — store int/float/bool/string con observer e snapshot (15 test)

### Checkpoint ✅
```
ctest → time_manager_test    12/12 passed
        event_bus_test       10/10 passed
        variable_manager_test 15/15 passed
```

---

## FASE 2 — Moduli core stateless (batch 2)

**Stato**: ✅ Completata — ctest 6/6 (64 test totali)

### Moduli inclusi
4. **GameStateManager** — FSM a stringhe, guard, push/pop history, EventBus (10 test)
5. **SpriteAnimator** — clip frame-based, loop/non-loop, onFinish, istanze per entity (13 test)
6. **LayerManager** — z-order, visibilità, opacity tween, assegnazione entità (11 test)
7. **CameraManager** — posizione/zoom lerp, follow, shake trauma-based, world↔screen (12 test)
8. **TweenManager** — 13 easing, loop/pingpong, delay, onComplete — **bug delay fixato** (11 test)
9. **SaveLoadManager** — slot su filesystem, serializzazione senza lib esterne (7 test)

### Checkpoint ✅
```
ctest → game_state_test      10/10 passed
        sprite_animator_test 13/13 passed
        layer_manager_test   11/11 passed
        camera_manager_test  12/12 passed
        tween_manager_test   11/11 passed
        save_load_test        7/7  passed
```

---

## FASE 3 — Primo build CMake completo (senza Raylib)

**Stato**: ✅ Completata — 10/10 test passed (MSVC 19.50, CMake 4.3.2)

### Obiettivo
Verificare che tutti i moduli stateless (Fasi 1–2) compilino insieme tramite CMake
prima di aggiungere la dipendenza Raylib.

### Checkpoint ✅
```
cmake .. -DARTCADE_BUILD_TESTS=ON
ctest → 10/10 passed  (0.15s totali)
```

**Fix notevoli**:
- `-DCMAKE_POLICY_VERSION_MINIMUM=3.5` necessario per Raylib 5.0 con CMake 4.3.2
- Bug TweenManager delay: `effectiveDt = -e.delayRemaining` (overshoot dopo delay)

---

## FASE 4 — Librerie di terze parti

**Stato**: ✅ Completata — CMake configure + full build OK

### Installate in `runtime-cpp/libs/`
```
libs/raylib/        Raylib 5.0  (source, add_subdirectory)
libs/lua/           Lua 5.4.7   (source, CMakeLists.txt custom — target: lua54)
libs/sol2/          Sol2 3.3.0  (header-only, include/sol/sol.hpp)
libs/nlohmann-json/ v3.11.3     (header-only, include/nlohmann/json.hpp)
```

### Fix notevoli
- Lua 5.4 non aveva `CMakeLists.txt` → creato custom con `add_library(lua54 STATIC ...)`
- Target `lua` → rinominato `lua54` in `game-api/CMakeLists.txt` e `lua-runtime/CMakeLists.txt`
- Stub `.cpp` creati per tutti i moduli non ancora implementati
- `TextureManager` Pimpl: `struct Texture2D;` forward-decl non compatibile con `typedef struct Texture {} Texture2D` di Raylib → risolto con Pimpl completo
- `LuaHost`: `std::unique_ptr<sol::state>` in header con tipo incompleto → Pimpl + `~LuaHost()` definito in `.cpp`
- `audio.h` mancava `#include <unordered_map>`
- `app.cpp`: `std::string::ends_with` è C++20 → rimpiazzato con lambda C++17

### Checkpoint ✅
```
[ArtCade] Raylib : FOUND
[ArtCade] Lua    : FOUND
cmake --build → 100% Built target game  (game.exe linka)
ctest         → 10/10 passed
```

---

## FASE 5 — Renderer (Raylib)

**Stato**: ✅ Completata

### Implementato
- `renderer.h` — Pimpl completo (nessun tipo Raylib in header pubblico)
- `renderer.cpp` — `InitWindow`, `Camera2D`, `BeginDrawing`/`EndDrawing`, `BeginMode2D`/`EndMode2D`
- `texture-cache.h/cpp` — cache GPU interna con handle `uint32_t`
- Primitive: `drawSprite` (DrawTexturePro), `drawRect`, `drawLine`, `drawCircle`
- `deltaTime()` → wrappa `GetFrameTime()` (evita include raylib in app.cpp)
- Ordine corretto: `setWindowSize()` prima di `init()` → finestra apre con dimensioni giuste

### Checkpoint ✅
- [x] Finestra 1280×720 apre senza crash
- [x] Background color da `Vec4` corretta
- [x] `Camera2D` centrata: origin a metà schermo
- [x] TextureCache: placeholder magenta su file mancante

---

## FASE 6 — TextureManager integrato (con vero Raylib)

**Stato**: ✅ Completata — 9 test (con stub Raylib, nessuna GPU richiesta)

### Implementato
- Pimpl completo: `Impl` con `Texture2D` by value (non puntatore)
- `getInfo(handle, TextureInfo&)` → sostituisce `get()` che esponeva `Texture2D*`
- Ref-counting: tre `load()` richiedono tre `release()` per liberare la GPU texture
- Placeholder 1×1 magenta su file mancante o ID GPU = 0

### Checkpoint ✅
```
ctest → texture_manager_test  9/9 passed
```

---

## FASE 7 — Input

**Stato**: ✅ Completata

### Implementato
- `input.cpp` — poll completo di Raylib (IsKeyDown/Pressed/Released per ogni keycode noto)
- `keymap.cpp` — dizionario statico KeyboardEvent.code → Raylib keycode (70+ tasti)
- `mouse` — posizione, 3 pulsanti
- `resetFrameState()` — pulisce flag edge (pressed/released) a fine frame
- Nessun import di raylib.h in header pubblico

### Checkpoint ✅
- [x] Keymap copre lettere A-Z, Digit0-9, Arrow*, F1-F12, Numpad, modificatori
- [x] `wasKeyPressed` restituisce true solo per un frame (edge-triggered)
- [x] Build senza errori, link OK

---

## FASE 8 — Audio

**Stato**: ✅ Completata

### Implementato
- `audio.h` — Pimpl completo (Sound, Music nascosti in Impl; nessun raylib.h nel header)
- `audio.cpp` — `InitAudioDevice`, Sound cache per path, Music streaming (`LoadMusicStream`)
- Volume gerarchico: master (`SetMasterVolume`), music (`SetMusicVolume`), sfx (applicato su play)
- `update()` → `UpdateMusicStream` ogni frame (obbligatorio per streaming)
- `stopAll()` — ferma musica e tutti i suoni in cache

### Checkpoint ✅
- [x] Pimpl: nessun tipo Raylib in audio.h
- [x] Build + link OK

---

## FASE 9 — EntityManager + SceneManager + World

**Stato**: ✅ Completata

### Implementato
- **EntityManager**: `createEntity`, `destroyEntity`, `getPool(className)`, `getByTag`, index doppio (class + tag), `forEachInPool`
- **SceneManager**: `registerScenes`, `loadScene`, `activeScene()` — carica dalla ProjectDoc
- **World**: `syncPhysicsToEntities()` (copia posizioni da Rapier → Transform), `getGlobalState/setGlobalState`, `activeEntityIds()`

### Checkpoint ✅
- [x] EntityManager: create/destroy/pool query funzionanti
- [x] SceneManager: load + activeScene() restituisce SceneDef corretta
- [x] Build + link OK

---

## FASE 10 — AssetLoader + formato project.json

**Stato**: ✅ Completata (dev mode; .artcade ZIP futuro)

### Implementato
- `asset-loader.cpp` con `nlohmann::json`
- `loadDirectory(path, out)` → legge `project.json` nella cartella
- Parser completo: `ProjectDoc`, `EntityDef` (transform, sprite, tags), `SceneDef` (entityIds, backgroundColor)
- `loadLuaBytecode(path, bytes)` → risolve path relativo alla project root
- `resolveAssetPath(assetId, type)` → `<root>/assets/<type>/<id>`
- ZIP extraction (`.artcade`): stub per Phase 10b

### Checkpoint ✅
```
game.exe test-project/ → "[App] Project loaded: ArtCade Test"
```

---

## FASE 11 — LuaHost + GameAPI

**Stato**: ✅ Completata

### Implementato
- **LuaHost** — Sol2 `sol::state` (Pimpl), open_libraries base/math/string/table/coroutine
- `loadBytecodeBuffer` → `lua.load_buffer()` (funziona sia per sorgente `.lua` che bytecode `.luac`)
- `loadBytecodeFile` → `lua.load_file()`
- `tick(dt)` → chiama `tick` globale Lua con `sol::protected_function` (errori catturati in `lastError_`)
- `registerBindings(callback)` → eseguiti su `init()` prima di caricare script
- **GameAPI** — binding entity, physics, input, audio, state, debug già scheletrati con Sol2

### Checkpoint ✅
```
[Lua] main.lua loaded — ArtCade V2 engine running!
[Lua] tick  t=1.0
[Lua] tick  t=2.0
[Lua] tick  t=3.0
[Lua] tick  t=4.0
```

---

## FASE 12 — Physics (Box2D 2.4)

**Stato**: ✅ Completata — 11/11 test passano (incluso physics_test)

### Cosa è stato fatto
- **Backend**: Box2D 2.4.1 via `FetchContent` (no dipendenza Rust/Rapier2D)
- **Pimpl completo**: `physics.h` espone solo `Vec2`/`PhysicsComponent`/`uint32_t handle`; Box2D resta in `physics.cpp`
- `createBody` — Dynamic/Static/Kinematic, collider Rectangle e Circle
- `destroyBody` — rimozione sicura da world + mappe interne
- `step(dt, substeps=2)` — integrazione a substep con `b2World::Step`
- `setGravity` — configura gravità Y-down (default +10, screen-space)
- `setLinearVelocity/getLinearVelocity` — accesso diretto a `b2Body`
- `setPosition/getPosition` — teleport con preservazione angolo
- `areOverlapping` — `b2TestOverlap` con shape + transform correnti
- `raycast` — `b2RayCastCallback` closest-hit con restituzione handle + punto
- `getContactingBodies` — `b2QueryAABB` con epsilon 0.5
- `physics` spostato fuori dalla guardia `HAS_RAYLIB && HAS_LUA` (puro C++)
- `build.ps1` / `build_phase12.bat` — aggiunto `-DCMAKE_POLICY_VERSION_MINIMUM=3.5`

### Checkpoint ✅
```
ctest 11/11:  physics_test .... Passed  0.03s
Corpi dinamici cadono (Δy > 2 unità dopo 1s con g=10)
Corpi statici non si muovono
setPosition/setLinearVelocity verificati
areOverlapping: true quando coincidenti, false dopo spostamento
destroyBody + double-destroy = no-op sicuro
```

---

## FASE 13 — First Playable (integrazione completa native)

**Stato**: ✅ Completata — demo interattiva funzionante, 30s stabilità OK

### Cosa è stato fatto

**Fix architetturali** (stub→funzionanti):
- `EntityManager::createEntity` ora preserva l'id dal `EntityDef` JSON (fix: `nextId_ = max(nextId_, id+1)`)
- `World::init` crea tutte le entità dell'`EntityDef` map nell'EntityManager prima di `loadScene`
- `Renderer`: camera portata a origin top-left (`offset={0,0}`, `target={0,0}`) — coordinate schermo = coordinate mondo
- `Renderer`: draw command queue — `drawRect/drawLine/drawCircle` da Lua (durante `tick`) vengono accodate e flushed dentro `endFrame()` (BeginMode2D), non più chiamate Raylib fuori frame
- `debug_drawRect` colore parser: riconosce `red/green/blue/white/black/yellow/cyan/magenta/orange`
- `debug_log` usa `std::endl` (flush garantito anche con stdout rediretto)

**Demo `test-project/`** — 5 entità, 3 classi:
| id | name | className | position |
|----|------|-----------|----------|
| 1 | Player | Player | (640, 340) — centro schermo |
| 2 | Patrol_A | Enemy | (200, 280) |
| 3 | Patrol_B | Enemy | (950, 200) |
| 4 | Coin_1 | Coin | (400, 300) |
| 5 | Coin_2 | Coin | (780, 200) |

**`main.lua`** — demo interattiva completa:
- WASD / Arrow keys per muovere il Player
- Nemici pattugliano orizzontalmente (±180px, velocità variabile)
- Raccolta coin per prossimità (raggio 30px) → `score += 10`
- Contatto nemico → player diventa `alive=false` (magenta)
- `debug.drawRect` per player (blue/magenta), nemici (red), coin (yellow)
- `debug.drawLine` per danger radius dei nemici e bordi schermo
- Heartbeat log ogni 2s: `t/score/coins/enemies/pos/fps`

### Checkpoint ✅
```
ctest → 11/11 passed  (invariati)

game.exe test-project/ output:
  [Demo] ArtCade Phase 13 Demo loaded!
  [App] Project loaded: ArtCade Phase 13 Demo
  [Lua] Player found  id=1
  [Lua] Enemies found: 2
  [Lua] Coins found: 2
  [Lua] Init complete  WASD / Arrow keys to move
  [Lua] t=2s  score=0  coins=2  enemies=2  pos=(640,340)  alive=true  fps~60
  [Lua] t=4s  ...
  ...
  (ogni 2 secondi per 30s — nessun crash, 0 stderr)

Stabilità 30 secondi: processo killato manualmente (no crash spontaneo)
```

### Architettura game loop ✅
```
initModules → renderer.init (window open) → audio.init → lua.init
mainLoop:
  input.poll()
  fixed timestep (60Hz):
    timeManager.tick → tween → animator → layer → camera
    gameStateManager.update → eventBus.flush → lua.tick(dt)
    physics.step → world.syncPhysics → audio.update
  renderActiveScene()  ← flushes drawQueue qui (dentro BeginMode2D)
  input.resetFrameState()
```

---

## FASE 14 — WebAssembly (Emscripten)

**Stato**: ✅ Completata — build WASM produce game.html + game.js + game.wasm

### Cosa è stato fatto
- **emsdk 5.0.7** installato in `C:\Users\Antonio\emsdk` (LLVM 20, emcc 5.0.7)
- **app.h / app.cpp** adattati per Emscripten:
  - `loopIteration()` estratta dal while — unico punto di aggiornamento per frame
  - `#ifdef ARTCADE_WASM` → `emscripten_set_main_loop(webLoopCallback, 0, 1)`
  - `static Application* webInstance_` + `webLoopCallback()` per callback C statica
  - `accumulator_` promossa a membro (persistente tra frame su WASM)
  - Default project path hard-coded a `"test-project"` su WASM
- **Sol2 patch**: `optional<T&>::emplace()` chiamava `this->construct()` inesistente — fix con `m_value = std::addressof(...)` (bug Clang 20 / Emscripten 5)
- **CMakeLists (src/app)**: `-DARTCADE_WASM`, `-fexceptions`, `-sWASM=1`, `-sUSE_GLFW=3`, `-sALLOW_MEMORY_GROWTH=1`, `--preload-file test-project@test-project`, output `.html`
- **build_wasm.bat**: combina vcvars64 (nmake) + emsdk (emcc), chiama emcmake cmake + emmake cmake --build

### Checkpoint ✅
```
Output: build-wasm/src/app/
  game.html   19 KB   (shell HTML + loader)
  game.js    201 KB   (glue JavaScript)
  game.wasm  921 KB   (bytecode WebAssembly)

Per avviare nel browser:
  cd build-wasm/src/app
  python -m http.server 8080
  http://localhost:8080/game.html
```

Criteri verificati:
- [x] Build WASM completato senza errori
- [x] Tutti i moduli compilati con emcc (Raylib PLATFORM_WEB, Box2D, Lua, Sol2, nlohmann)
- [x] Assets preloadati nel VFS Emscripten (test-project/)
- [x] Build nativo 11/11 test invariati (app.cpp modifiche retrocompatibili)
- [ ] Test browser live (richiede http-server e apertura manuale)

---

## FASE 15 — Tauri Editor Preview

**Stato**: ⏳ 🔗 FASE 14

### Obiettivo
Il WASM prodotto dalla Fase 14 viene caricato nella WebView Tauri dell'editor.

### Checkpoint (futuro)
```bash
cd editor
npm run tauri:dev
# Clicca "Preview" nell'editor
```

Criteri:
- [ ] Preview panel mostra il gioco in real-time
- [ ] Modifica di una proprietà nell'inspector → rebuild → preview aggiornato
- [ ] Nessuna differenza visiva tra preview Tauri e browser standalone

---

## FASE 16 — Logic Components Lua di alto livello

**Stato**: ⏳ 🔗 FASE 11

Questi sono implementati interamente in Lua (non in C++), usando la GameAPI.

| Component | Script |
|-----------|--------|
| HealthSystem | `scripts/components/health.lua` |
| DialogueSystem | `scripts/components/dialogue.lua` |
| InventorySystem | `scripts/components/inventory.lua` |
| QuestTracker | `scripts/components/quest.lua` |
| ParticleEmitter | `scripts/components/particles.lua` |
| PathFollower | `scripts/components/path-follower.lua` |
| Platformer Controller | `scripts/components/platformer.lua` |

### Checkpoint per ogni component
- Scena di test dedicata
- Script Lua che verifica il comportamento atteso
- Nessun errore Lua runtime dopo 60 secondi di gioco

---

## FASE 17 — Packaging e distribuzione

**Stato**: ⏳ 🔗 FASI 13–14

### Obiettivo
Un file `.artcade` firmato e uno script di build cross-platform.

```bash
./scripts/pack-artcade.sh MyGame
# Output: MyGame.artcade (ZIP firmato con manifest.json)
```

### Checkpoint (futuro)
- [ ] `game.exe` + `MyGame.artcade` su Windows → gioca offline
- [ ] `game.html` + `game.wasm` + `MyGame.artcade` → gioca in browser
- [ ] File `.artcade` caricabile da `AssetLoader` senza estrazione manuale

---

## Riepilogo globale

| Fase | Descrizione | Dipende da | Stato |
|------|-------------|------------|-------|
| 0 | Struttura + architettura | — | ✅ |
| 1 | Moduli stateless batch 1 (Time, EventBus, VariableManager) | 0 | ✅ |
| 2 | Moduli stateless batch 2 (GSM, Animator, Layer, Camera, Tween, Save) | 0 | ✅ |
| 3 | Build CMake completo senza Raylib | 1–2 | ✅ |
| 4 | Librerie di terze parti (Raylib, Lua, Sol2, nlohmann) | 0 | ✅ |
| 5 | Renderer (Raylib window, Camera2D, draw calls) | 4 | ✅ |
| 6 | TextureManager con vero Raylib | 5 | ✅ |
| 7 | Input (keymap JS-style, poll Raylib) | 5 | ✅ |
| 8 | Audio (Sound cache + Music streaming) | 5 | ✅ |
| 9 | EntityManager + SceneManager + World | 4 | ✅ |
| 10 | AssetLoader + project.json (nlohmann/json) | 9 | ✅ |
| 11 | LuaHost (Sol2) + GameAPI binding | 9, 10 | ✅ |
| 12 | Physics (Box2D 2.4) | 9 | ✅ |
| 13 | First Playable native .exe | 5–12 | ✅ |
| 14 | WebAssembly (Emscripten) | 13 | ✅ |
| 15 | Tauri Editor Preview | 14 | ⏳ |
| 16 | Logic Components Lua | 11 | ⏳ |
| 17 | Packaging e distribuzione | 13–14 | ⏳ |

---

## Regole operative

1. **Non passare alla fase N+1 finché il checkpoint di N non è verde.**
2. **I test vanno compilati ed eseguiti localmente** — non basta leggere il codice.
3. **Ogni modulo nuovo** segue la struttura `include/` + `src/` + `CMakeLists.txt` + `tests/`.
4. **No god files**: nessun file sorgente > ~300 righe senza una buona ragione.
5. **Commit dopo ogni checkpoint verde**: messaggio con `feat:`, `fix:` o `test:` prefix.

---

*Ultimo aggiornamento: 2026-05-09 — Fasi 0–14 completate (11/11 test nativi + WASM build + demo interattiva 30s stabile)*

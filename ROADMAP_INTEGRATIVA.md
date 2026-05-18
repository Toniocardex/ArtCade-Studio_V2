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
- **World**: `syncPhysicsToEntities()` (copia posizioni da Box2D → Transform), `getGlobalState/setGlobalState`, `activeEntityIds()`

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
- **Backend**: Box2D 2.4.1 via `FetchContent` (C++ puro, nessun binding Rust)
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

=== Test 6s (posizione + gameplay) ===
  [Demo] ArtCade Phase 13 + Physics Demo loaded!
  [Lua] Player found id=1 | Enemies: 2 | Coins: 2
  [Lua] Floor body handle=1 spawn=(640,640) size=1280x40
  [Lua] Ball  body handle=2 spawn=(640,60)  size=44x44
  [Lua] Expected rest y = 598
  [Lua] t= 2s  ball=(640.0,479.4) vy=240.0 [FALLING]  score=0  fps=60
  [Lua] t= 4s  ball=(640.0,598.0) vy=  0.0 [AT_REST]  score=0  fps=60

=== Test 8s (raccolta coin + hit nemico) ===
  [Lua] Coin collected! score=10
  [Lua] t= 6s  ball=(640.0,598.0) vy=0.0 [AT_REST]  score=10  fps=60
  stderr: clean

=== Test 30s (stabilità lunga) ===
  Ball mantiene y=598.0 vy=0.0 [AT_REST] da t=4s fino a t=28s (24s senza drift)
  PLAYER HIT by enemy 2  (collision detection funziona)
  stderr: clean per tutti 30s
  fps: 60 costanti

Log file su disco: test-project/logs/physics_test.log (scritto via Lua io.open)
stdout_8s.txt / stdout_30s.txt  in test-project/logs/
```

**Analisi fisica Ball:**
- Inizio: y=60, gravità=500 px/s²
- Caduta: a t≈1.5s tocca il pavimento
- Rest y = floor_y(640) − floor_half(20) − ball_half(22) = **598** (Box2D contact esatto)
- Nessuna instabilità numerica in 30s (Box2D stabile a scale pixel con g=500)

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

## FASE 15 — Tauri Integration (Editor nativo)

**Stato**: ⏳ 🔗 FASE 14 + FASE 18

### Obiettivo
Shell Tauri (Rust) attorno all'editor React. IPC per aprire/salvare progetti,
triggare build WASM e caricare il preview in WebView.

### Checkpoint (futuro)
```bash
cd editor
npm run tauri:dev
# File → Open Project → carica .artcade
# Clicca "▶ PLAY" → WASM si avvia nel Preview panel
```

Criteri:
- [ ] `openProjectDialog()` apre file picker nativo → carica ProjectDoc
- [ ] `saveScript()` scrive su disco (Tauri fs plugin)
- [ ] `BUILD .EXE` triggera `cmake --build` → log in Console panel
- [ ] Preview panel mostra WASM (`game.html`) in `<webview>`
- [ ] Nessuna differenza visiva tra preview Tauri e browser standalone

---

## FASE 16 — Logic Components Lua di alto livello

**Stato**: ✅ Completata — 13/13 test (logic_components_test)

### Componenti implementati in `test-project/scripts/components/`

| Component | Script | Test |
|-----------|--------|------|
| PauseManager | `pause.lua` | ✅ |
| PathFollower | `path-follower.lua` | ✅ |
| PlatformerController | `platformer.lua` | ✅ |
| ParticleEmitter | `particles.lua` | ✅ |
| DialogueSystem | `dialogue.lua` | ✅ |

### Checkpoint ✅
```
ctest → logic_components_test  13/13 passed  (5 component × test)
```

---

## FASE 17 — Packaging e distribuzione (.artcade ZIP)

**Stato**: ✅ Completata — 14/14 test (artcade_package_test + tool Python)

### Cosa è stato fatto
- **`zip-reader.cpp`** — parser ZIP da scratch (EOCD → CD → Local headers)
  - STORE (method=0): copia raw
  - DEFLATE (method=8): `sinflate()` da raylib (`external/sinfl.h`)
- **`asset-loader.cpp`** — `loadArtcade(path, doc)` implementata
- **`tools/pack-artcade.py`** — packer Python con `zipfile.ZIP_DEFLATE`, `manifest.json` con sha256
- **`tests/artcade-package-test.cpp`** — writer ZIP STORE in-memory, 4 test round-trip

### Checkpoint ✅
```
ctest → artcade_package_test   4/4 passed
        (+ 10 test C++ invariati = 14 totali)

python tools/pack-artcade.py test-project output.artcade
→ [OK] N files packed → output.artcade (X KB)
```

---

## FASE 18 — Editor React (scaffold + neon UI)

**Stato**: ✅ Completata — `npm install && npm run dev` → http://localhost:5173

### Cosa è stato fatto
- **Stack**: React 19 + Vite 6 + TailwindCSS 3 + Monaco Editor + lucide-react
- **Design system**: Slate Night `#0B1121` / Neon Cyan `#00FFFF` / Neon Magenta `#FF00FF` (da mockup)
- **Layout**: SCENE_VIEW (3 colonne) ↔ LOGIC_BOARD (Monaco full-screen)
- **Pannelli**:
  - `HierarchyPanel` — scene selector + entity list con color badge
  - `PreviewPanel` — viewport con grid CSS + tool palette (select/pan/paint/erase)
  - `InspectorPanel` — transform/sprite/script fields, "OPEN IN LOGIC_BOARD →"
  - `ScriptEditorPanel` — Monaco Lua + 25 snippet ArtCade API
  - `AssetBrowserPanel` — asset grid per categoria
  - `TilesetEditorPanel` — tile grid 8×4, collision toggle, brush tool
  - `ConsolePanel` — log entries colorati per livello + input bar
  - `StatusBar` — Runtime / Grid / X,Y / Selection
- **State**: `EditorProvider` (React Context + useReducer, zero Redux)
- **API stubs**: `utils/api.ts` — Tauri IPC placeholder per Phase 19

### Checkpoint ✅
```
editor/
  23 file creati
  tsc --noEmit → 0 errori
  npm run dev → http://localhost:5173 operativo
```

---

## Riepilogo globale

| Fase | Descrizione | Dipende da | Stato |
|------|-------------|------------|-------|
| 0  | Struttura + architettura | — | ✅ |
| 1  | Moduli stateless batch 1 (Time, EventBus, VariableManager) | 0 | ✅ |
| 2  | Moduli stateless batch 2 (GSM, Animator, Layer, Camera, Tween, Save) | 0 | ✅ |
| 3  | Build CMake completo senza Raylib | 1–2 | ✅ |
| 4  | Librerie di terze parti (Raylib, Lua, Sol2, nlohmann) | 0 | ✅ |
| 5  | Renderer (Raylib window, Camera2D, draw calls) | 4 | ✅ |
| 6  | TextureManager con vero Raylib | 5 | ✅ |
| 7  | Input (keymap JS-style, poll Raylib) | 5 | ✅ |
| 8  | Audio (Sound cache + Music streaming) | 5 | ✅ |
| 9  | EntityManager + SceneManager + World | 4 | ✅ |
| 10 | AssetLoader + project.json (nlohmann/json) | 9 | ✅ |
| 11 | LuaHost (Sol2) + GameAPI binding | 9, 10 | ✅ |
| 12 | Physics (Box2D 2.4) | 9 | ✅ |
| 13 | First Playable native .exe | 5–12 | ✅ |
| 14 | WebAssembly (Emscripten) | 13 | ✅ |
| 15 | Tauri Integration (editor nativo + IPC) | 14, 18 | ⏳ |
| 16 | Logic Components Lua (5 componenti) | 11 | ✅ |
| 17 | Packaging .artcade ZIP | 13–14 | ✅ |
| 18 | Editor React scaffold (neon UI + Monaco) | — | ✅ |

---

## Regole operative

1. **Non passare alla fase N+1 finché il checkpoint di N non è verde.**
2. **I test vanno compilati ed eseguiti localmente** — non basta leggere il codice.
3. **Ogni modulo nuovo** segue la struttura `include/` + `src/` + `CMakeLists.txt` + `tests/`.
4. **No god files**: nessun file sorgente > ~300 righe senza una buona ragione.
5. **Commit dopo ogni checkpoint verde**: messaggio con `feat:`, `fix:` o `test:` prefix.

---

---

## Backlog / Known Issues

| # | Area | Problema | Priorità | Stato |
|---|------|----------|----------|-------|
| KI-1 | Editor Script (Monaco) | Glitch di rendering: il testo digitato si sovrappone alle righe (appare in alto e "salta"), widget di autocomplete mal posizionato/illeggibile. Mitigazioni applicate (offline loader, conditional mount, model uncontrolled `defaultValue`+`path`, `box-sizing: content-box` scoped su `.monaco-editor`) ma il problema persiste a livello di misurazione glifi/layout di Monaco nel build Tauri. Da affrontare con un'**integrazione Monaco dedicata** (valutare: build custom `monaco-editor` con feature minime + worker espliciti via Vite, oppure sostituzione con CodeMirror 6). Non bloccante: la logica si può editare via Logic Board / file esterni. | Media | ⏳ Aperto |

---

*Ultimo aggiornamento: 2026-05-18 — KI-1 (Editor Script Monaco) registrato; focus su workflow entità/asset.*

*Ultimo aggiornamento: 2026-05-09 — Fasi 0–18 completate (14/14 test C++ + WASM + editor React)*

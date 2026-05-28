# ArtCade V2 — Recap engine per collaboratori

> **Versione:** 2026-05-28  
> **Audience:** team editor, runtime C++, gameplay, product  
> **Scopo:** onboarding rapido + link operativi. **Documento di progettazione completo:** [`ENGINE_DESIGN_RECAP.md`](ENGINE_DESIGN_RECAP.md) (allineato al repo, aggiornato dal team).

---

## In 60 secondi

ArtCade V2 è un **motore 2D dual-runtime** (native Raylib + WASM Emscripten) con:

- **Dati** in ECS (EnTT) + **regole di gioco** in **Logic Board → Lua** (compilato a runtime).
- **Nessuna logica di gameplay in C++** (niente `CoinBehaviour::update()`): i componenti sono **dati JSON**; il feel platformer è **kinematic + grounding AABB** in `World` (`world_platformer_controller.cpp` + `resolvePlatformerSolidSurfaces`).
- **Object Types v2** (catalogo tipi + istanze in scena): stesso modello mentale di Construct/Unity prefab; pool Lua = `className` === `objectTypeId`.
- **Fisica custom** (no Box2D): MTV AABB, physics opzionale per top-down/dynamic; overlap geometrico per Logic Board (`collision.touchingClass`, `firstTouching`).

**Non implementato (ancora):** ladder, slope, Dialog System, RuleEngine C++, eventpp, catalogo `IBehavior`, piattaforme mobili che trascinano il player, debug overlay Logic Board in PLAY.

**Leggi per intero:** [`ENGINE_DESIGN_RECAP.md`](ENGINE_DESIGN_RECAP.md) (§1–12, nomenclatura, roadmap, Dialog design intent).

---

## Paradigma: cosa va dove

| Layer | Responsabilità | Dove nel repo |
|-------|----------------|---------------|
| **ECS (EnTT)** | Transform, componenti, gateway spawn/destroy | `runtime-cpp/src/modules/runtime-entity-gateway/` |
| **World / sistemi** | Platformer, sensor, mover, grounding | `runtime-cpp/src/world/` |
| **Physics (opzionale)** | Dynamic/static, CCD parziale, sync body→Transform | `runtime-cpp/src/modules/physics/` |
| **Logic Board** | When/Then visuale, compilazione | `editor/src/utils/logic-board/`, `editor/src/panels/LogicBoardPanel.tsx` |
| **Lua** | Tick gameplay, API `entity`/`collision`/`pool`/`state` | `runtime-cpp/src/engine/lua-host.*`, `game-api.*` |
| **Editor / progetto** | `project.json` v2, Object Types, preview WASM | `editor/src/utils/project-*.ts`, `runtime-fingerprint.ts` |

**Regola d’oro:** se la regola è “quando il player tocca la moneta, distruggi la moneta”, va sulla **Logic Board del tipo Player** (o script Lua), non in un behaviour C++.

---

## Flusso di un frame (PLAY)

Ordine canonico in `Application::tickFixedStep` — dettaglio in [`FIXED_STEP_CONTRACT.md`](FIXED_STEP_CONTRACT.md):

1. Gameplay systems (mover, top-down, …) — **non** platformer
2. **`luaHost.tick`** — intent movement/platformer, regole compilate
3. **`tickPlatformerControllers`** — integrazione kinematic + `resolvePlatformerSolidSurfaces` (solid / one-way / tilemap)
4. **`physics.step`** (se `physicsMode` lo consente)
5. Sync physics → Transform, sensor edges, lifecycle, auto-destroy

**Nota:** non esiste una pipeline “eventpp → RuleEngine C++ → When/Then”. Le regole When/Then sono **compilate in Lua** ed eseguite nel tick Lua o negli handler registrati (`onMessage`, `onCollision*`, …).

---

## Logic Board e messaggi

| Funzionalità | Stato | Note |
|--------------|-------|------|
| When / Then, `wait`, `repeatTimes` | ✅ | Schemi JSON + compiler TS→Lua |
| Variabili globali `state.*` | ✅ | Blackboard condiviso |
| Messaggi `event.emit` / `onMessage` | ✅ | Bus custom (`EventBus`), non eventpp |
| Target regole su **Object Type** | ✅ | Preferire `object_type` vs `entity_class` legacy |
| Collisioni per regole pickup | ✅ | Overlap geometrico + `collision.firstTouching` |
| Debug overlay board in runtime | ❌ | Solo `debug.*` Lua / log |

**Ricetta pickup (designer):** Logic Board sul tipo **Player**: *While touching `Coin`* → *Destroy objects of class `Coin`*. Non usare *Destroy This* sul player.

Vedi: [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md), [`OBJECT_TYPES_ARCHITECTURE.md`](OBJECT_TYPES_ARCHITECTURE.md).

---

## Object Types (formato progetto v2)

Implementato e in produzione su `main`:

| Concetto | Storage | Runtime |
|----------|---------|---------|
| **Object Type** | `project.objectTypes[id]` | Prototype + Logic Board default |
| **Istanza scena** | `scenes[].instances[]` | `transform`, `instanceName`, `visible` |
| **Pool / classe** | `className` === `objectTypeId` | `pool.getAll("Coin")` in Lua |

- **Salvataggio:** `formatVersion: 2`; legacy `entities` solo in lettura alla migrazione.
- **Merge:** editor e C++ materializzano `EntityDef` = tipo + override istanza.
- **Migrazione:** banner in editor se progetto ancora solo `entities`.

---

## Componenti gameplay (al posto di “Behavior System”)

Il design esterno parla spesso di `IBehavior::attach(Platformer)`. In ArtCade i **preset** sono **campi JSON** su `ObjectTypeDef` / `EntityDef`:

| Componente / concetto | Ruolo | Stato |
|----------------------|-------|-------|
| `platformerController` | Velocità, salto, coyote, jump buffer | ✅ |
| `solid` + `surfaceKind` | Solid / **oneWay** | ✅ |
| `sensor` | Trigger enter/exit → eventi | ✅ |
| `linearMover`, top-down, magnet, horde, health | Sistemi World | ✅ parziale per feature |
| `RigidbodyComponent` (nome recap) | Equivalente: `PhysicsComponent` + `BodyType` | ✅ nomi diversi |
| **Slope** | Risoluzione pendenze | ❌ |
| **Ladder** | Arrampicata / stato OnLadder | ❌ |

Coyote time e jump buffer: `PlatformerControllerComponent` + `world_platformer_controller.cpp` (test in `world-intent-test.cpp`).

---

## Fisica

| Aspetto | Design target (doc esterni) | ArtCade oggi |
|---------|----------------------------|--------------|
| Motore | Custom Raymath, no Box2D | ✅ `collision_math.h`, `physics.cpp` |
| Separazione AABB | MTV asse minimo | ✅ `resolveAabbSeparation` |
| Platformer | Due pass Y poi X su EnTT | 🟡 **Diverso:** kinematic + multi-pass grounding (`resolvePlatformerSolidSurfaces`) |
| Tunneling | Swept AABB generale | 🟡 CCD limitato su dynamic in `physics.cpp` |
| `getWorldRect` | Helper Transform+Collider | 🟡 `shapeWorldAabb` / `worldAabb` |
| Piattaforme mobili | Player eredita velocità carrier | 🟡 `linearMover` muove entità; eredità velocità non documentata |

`physicsMode`: `off` | `auto` | `on` — vedi [`PHYSICS_OPTIONAL_INTEGRATION_PLAN.md`](PHYSICS_OPTIONAL_INTEGRATION_PLAN.md).

---

## Tabella riepilogo: design doc vs codice

Legenda: **✅** allineato · **🟡** parziale o equivalente diverso · **❌** non presente · **➕** solo in ArtCade

| Area | Design / recap esterno | Repo ArtCade |
|------|------------------------|--------------|
| ECS EnTT | ✅ | ✅ `EntityRegistry`, gateway |
| Logic Board → Lua | ✅ | ✅ compiler + `main.lua` |
| sol2 (non LuaBridge) | ✅ | ✅ |
| eventpp + RuleEngine C++ | Target | 🟡 `EventBus` custom; regole in **Lua compilato** |
| IBehavior catalog | Target | 🟡 componenti JSON + Object Types |
| Object Types / prefab | — | ➕ **v2 implementato** |
| Coyote + jump buffer | ✅ | ✅ |
| One-way platforms | ✅ | ✅ |
| Ladder / Slope | Roadmap | ❌ |
| Physics Y-pass poi X-pass | Pseudocodice recap | 🟡 pipeline platformer diversa |
| onMessage / state globali | ✅ | ✅ |
| Geometric collision per board | ✅ | ✅ `entity_collision_query` |

---

## Roadmap aperta (priorità indicative)

| Priorità | Item | Note |
|----------|------|------|
| Alta | **Slope** collision resolution | Non iniziato |
| Alta | **Ladder** (componente + sistema) | Non iniziato |
| Media | Piattaforme mobili (velocity inheritance) | Valutare con `linearMover` esistente |
| Media | Swept AABB / CCD più generale | Solo parziale su dynamic |
| Bassa | Debug overlay Logic Board in PLAY | UX runtime |
| Bassa | Allineare doc esterni a EventBus + Lua (no RuleEngine C++) | Doc only |

Tracker operativo C++: [`ENGINE_INTEGRATION_ROADMAP.md`](ENGINE_INTEGRATION_ROADMAP.md).  
Stato architettura §11: [`ARCHITETTURA_TECNICA_ENGINE_2D.md`](ARCHITETTURA_TECNICA_ENGINE_2D.md).

---

## Percorso di lettura consigliato

### Tutti (30–45 min)

1. [`ARCHITECTURAL_RATIONALE.md`](ARCHITECTURAL_RATIONALE.md) — perché ECS, WASM, canvas black box  
2. [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) — Parte I glossario + Parte III  
3. **Questo file** — stato reale vs target  
4. [`OBJECT_TYPES_ARCHITECTURE.md`](OBJECT_TYPES_ARCHITECTURE.md) — se lavori su editor o gameplay data-driven  

### Sviluppatore C++ / gameplay

1. [`FIXED_STEP_CONTRACT.md`](FIXED_STEP_CONTRACT.md)  
2. [`GLOBAL_LOGIC_UI_ARCHITECTURE.md`](GLOBAL_LOGIC_UI_ARCHITECTURE.md)  
3. [`ECS_IMPLEMENTATION_GUIDE.md`](ECS_IMPLEMENTATION_GUIDE.md)  
4. [`REPORT_MIGRAZIONE_PHYSICS_SENZA_BOX2D.md`](REPORT_MIGRAZIONE_PHYSICS_SENZA_BOX2D.md)  

### Sviluppatore React / editor

1. [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) §5.5  
2. [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md)  
3. [`CODEMIRROR_EDITOR.md`](CODEMIRROR_EDITOR.md)  

### Build e test locali

- Editor: `cd editor; npm test -- --run`  
- Native runtime: `runtime-cpp/build` Release + CTest  
- WASM preview: `runtime-cpp/build_wasm.bat` → `editor/public/runtime/`  
- Tauri: chiudere `artcade-editor.exe` prima di rebuild (lock file Windows)  

Setup completo: [`README.md`](../README.md) (root).

---

## Diagramma: architettura reale (non il target “RuleEngine”)

```
┌─────────────────┐     compile      ┌──────────────┐
│  Logic Board    │ ───────────────► │  main.lua    │
│  (editor JSON)  │                  │  (bytecode)  │
└─────────────────┘                  └──────┬───────┘
                                              │ luaHost.tick
┌─────────────────┐     materialize    ┌─────▼───────┐
│ objectTypes +   │ ───────────────► │    World     │
│ scene instances │                  │ platformer   │
└─────────────────┘                  │ sensors      │
                                     └─────┬───────┘
                                           │ optional
                                     ┌─────▼───────┐
                                     │  physics    │
                                     │  .step      │
                                     └─────────────┘
         EnTT ◄── RuntimeEntityGateway (spawn, components, pools)
```

---

## Domande frequenti per il team

**D: Posso mettere la logica del pickup in C++?**  
A: Evitalo. Usa Logic Board sul tipo Player o Lua; il runtime espone già overlap e destroy per classe.

**D: `entity_class` o `object_type` sulla board?**  
A: Preferisci **`object_type`**. `entity_class` è alias legacy in migrazione.

**D: Il player ha un Rigidbody?**  
A: Spesso **no** in template platformer (`physicsMode: off`). Il Transform è authority; opzionale body kinematic follower.

**D: Box2D?**  
A: Rimosso. Fisica custom documentata nel report migrazione.

**D: Dove è la “verità” sull’ordine del frame?**  
A: [`FIXED_STEP_CONTRACT.md`](FIXED_STEP_CONTRACT.md) + sorgente `app.cpp`.

---

## Changelog documento

| Data | Modifica |
|------|----------|
| 2026-05-27 | Prima versione: recap design vs codice, Object Types v2, percorsi lettura |

---

*Per aggiornamenti architetturali estesi usare [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) e [`docs/README.md`](README.md). Questo recap va aggiornato quando cambiano contratti grossi (formato progetto, tick order, physics mode).*

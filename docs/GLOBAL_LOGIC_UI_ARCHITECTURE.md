# ArtCade V2: Global Logic & UI Architecture

> **Versione:** 1.1
> **Data:** 2026-05-26
> **Stato:** Specifica di alto livello (logica, fisica arcade, UI) — runtime physics: custom solver (`collision_math` + Raymath) (2026-05)
> **Audience:** Runtime C++, editor UI, game design

Questo documento riassume le specifiche finalizzate per i sistemi di **logica**, **fisica arcade** e **interfaccia utente**.

---

## 0. Object Types (project format v2)

Rules live on **object types** (`project.objectTypes`), not on every scene instance. Scene rows are **instances** (`scene.instances`: `objectTypeId`, `transform`, optional `instanceName`). Runtime pool key `className` === `objectTypeId` (e.g. `"Player"`, `"Coin"`).

| Concern | Where |
|---------|--------|
| Sprite, components, default Logic Board | Object Type |
| Position, visibility, display name | Scene instance |
| Logic Board target (preferred) | `{ type: "object_type", objectTypeId: "Player" }` |
| Pickup recipe | Board on **Player**: While touching **Coin** → Destroy objects of class **Coin** (not Destroy This) |

Full spec: [`OBJECT_TYPES_ARCHITECTURE.md`](OBJECT_TYPES_ARCHITECTURE.md).

---

## 1. Physics & proximity (sensor system)

Il modulo **Physics** (solver custom, broadphase lineare) gestisce overlap, raycast e corpi dynamic/kinematic/static; il platformer usa AABB separato su **Solid** / tilemap.

### Sensor component

- Volume **sensor** (trigger) che rilevano entità tramite **`onTriggerEnter`** / **`onTriggerExit`** (overlap physics + event bus).

### Body types

| Tipo | Uso |
|------|-----|
| **Static** | Terreno, piattaforme fisse (`Solid` crea body statico anche senza blocco Physics in JSON). |
| **Kinematic** | Player con **Physics** esplicito + `PlatformerController`: overlap/collisioni physics; movimento da **Transform** (push al body, mai pull). |
| **Dynamic** | Oggetti con massa, rimbalzo, forze esterne (`physics.applyImpulse` / `applyForce`). |

### Platformer kinematic vs Physics module (2026-05)

| Aspetto | Platformer solo (`platformerController`) | + Physics collider esplicito |
|---------|------------------------------------------|------------------------------|
| Movimento | `Transform` + `platformerRt_.velocity` in C++ | Stesso (transform autoritativo) |
| Physics body | **Nessuno** | **Kinematic** (overlap / `onCollision*`) |
| Grounded | AABB vs entità **Solid** (`groundClass`) | Idem (+ opzionale overlap body) |
| `world.physicsMode` | `auto` salta `step` se zero bodies | `auto`/`on` quando ci sono solid/sensor/player collider |
| Logic Board collision | **Overlap geometrico** (Transform + hitbox default 32×scale); Physics opzionale per tuning | `onCollision` / Enter / Exit |

**Arcade senza fisica (Flappy, shmup):** `world.physicsMode: off` o `auto` senza Solid/Sensor/Physics; usa **Transform**, **LinearMover**, **onMessage**, o **Sensor** (`onTriggerEnter`/`Exit`) per pickup/zone.

---

## 2. Platformer controller (game feel)

Componente / modulo specializzato per corpi **kinematic** che implementa:

| Meccanica | Descrizione |
|-----------|-------------|
| **Coyote time** | Il salto resta possibile per **X ms** dopo aver lasciato una piattaforma (tolleranza percepita). |
| **Jump buffer** | Memorizzazione dell'input di salto **prima** di toccare terra, applicata al prossimo atterraggio valido. |
| **Variable gravity** | Gravita **maggiore in discesa** rispetto alla salita per caduta piu "pesante" e controllo piu preciso. |

---

## 3. Core system actions (universal nodes)

Azioni che **non** sono legate a una singola entita ma governano il **World**:

| Area | Comportamento atteso | Stato runtime (2026-05) |
|------|----------------------|-------------------------|
| **Spawn / destroy** | Kill queue **post physics step** | `entity.destroy` / `object.destroy` in coda; flush dopo `physics.step` (`RuntimeEntityGateway`). `object.spawn` immediato nella scena attiva. |
| **Global state** | Variabili persistenti tra scene | `state.*` → `VariableManager` (blackboard globale); **non** svuotato su `scene.load`. |
| **Scene manager** | Caricamento scene, restart | `scene.load(name)` cambia scena attiva, attiva/disattiva entità (`sceneActive`), physics body on/off. |

Allineamento con [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) e API Lua in `runtime-cpp/src/modules/game-api/`.

---

## 4. UI system (screen space)

Sistema di rendering **separato** dal mondo di gioco (camera / world space).

| Elemento | Specifica |
|----------|------------|
| **RectTransform** | Ancoraggio a **9 punti** (es. top-left, center, stretch orizzontale/verticale, ecc.). |
| **Image** | Supporto **9-slice** (sliced) per pannelli scalabili. |
| **Button** | Stati hover / pressed con eventi verso **Logic Board** (o script Lua) come contratto input. |
| **Text** | Rendering preferibilmente con **font SDF** (Signed Distance Fields) per nitidezza a scale diverse. |

---

## 5. Text effects ("juice" library)

Effetti nativi per aumentare la **qualita percepita** del gioco.

| Effetto | Caso d'uso | Logica (C++ / pipeline) |
|---------|------------|-------------------------|
| **Floating text** | Danni, XP, pop-up | Spawn temporaneo con **scatter** (direzione pseudo-random). |
| **Typewriter** | Dialoghi RPG | Rivelazione **progressiva** dei caratteri via timer. |
| **Wavy / jitter** | Testo "vivo" | Offset **sinusoidale** o randomico **per glifo**. |
| **Pop-in** | Game over, menu | **Easing elastico** (es. BackOut) sulla scala del `RectTransform`. |

---

## Sensor e platformer (implementazione)

- **Sensor:** shape aggiuntiva (`Physics::setSensorFixture`) da `EntityDef.sensor`; enter/exit in `World::tickSensorOverlapEdges`.
- **Platformer:** `PlatformerControllerComponent` applicato in C++ in `World::tickPlatformerControllers` (coyote, jump buffer, rising-edge `requestJump`) — **unica verità** per fisica platformer. Logic Board: `controllerMovement` + `requestPlatformerJump` con tasto **`pressed`**. Lo script opzionale `platformer.lua` registra solo input verso `movement`/`platformer` API (non usare insieme al componente sullo stesso entity).

### Logic Board — capability matrix (collision vs sensor)

| Trigger | Richiede | Note |
|---------|----------|------|
| `onCollision` / `onCollisionEnter` / `onCollisionExit` | Entità in scena con Transform; `withClass` sulla controparte | Runtime: `collision.touchingClass` / `collision.firstTouching` (kernel geometrico). Physics (Collider) opzionale per hitbox custom. `physicsMode: off` OK per pickup. |
| `onTriggerEnter` / `onTriggerExit` | **Sensor** sulla zona + tag (`targetTag`) | Path separato (physics sensor fixture) |

**Ricetta pickup (hero + coin):** Coin con `className = Coin`, Transform sovrapposto al path del player (nessun Physics obbligatorio). Hero: **While touching** class `Coin` → **Destroy** class `Coin` (first), **oppure** **Starts touching** `Coin` → **Destroy Other** (`other` da `collision.firstTouching`).

L'editor mostra hint informativi (`physics-trigger-capabilities.ts`) se non c'è collider esplicito (default 32×scale).

**Template progetto (File → New Project):** *Arcade (no physics)* (`physicsMode: off`, player senza body) vs *Platformer* (player + `Solid` ground, `physicsMode: auto`).

### Input Lua — coordinate puntatore

| API | Spazio | Uso |
|-----|--------|-----|
| `input.mousePosition()` / `input.mouseScreen()` | Pixel framebuffer (schermo canvas) | UI schermo, debug |
| `input.mouseWorld()` | Mondo gioco (`Renderer::screenToWorld`, stessa camera del draw) | Hit test entity, spawn al puntatore |

Su Emscripten il mouse viene scalato da CSS a framebuffer interno (`pointer-coords`, canvas `#artcade-canvas`) così resize del pannello preview non sposta il pick.

**Logic Board:** trigger **Object clicked** / **hover** / condizione **is mouse over** / azione **spawn at pointer** compilano con `input.mouseWorld()` + `entity.position(self)` (non `mousePosition()`). `onMouseInput` (solo tasto) resta invariato. Azione **Click to destroy** (entity rulesheets) = `clickToDestroy` + trigger **Object clicked** sincronizzato via [`click-to-destroy.ts`](../editor/src/utils/logic-board/click-to-destroy.ts). Soppressione menu contestuale tasto destro in **anteprima Play** = solo editor ([`PreviewPanel.tsx`](../editor/src/panels/PreviewPanel.tsx) `onContextMenu`), non azione Logic Board.

**Compilatore (policy):** usare solo [`luaPointerNearSelfExpr`](../editor/src/utils/logic-board/lua-helpers.ts) e [`luaPointerWorldPairStmt`](../editor/src/utils/logic-board/lua-helpers.ts); test di guardia [`pointer-hit-policy.test.ts`](../editor/src/utils/logic-board/pointer-hit-policy.test.ts).

---

## Logic Board editor (entity-first)

- **Default workflow:** one rulesheet per **entity in the Scenes panel** (`target.type: entity_id`). Labels use `entity.name`; renaming in Inspector updates dropdowns automatically.
- **On demand:** new rulesheets are created only when the user clicks **New rulesheet for selection** (no auto-board on entity add).
- **Advanced:** class-based shared rulesheets (`entity_class`) remain supported for spawn pools and identical mass behavior; `className` on `EntityDef` is for runtime spawn/collision widgets, not board ownership.
- **Lifecycle:** deleting an entity removes its `entity_id` rulesheet; class boards are kept.

---

## Riferimenti incrociati

- [`ArtCade_V2_Riepilogo_Suggerimenti.md`](ArtCade_V2_Riepilogo_Suggerimenti.md) - tassonomia UX 8 gruppi e roadmap editor.
- [`ARCHITETTURA_TECNICA_ENGINE_2D.md`](ARCHITETTURA_TECNICA_ENGINE_2D.md) - pipeline di frame, fisica, sync.
- [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md) - panoramica motore e moduli.
- [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) - Logic Board / Event / Component.
- [`ECS_IMPLEMENTATION_GUIDE.md`](ECS_IMPLEMENTATION_GUIDE.md) - ECS / EnTT (dove i componenti sensor/controller vivono).

---

*Documento generato per lo sviluppo di ArtCade V2 - 2026.*

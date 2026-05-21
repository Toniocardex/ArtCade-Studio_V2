# ArtCade V2: Global Logic & UI Architecture

> **Versione:** 1.0
> **Data:** 2026-05-11
> **Stato:** Specifica di alto livello (logica, fisica arcade, UI)
> **Audience:** Runtime C++, editor UI, game design

Questo documento riassume le specifiche finalizzate per i sistemi di **logica**, **fisica arcade** e **interfaccia utente**.

---

## 1. Physics & proximity (sensor system)

Invece di calcoli matematici espliciti ovunque, ArtCade sfrutta il **broad-phase** di **Box2D** per vicinanza e contatti.

### Sensor component

- Fixture **"ghost"** (sensor) che rilevano entita tramite **`OnEnter`** e **`OnExit`** (o equivalente nel binding verso Box2D / event bus del motore).

### Body types

| Tipo | Uso |
|------|-----|
| **Static** | Terreno, piattaforme fisse. |
| **Kinematic (arcade)** | Player tipico: movimento controllato da script; **non** usa la gravita "fisica" classica come un dynamic puro (policy da definire nel controller). |
| **Dynamic** | Oggetti con massa, rimbalzo, forze esterne. |

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

- **Sensor:** fixture Box2D aggiuntiva (`Physics::addSensorFixture`) da `EntityDef.sensor`; log enter/exit in `World::tickSensorOverlapEdges` (MVP debug).
- **Platformer:** `PlatformerControllerComponent` applicato in C++ in `World::tickPlatformerControllers` (coyote, jump buffer, input WASD/Space) se presente sull'entità della scena attiva.

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

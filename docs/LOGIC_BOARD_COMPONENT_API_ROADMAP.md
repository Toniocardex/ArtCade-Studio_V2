# Logic Board Component API Roadmap

## Obiettivo

Rendere la Logic Board consapevole dei Component runtime presenti sulle entita.
La Board deve esprimere condizioni e azioni di gameplay ad alto livello, mentre
i Component runtime eseguono stato e comportamento ricorrente nel core C++.

Questo documento e il riferimento operativo per integrare nuove API esposte dai
Component dentro la Logic Board.

**Correlato:** integrazione runtime EnTT/gateway/World →
`docs/ENGINE_INTEGRATION_ROADMAP.md`.

**Ultimo allineamento:** `main` @ `20c473d` (2026-05-21).

## Regola Architetturale

- Logic Board orchestra: trigger, condizioni, azioni, intenti.
- Component esegue: stato runtime, simulazione continua, cooldown, steering,
  movement, sensor, health.
- Core simula: World, RuntimeEntityGateway, EnTT, physics e renderer.
- Le API low-level restano disponibili come livello Advanced / Generic.
- Non creare "Behavior" Lua nascosti: il termine e il modello corretto e
  Component runtime.
- Ogni nuova API deve essere schema-first: type TS, JSON schema, factory,
  compiler, label e test devono cambiare insieme.

## Component API Matrix

| Component | Logic Board API | Stato |
| --- | --- | --- |
| TopDownControllerComponent | Move left/right/up/down, stop, movement vector | Tranche 1 |
| PlatformerControllerComponent | Move left/right, stop horizontal movement, jump | Tranche 1 |
| SensorComponent | Trigger enter/exit su tag target | Gia disponibile |
| HealthComponent | Damage, heal, set health, compare health | Tranche 1 |
| CameraTargetComponent | Camera follows target | Gia disponibile come action generica |
| LinearMoverComponent | Set direction/speed, pause/resume mover | Tranche 2 |
| MagneticItemComponent | Enable/disable magnet, set target tag/radius/speed | Tranche 2 |
| HordeMemberComponent | Set target class, set chase/separation weights | Tranche 2 |
| AutoDestroyComponent | Set/cancel lifespan | Tranche 2 |
| SolidComponent | Ground class per `isGrounded` (runtime); nessun blocco LB MVP | Nessuna azione Tranche 1; `platformer.isGrounded` in Tranche 2 |

## Tranche 1 - Capability Registry + API Esistenti

Stato: completata.

Obiettivi:

- Aggiungere un registry editor-side delle capability Component -> Logic Board.
- Mostrare nel picker Logic Board le API consigliate per i Component presenti
  sull'entita o sulla classe target.
- Aggiungere warning UI quando un blocco richiede un Component non presente.
- Introdurre action/condition schema-first per API gia disponibili:
  - `moveController`
  - `setMovementIntent`
  - `clearMovementIntent`
  - `requestPlatformerJump`
  - `damageEntity`
  - `healEntity`
  - `setEntityHealth`
  - `compareHealth`
- Compilare verso API Lua gia esistenti:
  - `movement.setIntent`
  - `movement.clearIntent`
  - `platformer.requestJump`
  - `entity.damage`
  - `entity.health`
  - `entity.setHealth`

## Tranche 2 - Component Runtime API Mancanti

Stato: completata.

Completato (runtime C++ + editor):

- `component-api.cpp`: tabelle Lua `linearMover`, `magnet`, `horde`, `autoDestroy`,
  `platformer.isGrounded`.
- Campi runtime-only: `LinearMoverComponent._paused`, `MagneticItemComponent._enabled`;
  preservati in `applyEntityDefToRegistry` su patch editor.
- `World::isPlatformerGrounded` (pubblico) + skip tick quando pausa/disabilitato.
- Logic Board: 10 azioni + condizione `isPlatformerGrounded` (schema, compiler,
  capabilities, label).

API esposte:

- `linearMover.setDirection`, `linearMover.setSpeed`, `linearMover.pause`, `linearMover.resume`
- `magnet.setEnabled`, `magnet.setTargetTag`
- `horde.setTargetClass`, `horde.setWeights`
- `autoDestroy.setLifespan`, `autoDestroy.cancel`
- `platformer.isGrounded`

## Tranche 3 - UI Logic Board Piu Guidata

Stato: da fare.

Obiettivi:

- Separare visivamente:
  - Recommended for this object
  - Component APIs
  - Advanced / Generic
- Aggiungere hint per spiegare quando un blocco usa un Component runtime.
- Aggiungere quick-add Component dall'avviso, se utile.
- Valutare preset di regole comuni:
  - player movement top-down
  - platformer jump
  - coin collected
  - damage on sensor enter

## Checklist Per Ogni Nuova API Component

- Verificare che il comportamento appartenga a un Component runtime e non a un
  loop Lua generico.
- Se serve una nuova API runtime, implementarla prima nel core/gateway in modo
  deterministico.
- Aggiornare:
  - tipi TypeScript Logic Board;
  - schema JSON;
  - factory default;
  - label e summary;
  - compiler Lua;
  - capability registry;
  - test compiler e resolver.
- Mantenere le API low-level in Advanced / Generic.
- Aggiornare questo documento e `ENGINE_INTEGRATION_ROADMAP.md`.

## Test Plan Ricorrente

- `npm.cmd test`
- `npm.cmd run build`
- Test compiler per ogni action/condition nuova.
- Test resolver capability per entity board e class board.
- Build C++ e WASM solo quando cambia runtime C++ o runtime WASM.

## Stato Avanzamento

| Tranche | Stato | Commit di riferimento |
| --- | --- | --- |
| 1 — Capability registry + API esistenti | Completata | `20c473d` |
| 2 — API runtime mancanti | Completata | (commit Tranche 2) |
| 3 — UI guidata | Da fare | — |

Runtime prerequisiti (gia in `main` prima della Tranche 1 editor):

- `d7ba0ed` — `SolidComponent` + `World::isGrounded`
- `b707874` — split modulo `World` + lifecycle scena
- `1d8f78c` — `entity.damage`, `World::tickAutoDestroy`, fix build

Ultima validazione Tranche 1:

- `npm.cmd test`: 212/212 passati (`component-capabilities.test.ts`,
  `compiler.test.ts` health/controller).
- `npm.cmd run build`: passato.
- Nessun rebuild C++/WASM obbligatorio: la tranche usa solo API Lua gia esistenti.
- Build C++/WASM gia verificate su `main` (18/18 `ctest`, `build_wasm.bat` OK).

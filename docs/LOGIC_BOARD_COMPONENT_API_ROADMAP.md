# Logic Board Component API Roadmap

## Obiettivo

Rendere la Logic Board consapevole dei Component runtime presenti sulle entita.
La Board deve esprimere condizioni e azioni di gameplay ad alto livello, mentre
i Component runtime eseguono stato e comportamento ricorrente nel core C++.

Questo documento e il riferimento operativo per integrare nuove API esposte dai
Component dentro la Logic Board.

**Correlato:** integrazione runtime EnTT/gateway/World →
`docs/ENGINE_INTEGRATION_ROADMAP.md`.
Principio UI/prodotto per questi componenti →
`docs/ARTIST_FRIENDLY_COMPONENTS.md`.

**Ultimo allineamento:** working tree 2026-06-12.

## Regola Architetturale

- Logic Board orchestra: trigger, condizioni, azioni, intenti.
- Component esegue: stato runtime, simulazione continua, cooldown, steering,
  movement, sensor, health.
- Core simula: World, RuntimeEntityGateway, EnTT, physics e renderer.
- Le API low-level restano disponibili come livello Advanced / Generic.
- Non creare "Behavior" Lua nascosti: il termine e il modello corretto e
  Component runtime.
- Esporre i numeri di design reali (speed, damage, cooldown, radius, durata)
  quando servono al bilanciamento; evitare preset opachi se nascondono il
  valore effettivo.
- Spostare dettagli engine-only in Advanced: delta time, handle fisici,
  fixture, registry, sync, callback raw.
- Ogni nuova API deve essere schema-first: type TS, JSON schema, factory,
  compiler, label e test devono cambiare insieme.

## Component API Matrix

| Component | Logic Board API | Stato |
| --- | --- | --- |
| TopDownControllerComponent | Move left/right/up/down, stop, movement vector; set max speed / acceleration / friction / four-directions | Tranche 1 + setter runtime (2026-06-12) |
| PlatformerControllerComponent | Move left/right, stop horizontal movement, jump; set max speed / jump force / gravity | Tranche 1 + setter runtime (2026-06-12) |
| SensorComponent | Trigger enter/exit su tag target | Gia disponibile |
| HealthComponent | Damage, heal, set health, compare health; trigger onDamaged / onHealthDepleted | Tranche 1 + onDamaged (2026-06-12) |
| CameraTargetComponent | Follow automatico deterministico, override, stop/ripristino | Integrato |
| LinearMoverComponent | Set direction/speed, pause/resume mover | Tranche 2 |
| MagneticItemComponent | Enable/disable, target tag, radius, pull speed | Integrato |
| HordeMemberComponent | Target class, speed, separation radius e pesi | Integrato |
| AutoDestroyComponent | Set/cancel lifespan | Tranche 2 |
| SolidComponent | Ground class per `isGrounded` (runtime); nessun blocco LB MVP | Nessuna azione Tranche 1; `platformer.isGrounded` in Tranche 2 |
| DialogComponent / DialogManager | Start by ID, end active dialog, is active | Integrato |
| TextComponent | Label (text, font, size, color, align, offset); auto-bind a variabile con formato (intero/zero-pad/tempo m:ss/percento/decimali) + prefix/suffix; ancoraggio schermo (HUD); Set Text con Value Source + formato, Set Text Color | Integrato (2026-06-13) |
| GaugeComponent | Barra (vita/energia/progresso) con fill 0..max auto-bind a variabile; colore, direzione, ancoraggio schermo (HUD) | Integrato (2026-06-13) |

## Basic-Complete Batch (2026-06-13)

Lacune chiuse per coprire i generi arcade fondamentali:

- **Barre**: `GaugeComponent` + `setScale` ora accetta Value Source (barre/scaling legati a variabili).
- **Sparatutto**: `spawnEntity` / `spawnAtEntity` / `spawnEntityAtPointer` accettano velocità di lancio (mira il proiettile appena creato).
- **Pausa**: azioni `pauseGame` / `resumeGame` / `togglePause` + condizione `isPaused` (time.pause memorizza lo scale precedente).
- **Fuori schermo**: trigger `onLeaveScreen` + condizione `isOffScreen` (Renderer screenToWorld + `screen.isOffScreen`).

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
- `magnet.setEnabled`, `magnet.setTargetTag`, `magnet.setRadius`, `magnet.setPullSpeed`
- `horde.setTargetClass`, `horde.setWeights`, `horde.setMaxSpeed`, `horde.setSeparationRadius`
- `autoDestroy.setLifespan`, `autoDestroy.cancel`
- `platformer.isGrounded`

## Tranche 2A - Value Sources Ed Espressioni

Stato: completata (2026-06-12).

- `LogicValue` supporta literal, state, message, entity, proprieta Component e
  random deterministico.
- Le espressioni numeriche sono catene esplicite valutate da sinistra a destra:
  add, subtract, multiply, divide, modulo, min, max e power.
- Divisione e modulo per zero restituiscono `0`, senza eccezioni o `NaN`.
- `compareValues` confronta due Value Source arbitrarie.
- Le azioni numeriche dei Component usano Value Source, non solo literal.
- `component.value(entityId, property)` espone letture read-only con fallback
  gestito dal compilatore.

## Tranche 2B - Contratto Camera E Dialog

Stato: completata (2026-06-12).

- Un solo Camera Target viene applicato per frame; in automatico vince l'ID
  attivo piu basso.
- `centerCameraOn` resta one-shot.
- `followCamera`, `stopCameraFollow`, `useDefaultCameraTarget` controllano il
  follow persistente senza sovraccaricare il significato di Center.
- Dialog espone `endDialog` e `isDialogActive`; Start dichiara esplicitamente
  che apre un dialog graph per ID.

## Decisione Sui Prossimi Component Core

- `OneWayPlatformComponent`: non aggiungerlo; e gia rappresentato da
  `SolidComponent.surfaceKind = oneWay`.
- `CollectibleComponent`: per ora preset/authoring recipe Sensor + Logic Board,
  non nuovo stato runtime.
- `DamageDealerComponent`: rimandato finche il contratto sensor supporta overlap
  per-target e cooldown senza ambiguita.
- `SpawnerComponent`: prossimo candidato reale, ma solo dopo aver fissato campi
  minimi (`objectType`, intervallo, limite attivo, punto/offset, enabled) e
  semantica deterministica.

## Tranche 3 - UI Logic Board Piu Guidata

Stato: da fare.

Obiettivi:

- Separare visivamente:
  - Recommended for this object
  - Component APIs
  - Advanced / Generic
- Nei pannelli componenti distinguere Creative vs Advanced: Creative mostra i
  valori di design e le scelte di comportamento; Advanced mostra override e
  diagnostica tecnica.
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
| 2A — Value Sources ed espressioni | Completata | working tree 2026-06-12 |
| 2B — Camera e Dialog contract | Completata | working tree 2026-06-12 |
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

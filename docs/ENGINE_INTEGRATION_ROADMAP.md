# Engine Integration Roadmap

Tracker operativo per completare il design:
**Thick Core, Thin Script + RuntimeEntityGateway + EnTT**.

Questo file va aggiornato alla fine di ogni tranche di integrazione e va letto
prima di proseguire, cosi il contesto non dipende dalla chat.

## Obiettivo

Portare ArtCade al design target senza rompere editor, preview WASM, demo,
packaging e API Lua esistenti.

Direzione scelta:

- `EntityRegistry` resta l'unico storage runtime EnTT-backed.
- `RuntimeEntityGateway` resta la facciata stabile verso World, GameAPI,
  EditorAPI e renderer.
- Lua/Logic Board diventano event/intent-first.
- Le API low-level restano disponibili come livello Advanced/Debug.
- `luaHost->tick(dt)` resta temporaneamente per compatibilita.

## Stato Attuale

### Completato

- EnTT e' integrato dietro `EntityRegistry`.
- `RuntimeEntityGateway` espone get/set componenti, create/destroy,
  pool/tag e visitor deterministici.
- Il modulo legacy `EntityManager` e' stato rimosso.
- Rendering, physics sync, platformer, sensor e autoDestroy usano gateway
  e visitor core dove possibile.
- Lifecycle Lua gia disponibile:
  - `lifecycle.onSpawn(className, fn)`
  - `lifecycle.onDestroy(className, fn)`
- Prima tranche event/intent aggiunta:
  - `input.onPressed(code, fn)`
  - `input.onReleased(code, fn)`
  - `sensor.onEnter(entityOrClass, targetTag, fn)`
  - `sensor.onExit(entityOrClass, targetTag, fn)`
  - `time.after(seconds, fn)`
  - `movement.setIntent(entityId, x, y)`
  - `movement.clearIntent(entityId)`
  - `platformer.requestJump(entityId)`
- `sensor.poll()` resta compatibile tramite coda pending.
- Gli intent sono runtime-only in `World` e non cambiano `ProjectDoc`.
- WASM runtime ricostruito e copiato in `editor/public/runtime`.
- Test core aggiunto:
  - `world_intent_test` per movement intent, jump intent e sensor edge drain.
- Tranche Logic Board event-first aggiunta:
  - trigger `onSpawn` nello schema e nella UI;
  - `onInput` pressed/released genera `input.onPressed/onReleased`;
  - `onTriggerEnter/Exit` genera `sensor.onEnter/onExit`;
  - `onTimer` genera `time.after/time.every`;
  - `onDestroy` per target a classe genera `lifecycle.onDestroy`;
  - `onUpdate`, `onCollision`, `onInput down`, mouse e animation restano fallback tick/polling.
- Demo runtime aggiornata verso eventi/intenti:
  - input player top-down basato su `input.onPressed/onReleased`;
  - heartbeat demo basato su `time.every`;
  - componente Lua `Platformer` legacy usa input events, `movement.setIntent`
    e `platformer.requestJump`.
- Profiler runtime leggero aggiunto:
  - `RuntimeProfiler` interno;
  - metriche frame per Lua, physics, gameplay, render, entity count,
    active physics bodies, event count e stato tick Lua;
  - accesso Lua opzionale via `debug.profile()`.
- Riduzione tick Lua aggiunta:
  - `LuaHost` legge `__artcade_requires_tick`;
  - il compiler Logic Board marca graph event-only come tick-free quando non
    esiste un project tick da preservare;
  - `_time_update(dt)` continua a girare anche quando il tick script e' saltato.
- Tranche 7–10 (post-EnTT integration plan):
  - UI Logic Board event-first (`trigger-execution.ts`, badge Event/Polling);
  - `HealthComponent` end-to-end (registry → gateway → `entity.health`);
  - sensor fixture sync su `setSensor` + demo `sensor.onEnter/onExit`;
  - profiler/pick visitor + note deprecazioni in ECS guide.

### Prossimo step consigliato

Integrazione roadmap Tranche 1–10 completata. Follow-up opzionali:

- sensor picker in Logic Board UI;
- rimozione fallback input C++ in World platformer;
- nuovi componenti gameplay via pattern §6 ECS guide.

### Verifiche Ultima Tranche

- Build C++ Release: passata (locale).
- `ctest --test-dir runtime-cpp/build-msvc --output-on-failure`: atteso 18/18
  (inclusi `asset_loader_test`, health/sensor debt-fix tests).
- `npm.cmd test` in `editor`: 200/200 passati.
- `npm.cmd run build`: passato.
- `runtime-cpp/build_wasm.bat`: da rieseguire dopo fix runtime.

Warning residui noti:

- CMake deprecation da dipendenze `raylib` / `box2d`.
- Emscripten/sol2: warning su gruppo `-Wmaybe-uninitialized` non riconosciuto.

## Regole Architetturali

- Non esporre `entt::registry` fuori da `runtime-entity-gateway`.
- Nuovi sistemi runtime devono passare da `RuntimeEntityGateway` o da metodi
  di `World` intenzionali.
- Non aggiungere campi a `ProjectDoc` se non servono a un blocco reale.
- Preferire intent/eventi core a loop Lua per-entita.
- Mantenere polling API e `tick(dt)` fino a migrazione completa.
- Ogni tranche deve lasciare editor, demo, native build e WASM in stato
  funzionante.

## Tranche 1 - Core Event Bridge

Stato: completata.

Deliverable:

- Input edge events verso Lua.
- Sensor enter/exit events verso Lua.
- Timer alias event-friendly.
- Intent API minima per movement/platformer.
- Compatibilita con polling esistente.

File principali:

- `runtime-cpp/src/app/src/app.cpp`
- `runtime-cpp/src/world/include/world.h`
- `runtime-cpp/src/world/src/world.cpp`
- `runtime-cpp/src/modules/game-api/src/input-api.cpp`
- `runtime-cpp/src/modules/game-api/src/sensor-api.cpp`
- `runtime-cpp/src/modules/game-api/src/time-api.cpp`
- `runtime-cpp/src/modules/game-api/src/intent-api.cpp`
- `runtime-cpp/src/modules/runtime-entity-gateway/*`

## Tranche 2 - Test Mirati Event/Intent

Stato: completata.

Obiettivi:

Completato:

- Aggiunto `runtime-cpp/tests/world-intent-test.cpp`.
- Coperti:
  - `movement.setIntent` senza dipendenza da input;
  - `movement.clearIntent`;
  - `platformer.requestJump` senza dipendenza da input;
  - sensor enter/exit drain deterministico a livello `World`.
- Evitati test fragili su Raylib/Input.

Exit criteria:

- Test nuovi inclusi in CMake.
- `ctest` verde: 17/17.
- Nessun cambio comportamento demo previsto: intent API e' opt-in.

## Tranche 3 - Logic Board Event-First

Stato: completata.

Completato:

- Aggiunto trigger `onSpawn` a tipi, schema, factory UI e label.
- Aggiornato compiler TS per preferire registrazioni evento:
  - `lifecycle.onSpawn(...)`;
  - `lifecycle.onDestroy(...)` per board target a classe;
  - `input.onPressed(...)`;
  - `input.onReleased(...)`;
  - `sensor.onEnter(...)`;
  - `sensor.onExit(...)`;
  - `time.after(...)`;
  - `time.every(...)`.
- Mantenuti fallback compatibili in `tick(dt)`:
  - `onUpdate`;
  - `onCollision`;
  - `onInput down`;
  - `onMouseInput`;
  - `onAnimationEnd`;
  - `onDestroy` quando non c'e' una classe runtime stabile.
- Aggiornati test string-match e runtime Lua per coprire event handler e timer.

Exit criteria:

- Test compiler vecchi aggiornati al nuovo output.
- Nuovi test compiler event-driven aggiunti.
- `npm.cmd test`: 186/186 passati.
- `npm.cmd run build`: passato.

## Tranche 4 - Spostare Demo Su Intent/Eventi

Stato: completata.

Completato:

- `runtime-cpp/test-project/scripts/main.lua`:
  - input continuo derivato da handler `input.onPressed/onReleased`;
  - nessun polling `input.isKeyDown` nel loop movimento;
  - heartbeat periodico registrato con `time.every(LOG_INTERVAL, ...)`.
  - *(Follow-up Tranche 9)* coin/enemy via `sensor.onEnter/onExit`; ball/floor
    physics da ProjectDoc (non più `physics.createBody` in Lua).
- `runtime-cpp/test-project/scripts/components/platformer.lua`:
  - jump edge via `input.onPressed`;
  - stato tasti orizzontale via `input.onPressed/onReleased`;
  - integrazione opzionale con `movement.setIntent`, `movement.clearIntent`
    e `platformer.requestJump`;
  - conserva `entity.setVelocity` per compatibilita legacy del componente Lua.
- Nessun cambio a `ProjectDoc`.

Exit criteria:

- Sintassi Lua demo verificata con VM `wasmoon`.
- `npm.cmd test`: 186/186 passati.
- `npm.cmd run build`: passato.
- Build C++ Release: passata.
- `ctest --test-dir runtime-cpp/build-msvc --output-on-failure`: 17/17 passati.

Nota tecnica:

- La migrazione coin/hit a sensor e' completata in Tranche 9 (vedi sotto).

## Tranche 5 - Profiling Runtime

Stato: completata.

Metriche target:

- Lua time.
- Physics time.
- Gameplay systems time.
- Render time.
- Entity count.
- Active physics bodies.
- Lua event count.
- Lua tick enabled/disabled.

Completato:

- Aggiunto `runtime-cpp/src/core/runtime-profiler.h`.
- `Application` misura:
  - Lua/event dispatch;
  - gameplay systems;
  - physics step;
  - render frame;
  - entity count;
  - active physics body count;
  - Lua event handler count;
  - stato `luaTickEnabled`.
- `debug.profile()` restituisce uno snapshot Lua senza loggare nulla.

Exit criteria:

- Nessun logging rumoroso per default.
- Metriche disponibili on-demand.
- Test/build verdi.

## Tranche 6 - Riduzione Graduale Tick Lua

Stato: completata.

Completato:

- `LuaHost` mantiene `scriptTickRequired`.
- `LuaHost::tick(dt)` esegue sempre `_time_update(dt)`, ma salta `tick(dt)`
  quando `__artcade_requires_tick == false`.
- Il compiler Logic Board:
  - esegue `_logic_init()` subito per graph event-only senza project tick;
  - imposta `__artcade_requires_tick = false` per graph event-only;
  - imposta `true` quando servono fallback polling o un project tick da
    preservare.
- Aggiunto test `lua_host_test` per tick disabilitato.

Exit criteria:

- Progetti legacy continuano a funzionare: fallback default `true`.
- Graph event-driven possono girare senza polling continuo.
- Profiler espone `luaTickEnabled`.
- Test/build verdi.

## Tranche 7 - UI Logic Board Event-First

Stato: completata.

Completato:

- Modulo condiviso `editor/src/utils/logic-board/trigger-execution.ts`:
  `getTriggerExecutionMode`, `usesTickFallback`, `triggerPickerGroup`, tooltip polling.
- `triggers.json`: campo `x-artcade.executionMode` per ogni trigger.
- `compiler.ts`: refactor — importa da `trigger-execution` (no drift).
- UI Logic Board:
  - `TypePicker`: optgroup **Recommended** vs **Advanced / Polling** + `title` su polling;
  - `EventCard`: badge `Event` / `Polling` / `Event*`;
  - `friendly-labels`: distinzione onInput pressed vs down;
  - default nuova regola: `onSpawn` (`factory.ts`, `LogicBoardPanel.tsx`).
- Test: `trigger-execution.test.ts` + aggiornamenti `compiler.test.ts`.

Exit criteria:

- UI coerente con compiler event-first.
- Nessuna modifica runtime obbligatoria.
- `npm.cmd test`: 194/194 passati.
- `npm.cmd run build`: passato.

## Tranche 8 - HealthComponent end-to-end

Stato: completata.

Completato:

- `EntityRegistry`: `getHealth` / `setHealth` (optional component).
- `RuntimeEntityGateway`: delega + `applyEntityDefToRegistry` applica `def.health`.
- Lua: `entity.health(id)` → `currentHp, maxHp`; `entity.setHealth(id, current, max?)`.
- Test: `test_health_component` in `entity-signals-test.cpp`.

Exit criteria:

- Health da ProjectDoc → registry → gateway → Lua.
- `ctest`: `entity_signals_test` verde.

## Tranche 9 - Sensor fixtures + demo gameplay

Stato: completata.

Completato:

- `RuntimeEntityGateway::setSensor` chiama `syncSensorFixture` quando il body esiste già.
- `syncSensorFixture` condiviso con `ensurePhysicsBody`.
- `entity.setPosition` sincronizza il body Box2D (sensor overlap con player script-driven).
- Test: `test_set_sensor_syncs_fixture_after_body` in `world-intent-test.cpp`.
- Demo `test-project`:
  - `SensorComponent` su Coin/Enemy + physics static su Player/Coin/Enemy;
  - `main.lua`: raccolta coin e danno nemico via `sensor.onEnter/onExit` (no distance polling).
- `AssetLoader`: parsing JSON `physics` (bodyType + collider) da ProjectDoc.

Exit criteria:

- Sensor aggiunto post-create produce overlap reale.
- Demo allineato al modello event-first.
- `ctest`: `world_intent_test` verde.

## Tranche 10 - Consolidamento runtime

Stato: completata (incrementale).

Completato:

- Profiler (`app.cpp`): `activeSceneEntityCount()` / `activePhysicsBodyCount()` al posto del loop su `activeSceneIds()`.
- Editor pick (`editor-input-controller.cpp`): `forEachActiveRenderable` per hit test.
- Documentazione:
  - `poolByClass` / `byTag` filtrano gia' per `SceneActiveTag` (gateway);
  - `lifecycle.pollDestroyed` deprecato — preferire `lifecycle.onDestroy`;
  - `AnimationState` resta in `SpriteAnimator`, non e' componente EnTT.

Non in scope (follow-up):

- Promozione `AnimationState` a componente EnTT (solo se serve condivisione cross-system).

Completato (follow-up):

- World platformer: rimosso fallback `input_->isKeyDown` / `wasKeyPressed` — solo intent Lua.
- Sensor picker Logic Board: `TagPicker` + widget `entityTag` su trigger enter/exit.

## Debito tecnico — fix post Tranche 10

Completato:

- `Physics::setSensorFixture` / `clearSensorFixture` — replace idempotente (no fixture duplicate).
- `RuntimeEntityGateway::setTransform` sincronizza posizione body Box2D.
- Test: `physics-test` #14, `world_intent_test` replace sensor, `entity_signals_test`
  transform sync, `asset_loader_test` parsing physics/health/sensor JSON.
- Demo: ball/floor physics in ProjectDoc; danno nemico via `entity.health`.

## Checklist Da Eseguire A Ogni Tranche

- `git status --short --branch`
- Build C++ Release.
- `ctest --test-dir runtime-cpp/build-msvc --output-on-failure`
- `npm.cmd test` in `editor`
- `npm.cmd run build`
- Rebuild WASM se cambia runtime usato dalla preview.
- Aggiornare questo file con:
  - cosa e' stato completato;
  - test eseguiti;
  - prossimo step consigliato.

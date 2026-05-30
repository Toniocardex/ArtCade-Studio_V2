# Engine Integration Roadmap

Tracker operativo per completare il design:
**Thick Core, Thin Script + RuntimeEntityGateway + EnTT**.

Questo file va aggiornato alla fine di ogni tranche di integrazione e va letto
prima di proseguire, cosi il contesto non dipende dalla chat.

**Correlato:** esposizione API Component nella Logic Board →
`docs/LOGIC_BOARD_COMPONENT_API_ROADMAP.md`.

**Ultimo allineamento:** `main` @ `20c473d` (2026-05-21).

## Obiettivo

Portare ArtCade al design target senza rompere editor, preview WASM, demo,
packaging e API Lua esistenti.

Direzione scelta:

- `EntityRegistry` resta l'unico storage runtime EnTT-backed.
- `RuntimeEntityGateway` resta la facciata stabile verso World, GameAPI,
  EditorAPI e renderer.
- Lua/Logic Board diventano event/intent-first.
- La Logic Board orchestra condizioni e azioni di gioco; i Component runtime
  eseguono comportamento e stato ricorrente nel core C++.
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
  - `HealthComponent` end-to-end (registry → gateway → `entity.health` /
    `entity.damage`);
  - sensor fixture sync su `setSensor` + demo `sensor.onEnter/onExit`;
  - profiler/pick visitor + note deprecazioni in ECS guide.
- Post-tranche runtime/editor (2026-05-21):
  - `SolidComponent` end-to-end + `World::isGrounded` via `forEachActiveSolid`
    (`d7ba0ed`);
  - `World` suddiviso in `world.cpp`, `world_movement.cpp`, `world_systems.cpp`,
    `world_tilemap.cpp`; lifecycle scena sicuro su `loadScene` / editor sync
    (`b707874`);
  - Logic Board **Component API Tranche 1**: capability registry, blocchi
    schema-first per controller/health, compiler verso API Lua esistenti
    (`20c473d`) — dettaglio in `LOGIC_BOARD_COMPONENT_API_ROADMAP.md`.

### Prossimo step consigliato

Runtime integration Tranche 1–10 + Solid completate.

**Linea attiva:** Logic Board Component API **Tranche 3** (UI guidata:
Recommended / Component APIs / Advanced) — vedi
`LOGIC_BOARD_COMPONENT_API_ROADMAP.md`.

Follow-up opzionali runtime:

- sensor picker Logic Board UI (miglioramenti);
- catalogo Component Core rimanenti: `OneWayPlatform`, `DamageDealer`,
  `Collectible`, `Spawner`;
- Advanced: `ProceduralJuiceComponent`, `GrapplingHookComponent`.

### Catalogo Component Target

I Component runtime sono divisi in due famiglie:

- **Core MVP**: fondamenta comuni della simulazione, usabili come building
  block principali nell'Inspector.
- **Advanced / Next-Gen**: meccaniche ad alto valore, implementate nel core
  quando servono a un workflow reale.

Core MVP target:

- `PlatformerControllerComponent`: movimento side-scroller con velocita max,
  accelerazione, salto e moltiplicatore gravita.
- `TopDownControllerComponent`: movimento libero X/Y, accelerazione, attrito
  e opzione 4-direzioni. **Integrato end-to-end**: Inspector, ProjectDoc,
  parser native/WASM, registry/gateway, sistema World basato su movement
  intent e test.
- `SolidComponent`: ground semantico per platformer (`groundClass`). **Integrato
  end-to-end**: Inspector, ProjectDoc, parser native/WASM, registry/gateway,
  `forEachActiveSolid`, `World::isGrounded` (in `world_movement.cpp`), test.
- `PhysicsComponent` statico/dynamic: collider e physics body (non e' un Component
  Inspector separato; convive con `solid` e controller).
- `LinearMoverComponent` / Bullet: moto lineare continuo, direzione/velocita.
  **Integrato end-to-end**: Inspector, ProjectDoc, parser native/WASM,
  registry/gateway, sistema World con movimento transform/physics e test.
- `CameraTargetComponent`: target camera 2D con offset, smoothing e bounds.
  **Integrato end-to-end**: Inspector, ProjectDoc, parser native/WASM,
  registry/gateway, `World::tickCameraTargets` → Renderer, test gateway.
- `HealthComponent`: HP + i-frames (storage EnTT + cooldown in World).
  **Integrato end-to-end**: Inspector, parser, gateway, `entity.health` /
  `entity.setHealth` / `entity.damage`, `World::tickHealthCooldowns`,
  test `world_intent_test` (damage + i-frames).
- `AutoDestroyComponent`: countdown lifespan → destroy.
  **Integrato end-to-end**: Inspector, parser, gateway,
  `World::tickAutoDestroy` (in `world_systems.cpp`, chiamato da
  `Application::tickFixedStep`), preservazione `_timeAlive` su
  `applyEntityDefToRegistry` / `updateEntity`, test intent + demo coin con
  `lifespan`.

Advanced target:

- `MagneticItemComponent`: loot/drop attratti verso un target.
  **Integrato end-to-end**: Inspector, ProjectDoc, parser, gateway,
  `World::tickMagneticItems`, test `world_intent_test` + gateway.
- `HordeMemberComponent`: steering/swarm AI con separazione tra simili.
  **Integrato end-to-end**: chase `targetClass`, separation tra peers,
  `World::tickHordeMembers`, test intent + gateway.
- `ProceduralJuiceComponent`: deformazioni visive procedurali senza cambiare
  hitbox fisiche.
- `GrapplingHookComponent`: rope/joint physics e azioni Logic Board dedicate.

Ordine consigliato: completare i Core mancanti prima degli Advanced, salvo
necessita demo specifiche. **Catalogo Core MVP runtime integrato:** Platformer,
TopDown, Solid, LinearMover, CameraTarget, Health, AutoDestroy. **Advanced
integrati:** MagneticItem, HordeMember. **Core ancora da progettare:**
`OneWayPlatformComponent`, `DamageDealerComponent`, `CollectibleComponent`,
`SpawnerComponent`. **Advanced prossimi:** ProceduralJuice, GrapplingHook.

### Verifiche Ultima Tranche

- Build C++ Release: `runtime-cpp/build-nmake` (NMake + vcvars64).
- `ctest --test-dir runtime-cpp/build-nmake --output-on-failure`: 18/18
  passati.
- `npm.cmd test` in `editor`: 212/212 passati (include Logic Board Component
  API Tranche 1).
- `npm.cmd run build`: passato.
- `runtime-cpp/build_wasm.bat`: passato; `game.js` in repo, `game.wasm` locale
  (gitignored `*.wasm`).

Warning residui noti:

- CMake deprecation da dipendenze `raylib` (e FetchContent legacy).
- Emscripten/sol2: warning su gruppo `-Wmaybe-uninitialized` non riconosciuto.

## Regole Architetturali

- Separazione normativa: **Logic Board orchestra, Component esegue, Core
  simula**.
- La Logic Board deve esprimere condizioni e azioni ad alto livello, per
  esempio `player enters coin radius`, `fire grappling hook`, `release
  grappling hook`, `set target`.
- I Component runtime sono pacchetti di stato/comportamento nativi
  dell'entita, configurabili dall'Inspector e processati da sistemi C++:
  esempi target sono `MagneticItemComponent`, `HordeMemberComponent`,
  `ProceduralJuiceComponent`, `GrapplingHookComponent`.
- Non implementare nuovi "Behavior" come loop Lua nascosti: il termine
  prodotto e tecnico per questa famiglia e' **Component**.
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

- `runtime-cpp/src/app/src/app.cpp` (`tickFixedStep` / `tickFrameEnd`)
- `runtime-cpp/src/world/include/world.h`
- `runtime-cpp/src/world/src/world.cpp` (lifecycle, state, `tickGameplaySystems`)
- `runtime-cpp/src/world/src/world_movement.cpp` (controller, mover, horde, magnet)
- `runtime-cpp/src/world/src/world_systems.cpp` (camera, autoDestroy, health, sensor)
- `runtime-cpp/src/world/src/world_tilemap.cpp`
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
  - `LogicEventRow`: execution badges (`Event` / `Polling` / `Event*`);
  - `friendly-labels`: distinzione onInput pressed vs down;
  - default nuova regola: `onSpawn` (`factory.ts`, `LogicBoardPanel.tsx`).
- Test: `trigger-execution.test.ts` + aggiornamenti `compiler.test.ts`.

Exit criteria:

- UI coerente con compiler event-first.
- Nessuna modifica runtime obbligatoria.
- `npm.cmd test`: 194/194 passati.
- `npm.cmd run build`: passato.

## Tranche 8 - HealthComponent end-to-end

Stato: completata (allineamento 2026-05-21).

Completato:

- `EntityRegistry`: `getHealth` / `setHealth` + `forEachActiveHealth`.
- `RuntimeEntityGateway`: delega + `applyEntityDefToRegistry` (preserva
  `_iFramesRemaining` su patch); `applyDamage(id, amount)`.
- `World::tickHealthCooldowns` in `tickGameplaySystems`.
- Lua: `entity.health`, `entity.setHealth`, `entity.damage` (rispetta i-frames).
- Test: `test_health_component` (`entity-signals-test`);
  `test_health_damage_respects_iframes` (`world_intent_test`).
- Demo: danno nemico via `entity.damage` in `test-project/scripts/main.lua`.

Exit criteria:

- Health da ProjectDoc → registry → gateway → Lua + danno con i-frames in core.
- `ctest`: `entity_signals_test` + `world_intent_test` verdi.

## Tranche 9 - Sensor fixtures + demo gameplay

Stato: completata.

Completato:

- `RuntimeEntityGateway::setSensor` chiama `syncSensorFixture` quando il body esiste già.
- `syncSensorFixture` condiviso con `ensurePhysicsBody`.
- `entity.setPosition` sincronizza il physics body (sensor overlap con player script-driven).
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
- `RuntimeEntityGateway::setTransform` sincronizza posizione physics body.
- Test: `physics-test` #14, `world_intent_test` replace sensor, `entity_signals_test`
  transform sync, `asset_loader_test` parsing physics/health/sensor JSON.
- Demo: ball/floor physics in ProjectDoc; danno nemico via `entity.damage`.

## Tranche 11 - SolidComponent end-to-end

Stato: completata (`d7ba0ed`).

Completato:

- `SolidComponent` con `groundClass` su `EntityDef` + EnTT.
- Inspector, parser (`asset-loader`, `project-doc-parser`), fingerprint `so`.
- `RuntimeEntityGateway::getSolid` / `setSolid` / `forEachActiveSolid`.
- `World::isGrounded` per platformer (overlap AABB con entita' solid attive).
- Test gateway + `world_intent_test`.

Exit criteria:

- Platformer puo' saltare solo con ground sotto i piedi (classe configurabile).
- `ctest` + build native/WASM verdi.

## Tranche 12 - World module split + scene lifecycle

Stato: completata (`b707874`).

Completato:

- Suddivisione `World` in piu' translation unit (CMake `artcade-world`).
- `clearGameplayRuntimeState` su `loadScene` / `syncAfterEditorProject`.
- Sistemi gameplay (camera, autoDestroy, health, sensor, movement) nei file
  dedicati senza cambiare ordine tick in `tickGameplaySystems`.

Exit criteria:

- Nessuna regressione `world_intent_test` / `scene_gateway_test`.
- Build native + WASM verdi.

## Tranche 13 - Logic Board Component API (editor Tranche 1)

Stato: completata (`20c473d`). Runtime C++ invariato (solo API Lua gia presenti).

Completato (editor):

- `component-capabilities.ts` + test resolver.
- Azioni/condizioni schema-first: `moveController`, movement intent, jump,
  `damageEntity`, `healEntity`, `setEntityHealth`, `compareHealth`.
- Compiler → `movement.*`, `platformer.requestJump`, `entity.damage`, ecc.
- Warning UI quando un blocco richiede un Component assente.

Riferimento completo: `docs/LOGIC_BOARD_COMPONENT_API_ROADMAP.md` (Tranche 1).

Exit criteria:

- `npm.cmd test`: 212/212.
- Nessun rebuild WASM obbligatorio per questa tranche.

## Tranche 14 - Logic Board Component API (runtime Tranche 2)

Stato: completata (commit Tranche 2).

Completato (runtime C++ + editor):

- `GameAPI::bindComponentAPI`: `linearMover.*`, `magnet.*`, `horde.*`,
  `autoDestroy.setLifespan` / `cancel`, `platformer.isGrounded`.
- `_paused` / `_enabled` runtime-only su LinearMover e MagneticItem; merge su
  patch editor in `applyEntityDefToRegistry`.
- Logic Board: 10 azioni schema-first + condizione `isPlatformerGrounded`.
- Test: `world-intent-test` (pause magnet, cancel autoDestroy), compiler e
  capability resolver.

Riferimento completo: `docs/LOGIC_BOARD_COMPONENT_API_ROADMAP.md` (Tranche 2).

Exit criteria:

- Build C++ native + WASM.
- `ctest`: tutti i test verdi (inclusi nuovi casi world-intent).
- `npm.cmd test` e `npm.cmd run build` in `editor`.

## Checklist Da Eseguire A Ogni Tranche

- `git status --short --branch`
- Build C++ Release (`runtime-cpp/build-nmake` + vcvars64, o `build-msvc`).
- `ctest --test-dir runtime-cpp/build-nmake --output-on-failure`
- `npm.cmd test` in `editor`
- `npm.cmd run build`
- Rebuild WASM se cambia runtime usato dalla preview.
- Aggiornare questo file con:
  - cosa e' stato completato;
  - test eseguiti;
  - prossimo step consigliato.

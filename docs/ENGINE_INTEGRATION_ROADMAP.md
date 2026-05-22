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

### Verifiche Ultima Tranche

- Build C++ Release: passata.
- `ctest --test-dir runtime-cpp/build-msvc --output-on-failure`: 17/17 passati.
- `npm.cmd test` in `editor`: 186/186 passati.
- `npm.cmd run build`: passato.
- `runtime-cpp/build_wasm.bat`: passato.
- Tranche 4: sintassi Lua demo verificata con `wasmoon`.
- Tranche 5/6:
  - `npm.cmd test`: 188/188 passati.
  - `npm.cmd run build`: passato.
  - Build C++ Release: passata.
  - `ctest --test-dir runtime-cpp/build-msvc --output-on-failure`: 17/17 passati.
  - `runtime-cpp/build_wasm.bat`: passato.

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
  - heartbeat periodico registrato con `time.every(LOG_INTERVAL, ...)`;
  - coin/enemy restano distance-based perche' il progetto demo non ha ancora
    componenti `sensor` dedicati.
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

- La migrazione completa di coin/hit a `sensor.onEnter/onExit` richiede prima
  componenti `sensor` reali sul demo ProjectDoc. Evitato in questa tranche per
  non cambiare gameplay e contenuto demo insieme.

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

Stato: prossimo step.

Obiettivi:

- Rendere visibile in UI quali trigger/blocchi sono event-driven e quali sono
  fallback polling.
- Promuovere trigger event-first come default:
  - `On Spawn`;
  - `Input Pressed/Released`;
  - `Sensor Enter/Exit`;
  - `Timer`.
- Marcare `Every frame`, `Input Down`, collision polling, mouse polling e
  animation polling come Advanced/Polling.
- Aggiungere copy/tooltip chiari senza introdurre testo didascalico invasivo.
- Preparare il futuro picker per sensori reali nel demo e nella Logic Board.

Exit criteria:

- UI coerente con compiler event-first.
- Nessuna modifica runtime obbligatoria.
- `npm.cmd test` e `npm.cmd run build` verdi.

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

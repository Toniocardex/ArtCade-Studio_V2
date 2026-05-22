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

### Verifiche Ultima Tranche

- Build C++ Release: passata.
- `ctest --test-dir runtime-cpp/build-msvc --output-on-failure`: 17/17 passati.
- `npm.cmd test` in `editor`: 186/186 passati.
- `npm.cmd run build`: passato.
- `runtime-cpp/build_wasm.bat`: passato.
- Tranche 4: sintassi Lua demo verificata con `wasmoon`.

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

Stato: pianificata.

Metriche target:

- Lua time.
- Physics time.
- Gameplay systems time.
- Render time.
- Entity count.
- Active physics bodies.
- Lua event count.
- Lua tick enabled/disabled.

Obiettivi:

- Profiler leggero C++.
- Snapshot per frame o media mobile.
- Esposizione a ConsolePanel o pannello debug opzionale.
- Nessun logging rumoroso per default.

Exit criteria:

- Profiling disattivabile.
- Nessun impatto visibile in gameplay normale.
- Metriche utili per decidere quando ridurre `luaHost->tick`.

## Tranche 6 - Riduzione Graduale Tick Lua

Stato: pianificata.

Obiettivi:

- Introdurre flag/runtime mode per sapere se `tick(dt)` e' richiesto.
- Disabilitare tick Lua per script completamente event-driven.
- Mantenere compatibilita per progetti legacy.

Exit criteria:

- Progetti legacy continuano a funzionare.
- Progetti event-driven possono girare senza tick polling continuo.
- Profiler mostra riduzione tempo Lua quando tick e' disabilitato.

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

# Logic Board — Backlog editor (post runtime-core)

> Normativa: [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) · Visione UX: [`ArtCade_V2_Riepilogo_Suggerimenti.md`](ArtCade_V2_Riepilogo_Suggerimenti.md).

## Completato

### 1. JSON Schema registry (Riepilogo §6.1) — 2026-05

- [x] Schemi draft-07 per tutti i trigger / action / condition MVP
- [x] `schema-registry.ts` (Ajv) + test Vitest anti-drift
- [x] Validazione load (skip eventi invalidi) + save (blocco)
- [x] `SchemaParamForm` — tutti i trigger + azioni/condizioni (schema-driven)
- [x] Sprint 2: `condition-node.schema.json`, `ConditionTreeEditor`, validazione albero OR/AND

## Completato (continuazione)

### 2. `wait` + timer Lua — 2026-05

- [x] Azione `wait` in `types/logic-board.ts`, schema, compiler (`time.delay`)
- [x] Rinomina `_logic_timers` per non collidere con `time.*` runtime
- [ ] Coroutine `coroutine.yield` (opzionale; `time.delay` copre il flusso lineare MVP)

## Priorità aperte

### 3. UX «Zero Matematica»

- [x] Modale cattura tasto (`keyCapture` + `KeyCapture.tsx`) — 2026-05
- [x] `spawnEntity`: `inheritFlip`, `imagePoint` + editor image points — 2026-05
- [x] `moveInDirection` / bussola Forward-Backward — 2026-05
- [x] Azioni griglia: `moveByOffset`, `snapToGrid`, condizione `isSpaceFree` — 2026-05

### 4. Shaders built-in (Riepilogo §4)

- [x] MVP `setEntityShader` / `setScreenShader` (outline, hit_flash, crt scanlines) — 2026-05

### 5. Runtime polish

- [x] Sensor enter/exit → Lua `sensor.poll()` (buffer `World`, tick ogni frame) — 2026-05
- [x] Compilatore: `onTriggerEnter`/`Exit` via `sensor.poll` — 2026-05
- [x] Transizioni `loadScene` (`fadeSeconds` + fade gateway) — 2026-05
- [x] Hook `onAnimationEnd` / `onDestroy` → `animation.pollFinished` / `lifecycle.pollDestroyed` — 2026-05

---

*Flusso attuale: compilatore → `mainScriptPath` → WASM preview.*

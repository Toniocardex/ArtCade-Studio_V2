# Logic Board — Backlog editor (post runtime-core)

> Normativa: [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) · Visione UX: [`ArtCade_V2_Riepilogo_Suggerimenti.md`](ArtCade_V2_Riepilogo_Suggerimenti.md).

## Completato

### 1. JSON Schema registry (Riepilogo §6.1) — 2026-05

- [x] Schemi draft-07 per tutti i trigger / action / condition MVP
- [x] `schema-registry.ts` (Ajv) + test Vitest anti-drift
- [x] Validazione load (skip eventi invalidi) + save (blocco)
- [x] `SchemaParamForm` — tutti i trigger + azioni/condizioni (schema-driven)
- [x] Sprint 2: `condition-node.schema.json`, `ConditionTreeEditor`, validazione albero OR/AND

## Priorità aperte

### 2. `wait` + coroutine Lua (SPEC + Riepilogo)

- Estendere `types/logic-board.ts` e `compiler.ts`.
- Runtime: timer in `time-api` o coroutine in `LuaHost` (Sol2 già carica `coroutine`).

### 3. UX «Zero Matematica»

- Modale cattura tasto per `onInput` (widget `keyCapture` nello schema).
- `spawnEntity`: `inheritFlip`, image points dallo sprite editor.
- `moveInDirection` / bussola Forward-Backward.
- Azioni griglia: `moveByOffset`, `snapToGrid`, `isSpaceFree` (+ API C++).

### 4. Shaders built-in (Riepilogo §4)

- `setEntityShader` / `setScreenShader` in renderer + azioni Logic.

### 5. Runtime polish

- Esporre sensor enter/exit a Lua (`event.on` / buffer C++).
- Transizioni `loadScene` (fade) come parametro azione.

---

*Flusso attuale: compilatore → `mainScriptPath` → WASM preview.*

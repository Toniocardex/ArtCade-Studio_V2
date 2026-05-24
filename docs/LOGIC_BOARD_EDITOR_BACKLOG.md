# Logic Board — Backlog editor (post runtime-core)

> Normativa: [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) · Principio componenti: [`ARTIST_FRIENDLY_COMPONENTS.md`](ARTIST_FRIENDLY_COMPONENTS.md) · Visione UX: [`ArtCade_V2_Riepilogo_Suggerimenti.md`](ArtCade_V2_Riepilogo_Suggerimenti.md).

## Completato

### 1. JSON Schema registry (Riepilogo §6.1) — 2026-05

- [x] Schemi draft-07 per tutti i trigger / action / condition MVP
- [x] `schema-registry.ts` (Ajv) + test Vitest anti-drift
- [x] **Build-time Ajv (Tauri CSP-safe)** — `npm run compile-schemas` → `validators.generated.ts`; runtime uses pre-compiled validators only (no `new Function()` / no `'unsafe-eval'` in release CSP) — 2026-05
- [x] Validazione load (skip eventi invalidi) + save (blocco)
- [x] `SchemaParamForm` — tutti i trigger + azioni/condizioni (schema-driven)
- [x] Sprint 2: `condition-node.schema.json`, `ConditionTreeEditor`, validazione albero OR/AND

## Completato (continuazione)

### 2. `wait` + timer Lua — 2026-05

- [x] Azione `wait` in `types/logic-board.ts`, schema, compiler (`time.delay`)
- [x] Rinomina `_logic_timers` per non collidere con `time.*` runtime
- [ ] Coroutine `coroutine.yield` (opzionale; `time.delay` copre il flusso lineare MVP)

## Priorità aperte

### 3. UX componenti artist-friendly

Regola: mostrare i numeri di design quando servono al bilanciamento; nascondere
o spostare in Advanced solo la complessità engine-only.

- [x] **Logic Board UX refresh (English)** — `friendly-labels.ts`, When / Only if / Then blocks, grouped pickers, advanced condition tree + Script tab tucked away — 2026-05
- [x] **Entity-first authoring** — rulesheets default to `entity_id`, Scenes-panel/Inspector navigation, class boards under Advanced — 2026-05
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

### 6. Runtime spawn (clone class template) — 2026-05

- [x] `object.spawn` / `spawnEntity` clona la prima entità del progetto con quella `className` (sprite, physics, tag), posizione impostata, entità aggiunta alla scena attiva

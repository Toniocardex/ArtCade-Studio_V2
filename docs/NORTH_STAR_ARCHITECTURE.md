# ArtCade V2 — North Star Architecture

> **Purpose:** Single reference for *how ArtCade should be shaped* — principles, boundaries, and data flow.  
> **Source:** Derived from [`Report-Struttura-Artcade.md`](Report-Struttura-Artcade.md), aligned with the **actual** V2 codebase (2026-06).  
> **Audience:** Contributors, reviewers, future-you before proposing a “big rewrite”.

---

## 1. One sentence

**ArtCade is a 2D game engine with its own project model and runtime; Raylib is the rendering/input/audio backend, not the product.**

---

## 2. Layered responsibilities

```
┌─────────────────────────────────────────────────────────┐
│  Editor (React + Tauri) — authoring shell               │
│  Canvas · Inspector · Logic Board · Scripts · Assets    │
└───────────────────────────┬─────────────────────────────┘
                            │ mutates / validates
┌───────────────────────────▼─────────────────────────────┐
│  Project Model (TypeScript ProjectDoc + JSON on disk)   │
│  scenes · entities · object types · logicBoards · assets│
└───────────────────────────┬─────────────────────────────┘
                            │ runtime-fingerprint / WASM JSON
┌───────────────────────────▼─────────────────────────────┐
│  Runtime (C++ / WASM) — executes the project          │
│  World (ECS) · Physics · Lua · Renderer draw queue      │
└───────────────────────────┬─────────────────────────────┘
                            │ platform APIs only here
┌───────────────────────────▼─────────────────────────────┐
│  Platform — Raylib (window, draw, input, audio)         │
└─────────────────────────────────────────────────────────┘
```

| Layer | Must | Must not |
|-------|------|----------|
| **Editor** | Edit `ProjectDoc`, validate, sync preview via `RuntimeSyncService` | Run gameplay physics, call Raylib, own runtime truth |
| **Project model** | Be source of truth for save/export/play payload | Depend on React or Raylib |
| **Runtime** | Step simulation, render, run Lua / compiled logic | Know Inspector UI details |
| **Raylib backend** | Implement draw/input/audio | Contain game rules or Logic Board semantics |

See also: [`RAYLIB_PLATFORM_BOUNDARY.md`](RAYLIB_PLATFORM_BOUNDARY.md), [`ARCHITECTURE_INTEGRATION.md`](ARCHITECTURE_INTEGRATION.md), [`TECHNICAL_OVERVIEW.md`](TECHNICAL_OVERVIEW.md).

---

## 3. Project model as source of truth

Everything durable flows from **`ProjectDoc`** (`editor/src/types`):

- Editor reducers + undo (`project-history.ts`) snapshot the doc.
- Save/export writes `project.json` inside `.artcade` (ZIP).
- Preview/play pushes a **runtime projection** (`runtime-fingerprint.ts`, `runtime-sync-service.ts`).
- Validation runs **before** save and **before** play (`project-validator.ts`, `project-health.ts`).

The runtime never parses Logic Board JSON at play time — boards are **compiled to Lua** in the editor (`logic-compile-service.ts`).

---

## 4. Editor ↔ runtime contract (WASM preview)

| Direction | Mechanism |
|-----------|-----------|
| React → C++ | `editor_*` `ccall` (load project, play/stop, patch entity, tools) |
| C++ → React | `window.on*` callbacks + buffered console (`wasm-bridge.ts`) |

Patterns:

- **Black-box canvas** — React does not drive per-frame gameplay.
- **Imperative commands** — no real-time React state mirroring transforms during play.
- **Incremental sync** — Inspector edits use `editor_update_entity` when possible; structural edits full-load.

---

## 5. Runtime internals (C++)

- **ECS:** EnTT registry inside `RuntimeEntityGateway` / `World` — not classic OOP entity hierarchies. Rationale: [`ARCHITECTURAL_RATIONALE.md`](ARCHITECTURAL_RATIONALE.md).
- **Modules:** `IModule` + `EngineContext` DI (`runtime-cpp/src/modules/*`).
- **Rendering:** deferred `drawQueue` → `RaylibRenderer` (`renderer.cpp`). Gameplay code does not include `<raylib.h>`.
- **Collision:** `CollisionWorld` is the gameplay authority for CollisionBody shapes, tilemap collision, raycast/overlap/sweep queries, platformer resolution, events, and debug overlay.
- **Physics:** optional arcade body state/solver for dynamic movement (`physics/`), not Box2D; it does not own gameplay collision masks.
- **Logic at runtime:** Lua 5.4 (+ Game API), including Logic Board **generated** handlers.

---

## 6. How V2 differs from the generic “ArtCade report”

The report at repo root describes a **greenfield C/C++ monolith** (`src/editor/`, `src/core/`, native LogicRuntime). **V2 deliberately diverges** where the product goals require it:

| Report assumption | ArtCade V2 choice | Why |
|-------------------|-------------------|-----|
| Editor in C++ | **React + Tauri** | Rich Logic Board UI, web/desktop shell, fast iteration |
| Shared C++ core for editor + runtime | **TS `ProjectDoc` + C++ `types.h` + JSON bridge** | WASM preview, Vitest, single authoring model |
| `LogicRuntime` in C++ | **Compile boards → Lua** | One execution path; same API as hand-written scripts |
| Multi-file project tree (`scenes/*.json`, …) | **`project.json` + `.artcade` ZIP** | Shipping format already in use |
| OOP entities | **ECS (EnTT)** | Cache-friendly WASM performance |
| Granular `Command` objects everywhere | **Project snapshot undo** (+ domain reducers) | Shipped; refine only if undo memory hurts |
| Folder layout `src/{core,runtime,editor}` | **`editor/` + `runtime-cpp/`** | Same boundaries, different tree |

**Do not** propose rewriting the editor in C++ to “match the report” unless there is a new product mandate — align on **principles**, not folder names.

---

## 7. World settings field contract (TS ↔ JSON ↔ runtime)

`ProjectDoc.world` in TypeScript is the authoring source of truth. Not every flag reaches every layer:

| Field | Persisted in `project.json` | WASM / C++ runtime | Effect |
|-------|----------------------------|--------------------|--------|
| `gravity`, `pixelsPerMeter`, `timeScale`, `physicsMode` | Yes | Yes (`parseRuntimeSettings`, physics) | Simulation |
| `physicsDebugDraw` | Yes | Yes (`EditorAPI::s_physicsDebugDraw`, overlay in play) | Full WASM reload when changed (`worldRuntimeDigest` / `wd`) |
| `logicDebugTrace` | Yes | No (not interpreted in C++) | Logic Board compile only → extra `debug.log` in generated Lua |
| `showRuntimeStats` | Yes | No | Editor UI only (`useRuntimeProfilePoll`, status bar) |

C++ also defines a smaller `WorldSettings` struct in `runtime-cpp/src/core/types.h` (gravity scale only) used by native physics helpers — do not confuse it with the JSON `world` object shape in `editor/src/types`.

When adding a world flag, decide: **runtime sim**, **WASM preview reload**, **compile-time Lua**, or **editor-only**, then update `worldRuntimeDigest`, parser (`editor-api.cpp` / `project-doc-parser.cpp`), and Inspector accordingly.

---

## 8. Validation & debug (report §21–§22)

**Validation (editor):**

- Structural: assets, scenes, instances, physics warnings (`project-validator.ts`).
- Logic Board: trigger/target matrix, click-to-destroy rules (`trigger-compatibility.ts`, `logic-compile-service.ts`).
- **Play is blocked** when project-level errors exist (`project-health.ts`).

**Debug:**

| Feature | Where |
|---------|--------|
| Logic rule trace | World setting `logicDebugTrace` → `debug.log` in generated Lua |
| Collision overlay | World setting `physicsDebugDraw` → runtime draw from `CollisionWorld` (play mode) |
| Frame / module timings | `RuntimeProfiler` + status bar poll (`editor_get_runtime_profile`) |
| Lua draw helpers | `debug.drawRect`, `debug.profile()` in Game API |

---

## 9. Camera & output policy (deferred product surface)

**Current behaviour:**

- **Edit preview:** `ViewportPolicy::EditorPreview` — window = `worldSize`, 1:1 world canvas (`app.cpp`).
- **Play (WASM/native):** `ViewportPolicy::NativePlay` — window = `viewportSize`, camera maps world → viewport.
- **Editor-only:** “Camera preview” clips the React wrapper to `viewportSize` without changing WASM window size.

**Not yet a user-facing “output mode”** (fit / letterbox / stretch for published builds). That belongs in project/scene export settings and `Renderer` policy — tracked in [`TECHNICAL_DEBT_REVIEW.md`](TECHNICAL_DEBT_REVIEW.md). Until then:

- `CameraManager` handles shake; **follow** often goes through `Renderer` / `CameraTargetComponent` / Logic `camera.centerOn` — document which path you use per feature.
- Avoid adding a second hidden camera system without updating this section.

---

## 10. Release build checklist (desktop + preview)

Before tagging or shipping an installer:

1. `cd runtime-cpp && build_wasm.bat` — copies `game.js` + `game.wasm` to `editor/public/runtime/` (`.wasm` is gitignored; stale WASM is a common preview bug).
2. `cd editor && npm test -- --run`
3. `cd editor && npm run build`
4. Close running `artcade-editor.exe`, then `npm run desktop:release` (installers) or `npm run desktop:build` (exe only)
5. Smoke: open project, toggle **Collision overlay**, drag entity (rotation/scale preserved), Play blocked when health errors exist.

---

## 11. Roadmap alignment

Implemented report-alignment tranches (see [`ROADMAP_INTEGRATIVA.md`](../ROADMAP_INTEGRATIVA.md)):

| Phase | Focus |
|-------|--------|
| A | Unified project undo/redo |
| B | `project-validator` + save/compile integration |
| C | Raylib boundary documentation |
| D | Logic debug trace + architecture doc (this file) |
| E+ | Extended validation UI, physics overlay, runtime stats (this doc §7) |

---

## 12. Decision checklist (before a large PR)

1. Does it mutate **`ProjectDoc`** (or a documented projection), not ad-hoc globals?
2. Does gameplay stay out of React and out of Raylib headers outside the platform layer?
3. If it touches Logic Board, does **compile + validator** stay in sync?
4. If it needs undo, does it go through existing **project history** or a justified new command type?
5. Would the change still make sense for **WASM preview and native export** together?

If any answer is “no”, stop and narrow the scope.

---

## Related documents

| Doc | Topic |
|-----|--------|
| [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) | Board JSON, compiler, UI terms |
| [`OBJECT_TYPES_ARCHITECTURE.md`](OBJECT_TYPES_ARCHITECTURE.md) | format v2, instances |
| [`FIXED_STEP_CONTRACT.md`](FIXED_STEP_CONTRACT.md) | Physics timestep |
| [`Report-Struttura-Artcade.md`](Report-Struttura-Artcade.md) | Original north-star prose (Italian) |

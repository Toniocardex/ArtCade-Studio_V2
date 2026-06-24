# ArtCade Pre-Release Operational Roadmap

> **Status:** Living document — update at the end of each phase gate.  
> **Date:** 2026-06-24  
> **Target release:** Public alpha `0.1.0-alpha`  
> **Source of truth (product bar):** [`MVP_RELEASE_GATE.md`](MVP_RELEASE_GATE.md)  
> **Engineering policy:** [`PRE_RELEASE_NATIVE_RULES.md`](PRE_RELEASE_NATIVE_RULES.md)  
> **Gap baseline:** Repo audit 2026-06-24 (20 P0 sections — all PARTIAL or worse)

---

## Purpose

This roadmap turns the MVP release gate into **ordered, shippable work** with:

- explicit **phase gates** (no phase starts until the previous gate passes),
- **acceptance criteria** tied to the tester scenario,
- **layer ownership** (editor TS / Tauri / runtime C++ / docs),
- **verification commands** before any phase is marked done.

It is **not** a feature wishlist. Every item maps to a P0 bullet in
`MVP_RELEASE_GATE.md` or blocks the acceptance scenario in that document.

---

## Release north star

An external tester completes this cycle **without engine patches or hand-edited
project files**:

```text
Create → Edit → Save → Close → Reopen → Play → Fix → Export → Run outside ArtCade
```

**Acceptance game content** (from the gate): start menu, ≥2 scenes, controllable
character, collisions, animations, enemy/obstacle, collectible, score variable,
audio, HUD, game over or victory, saved/reopened project, Windows x64 export.

**Proof artifact:** one committed example project (`examples/platformer-alpha/`
or template upgrade) built only through the editor, plus a written walkthrough
matching gate §19 steps 1–10.

---

## Current baseline (2026-06-24)

| Strength (keep) | Gap (fix before alpha) |
|-----------------|------------------------|
| Logic Board → Lua compiler + tests | Canvas multi-select, copy/paste, overlap pick |
| WASM preview = export web runtime | Asset delete without reference check |
| Undo/redo on full `ProjectDoc` | HUD Button (or officially supported menu pattern) |
| Windows export pipeline (`dist/`) | End-user tutorial + `LUA_GAME_API.md` |
| Object types + instance rematerialize | `onSceneStart`, scene reload fidelity |
| Path security + atomic save (Tauri) | Layer visibility/lock/opacity in project model |
| Templates: blank / arcade / platformer | Unified Project Settings + input map |
| Project validator + health banner | Play pause, clear console, focus source |

**Verdict:** Core vertical slice is buildable by the team today; **not** yet by
an external tester without workarounds.

---

## Phase overview

| Phase | Name | Goal | Gate |
|:-----:|------|------|------|
| **0** | Freeze & proof | Baseline metrics, example project attempt | Gap list signed off |
| **1** | Data integrity | Projects never silently break | Integrity gate |
| **2** | Canvas & selection | Editor usable for level building | Canvas gate |
| **3** | Gameplay P0 | Tester scenario playable in-editor | Play gate |
| **4** | Authoring UX | Settings, errors, safety, play debug | UX gate |
| **5** | Docs & release | Ship-ready artifacts | Release gate |

Phases are **sequential**. Phase N+1 may start only when phase N gate passes.

Estimated calendar (single developer, focused): **8–12 weeks**. Parallel work
(editor + runtime) can compress to **6–8 weeks** if tasks are split by layer.

---

## Phase 0 — Freeze & proof (3–5 days)

**Goal:** Establish measurable baseline and one honest vertical-slice attempt.

### Tasks

| ID | Task | Layer | MVP gate § |
|----|------|-------|------------|
| 0.1 | Record current version labels (`package.json`, `tauri.conf.json`) and align target `0.1.0-alpha` decision | docs | 20 |
| 0.2 | Run full test suite: `cd editor; npm test -- --run` — file pass/fail count | CI | 16 |
| 0.3 | Attempt gate acceptance game using **only** the editor; log every workaround | QA | scenario |
| 0.4 | Create `examples/` or upgrade `platformer` template to gate checklist | editor | 18, 19 |
| 0.5 | Sign off gap list (this roadmap §Current baseline) | product | — |

### Gate 0 — exit criteria

- [ ] Written workaround log exists (internal doc or issue list).
- [ ] `npm test -- --run` green (pre-existing failures documented).
- [ ] Team agrees phase order in this roadmap (no reorder without note here).

---

## Phase 1 — Data integrity (1.5–2 weeks)

**Goal:** Destructive operations cannot leave hidden broken references.

**Maps to:** MVP gate §3 (partial delete), §4 (duplicate names), §16, §17.

### 1.1 Asset delete safety

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 1.1a | Collect all references to an asset (entities, object types, logic board image refs, clips) | `collect-project-asset-refs.ts` | ✅ Done — image/audio/font/tileset refs covered |
| 1.1b | Block delete (or confirm + list dependents) when refs > 0 | `useAssetExplorerActions.ts`, asset context menu | ✅ Done — deletion blocked with dependency list |
| 1.1c | Extend `strip-project-asset-refs.ts` to scrub `objectTypes.sprite` and logic refs | `strip-project-asset-refs.ts` | ✅ Done — includes `elseActions`, object type sprites, text fonts |
| 1.1d | Prevent duplicate import of same file hash/path (optional: merge or warn) | `asset-file-api.ts`, `asset-duplicate-detect.ts`, import entry points | ✅ Done — SHA-256 content hash blocks duplicate imports before write |

### 1.2 Naming & duplicate messages

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 1.2a | `OBJECT_TYPE_ADD` / rename: case-insensitive duplicate check | `object-type-reducer.ts`, `useSceneExplorerActions.ts` | ✅ Done — duplicate create blocked with explicit user message |
| 1.2b | `ENTITY_SET_NAME`: reject duplicate instance names in scene | `entity-reducer.ts`, `project-instance-names.ts`, inspector/hierarchy UI | ✅ Done — duplicate rename blocked with explicit message |
| 1.2c | Asset rename action (display name only; ID immutable) | asset reducer + inspector UI | ✅ Done — image/audio/font/tileset names editable, IDs/paths unchanged |

### 1.3 Project open health

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 1.3a | On open: consolidated missing-asset report (dialog or health panel) | `project-file-api.ts`, `useFileMenuActions.tsx` | ✅ Done — open warnings list missing paths and remediation |
| 1.3b | Unknown `formatVersion`: block open with upgrade message | `project-codec.ts`, `loadProjectFromPath` | ✅ Done — future format reports supported/current version |
| 1.3c | Lua trust warning on open when `scripts/` non-empty | `useFileMenuActions.tsx` | ✅ Done — trust confirmation before loading Lua projects |

### 1.4 Tests (required)

| ID | Test | File |
|----|------|------|
| 1.4a | Delete image referenced by object type → blocked | ✅ `collect-project-asset-refs.test.ts` |
| 1.4b | Duplicate object type name → user message | ✅ `editor-store.scene-objects.test.ts` |
| 1.4c | Save round-trip after rename asset | ✅ `project-codec-roundtrip.test.ts` |

### Gate 1 — exit criteria

- [x] Delete asset with dependents → **blocked** with dependency list.
- [x] Create object type `"Player"` when `"Player"` exists → **explicit error**.
- [x] Open project with missing texture → **health UI** lists path + fix hint.
- [x] `npm test -- --run` green including new integrity tests.
- [x] Workaround log items for §3 delete and §4 naming marked **resolved**.

---

## Phase 2 — Canvas & selection (1.5–2 weeks)

**Goal:** Level building meets gate §2 minimum bar (selection + undo already OK).

**Maps to:** MVP gate §2, §6 (layer visibility).

### 2.1 Selection model

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 2.1a | Extend `EditorSelection` to multi-id set (same scene) | `editor-store-state.ts`, `ui-reducer.ts` | ✅ Done — hierarchy Ctrl/Cmd-click adds/removes from selection |
| 2.1b | Canvas + hierarchy selection stay in sync | `useSceneExplorerActions.ts`, `runtime-sync-service.ts` | Select in tree updates canvas highlight set |
| 2.1c | Overlap pick: Alt+click cycles hits by `renderOrder` desc | `editor-input-controller.cpp` | Documented in tooltip; test manual script |
| 2.1d | Delete / Backspace deletes selected instance(s) | `useViewportShortcuts.ts` | Works for multi-select |

### 2.2 Clipboard

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 2.2a | `INSTANCE_COPY` / `INSTANCE_PASTE` in store (scene-local) | `object-type-reducer.ts`, editor store | ✅ Done — copies transform, type ref, overrides |
| 2.2b | Ctrl+C / Ctrl+V on canvas and hierarchy | `useViewportShortcuts.ts`, scene object context menu | ✅ Done — single-selection paste offsets position |
| 2.2c | Undo integrates copy/paste | `project-history.ts` | ✅ Done — copy is editor-only; paste is undoable |

### 2.3 Transform tools (inspector remains; canvas optional for alpha)

| ID | Work | Priority | Done when |
|----|------|----------|-----------|
| 2.3a | Scale handles on canvas (corner drag) | SHOULD for alpha | Inspector-only acceptable if documented in tutorial |
| 2.3b | Rotate handle or R+drag | P1 defer | — |

### 2.4 Layer authoring

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 2.4a | Add `visible`, `locked`, `opacity` to `LayerDef` | `types/index.ts`, `layer-reducer.ts` | ✅ Done — fields round-trip and default-clean |
| 2.4b | Wire to render path (world layers) | `app_scene_render.cpp`, `parallax-renderer.cpp`, `tilemap-renderer.cpp` | ✅ Done — hidden layers skipped; opacity applied to entity visuals |
| 2.4c | Editor: locked layer blocks selection/drag | `editor-input-controller.cpp`, `SceneLayersPanel.tsx` | ✅ Done — eye/lock controls; locked/hidden layers not picked or dragged |
| 2.4d | Document parallax `0` + `screenSpace` as HUD pattern | tutorial (phase 5) | Gate §6 screen-space HUD satisfied |

### Gate 2 — exit criteria

- [ ] Multi-select 3 objects → move together → undo restores.
- [x] Copy/paste instance → reopen project → pasted instance persists.
- [ ] Alt+click through stacked sprites cycles selection.
- [x] Layer hide → object invisible in play mode.
- [ ] Gate §2 wording: *"reliable selection"* and copy/paste — **signed off**.

---

## Phase 3 — Gameplay P0 (2–2.5 weeks)

**Goal:** Acceptance scenario playable without code edits.

**Maps to:** MVP gate §5, §7, §8, §9, §10.

### 3.1 Logic Board gaps

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 3.1a | Add `onSceneStart` trigger (schema + compiler + labels) | `triggers.json`, `compiler.ts`, `trigger-compatibility.ts` | Fires once per scene load, not per game start |
| 3.1b | Add `isVisible` / `objectVisible` condition | `conditions.json`, compiler | Picker + test |
| 3.1c | Register `compareVariable` in `conditions.json` + `index.json` | schemas, `npm run compile-schemas` | Ajv validates; picker shows condition |
| 3.1d | Empty-state hints for scene-target boards without `onSceneStart` | Logic Board panel | Nudge text visible |

### 3.2 Scene lifecycle

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 3.2a | `scene.restart()` reloads instances from saved `SceneDef` | `world.cpp`, `runtime-entity-gateway.cpp` | Position after play resets to saved |
| 3.2b | Scene change clears scene-scoped state (when 3.3 lands) | `World::loadScene` | No stale entities from previous scene |
| 3.2c | Editor stop-play calls same restore path as 3.2a | `editor-api.cpp` | STOP ≡ restart to design state |

### 3.3 Variables

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 3.3a | `sceneVariables` on `SceneDef` + runtime store | `types/index.ts`, `variable-manager.cpp` | Cleared on scene change |
| 3.3b | Logic Board `modifyVariable` scope `scene` | `actions.json`, compiler | Tutorial step “score per scene” optional |
| 3.3c | Inspector UI for scene variables | new inspector section | Create/edit number/bool/string |

### 3.4 Collision & animation (minimum)

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 3.4a | Collision category + mask on `Collider` | `PhysicsComponent`, physics filter C++ | Two layers don't collide when masked |
| 3.4b | Expose `animation.pause` / `animation.stop` in Lua + LB action | `animation-api.cpp`, `actions.json` | Gate §5 animator sub-bar met |

### 3.5 HUD / menu path (choose one — decision required)

**Decision (2026-06-24): Option B** — screen-space sprite + `onObjectClick` + `loadScene` as the
official alpha menu pattern. `ButtonComponent` deferred post-alpha unless schedule allows.
See [`PHASE0_WORKAROUND_LOG.md`](PHASE0_WORKAROUND_LOG.md) § HUD / menu decision.

**Option A (deferred):** `ButtonComponent` — screen-space, text/image, `onClick` → Logic Board event.  
**Option B (alpha):** Document + template **screen-space sprite + `onObjectClick`** as official menu button; ship `MenuButton` object type in template.

| ID | Work | Done when |
|----|------|-----------|
| 3.5a | Team records decision at top of this section (date + option) | Checkbox in gate review |
| 3.5b | Implement chosen option end-to-end | Start menu → play → game over → restart works |
| 3.5c | Template `platformer` includes menu + game over scene | New project demonstrates flow |

### Gate 3 — exit criteria

- [ ] **Proof game** (phase 0.4) complete: all gate scenario bullets without manual JSON/Lua repair.
- [ ] `onSceneStart` used for menu → level transition.
- [ ] Score increments on coin collect; HUD text updates.
- [ ] Play → die → game over → restart → scene layout restored.
- [ ] `cd editor; npm test -- --run` + logic compiler tests green.
- [ ] If runtime-cpp changed: WASM rebuild + smoke play in preview.

---

## Phase 4 — Authoring UX & export polish (1.5–2 weeks)

**Goal:** External tester can configure project, debug, and export without asking the team.

**Maps to:** MVP gate §12–§15, §18.

### 4.1 Project Settings panel

| ID | Work | Fields | Done when |
|----|------|--------|-----------|
| 4.1a | New `ProjectSettingsPanel` or inspector mode | project name, version, projectId (uuid) | Single surface, not scattered |
| 4.1b | Display / window | width, height, resizable, fullscreen, VSync, pixel-perfect | Serialized to `ProjectDoc` / runtime fingerprint |
| 4.1c | Runtime | target FPS, default background color | `runtime-fingerprint.ts` + C++ `ProjectRuntimeSettings` aligned |
| 4.1d | Input map (alpha minimum) | MoveLeft, MoveRight, Jump, Confirm → key bindings | Logic Board / controllers can reference map keys |

### 4.2 Play mode & console

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 4.2a | Pause / resume preview | `wasm-bridge.ts`, `editor-api.cpp` | Toolbar button + shortcut |
| 4.2b | Clear console | `ConsolePanel.tsx`, store action | Button clears log buffer |
| 4.2c | Focus source: click error → open Logic Board event or script line | console + logic board + script panel | At least LB rule id path works |
| 4.2d | Lua runtime error: parse file:line when present | `lua-host.cpp`, console | Jump to script line when parseable |

### 4.3 Export UX

| ID | Work | Primary files | Done when |
|----|------|---------------|-----------|
| 4.3a | Native export: user picks output folder | `main.rs` `run_build`, dialog | Not hard-coded only if product wants default + override |
| 4.3b | Export dialog: game name, version, Debug/Release toggle | build toolbar | Release default; Debug produces debug exe |
| 4.3c | Pre-export validation | `validateProjectBeforeSave` reuse | Export blocked with gate-style message (e.g. no startup scene) |

### 4.4 Error copy pass

| ID | Work | Done when |
|----|------|-----------|
| 4.4a | Audit top 15 validator errors → what / where / how to fix | Each message has fix sentence |
| 4.4b | Export failures use same pattern | Example in gate §15 replicated |

### 4.5 External UX

| ID | Work | Done when |
|----|------|-----------|
| 4.5a | Welcome / hub after splash: New, Open, Recent, Example | First-run not dropped into blank editor |
| 4.5b | “Open example project” loads platformer-alpha | Gate §18 example project |
| 4.5c | Shortcut reference sheet (Help menu or modal) | Gate §18 visible shortcuts |

### Gate 4 — exit criteria

- [ ] New tester configures resolution + FPS without editing JSON.
- [ ] Pause preview works; console clear works; one focus-source path verified.
- [ ] Export to chosen folder; exe runs outside editor on clean machine (smoke).
- [ ] Welcome hub navigable without docs.

---

## Phase 5 — Documentation & release (1–1.5 weeks)

**Goal:** Gate §19 and §20 satisfied; tag `0.1.0-alpha`.

### 5.1 User documentation (English)

| Doc | Path | Gate §19 |
|-----|------|----------|
| Install guide | `docs/user/INSTALL.md` | install |
| First project | `docs/user/FIRST_PROJECT.md` | first project |
| Tutorial (10 steps) | `docs/user/TUTORIAL_PLATFORMER.md` | steps 1–10 |
| Lua API reference | `docs/LUA_GAME_API.md` | basic Lua API |
| Export guide | `docs/user/EXPORT_WINDOWS.md` | export |
| Known issues | `docs/KNOWN_ISSUES.md` | known issues |

Topic guides (can be sections inside tutorial initially): assets, canvas,
layers, animations, collisions, Logic Board, variables, scene switching, audio.

### 5.2 In-editor doc links

| ID | Work | Done when |
|----|------|-----------|
| 5.2a | Help menu points to bundled or GitHub `docs/user/` paths | Offline-friendly note in INSTALL |
| 5.2b | Logic Board empty states link to tutorial anchors | — |

### 5.3 Release artifacts

| ID | Work | Done when |
|----|------|-----------|
| 5.3a | Version `0.1.0-alpha` in `package.json`, Tauri, about/status bar | Visible in UI |
| 5.3b | `CHANGELOG.md` section for alpha | Ship notes |
| 5.3c | `EARLY_ACCESS_RELEASE_NOTES.md` synced | Known issues linked |
| 5.3d | Reproducible build doc in INSTALL | `npm test`, `build_wasm.bat`, `desktop:release` |
| 5.3e | Bug report template (GitHub issue template or `docs/BUG_REPORT.md`) | Gate §20 |
| 5.3f | Log folder documented | `%APPDATA%` / Tauri log path |
| 5.3g | Installer or portable zip via `desktop:release` | Smoke on VM |

### Gate 5 — release gate (final)

All items from [`MVP_RELEASE_GATE.md`](MVP_RELEASE_GATE.md) P0 checklist reviewed:

- [ ] **Acceptance scenario** completed by person who did not implement the roadmap.
- [ ] **Cycle test:** Create → … → Run outside ArtCade — no data loss.
- [ ] `cd editor; npm test -- --run` green.
- [ ] `desktop:release` artifact smoke-tested.
- [ ] Tag `v0.1.0-alpha` (when product approves).

---

## Cross-cutting rules (every phase)

1. **Native-first** — no `setTimeout` workarounds, no silent try/catch; see
   `.cursor/rules/cursorrules-artcade.mdc`.
2. **Saved-project compat** — new fields optional only; bump `formatVersion` only
   with migration or block message.
3. **Schema changes** — `npm run compile-schemas` + commit `validators.generated.ts`.
4. **Tauri FS** — edit `capabilities/default.json`, then `npm run tauri:sync-schemas`.
5. **Tests** — new behavior gets a test in the same phase, not “later”.
6. **Pre-release policy** — one authoring path; no legacy dual paths (
   `OBJECT_MODEL_MIGRATION.md`).

### Verification commands (standard)

```powershell
cd editor; npm test -- --run
```

After `runtime-cpp/` changes:

```powershell
cd runtime-cpp; .\build_wasm.bat
cd ..\editor; npm run desktop:build
```

Before release tag only:

```powershell
cd editor; npm run desktop:release
```

---

## P1 deferral list (do not block alpha)

Track in `KNOWN_ISSUES.md` or GitHub milestones — not in phase gates above:

- Autosave
- Canvas scale/rotate gizmos (if inspector-only documented)
- Full input map editor beyond four actions
- Asset OS drag-drop for audio/font
- Web export as primary target
- Installer polish beyond single MSI/NSIS smoke
- `artcade.project` multi-file layout (monolithic `project.json` OK for alpha if documented)
- Per-instance component/sprite overrides (variant = new object type policy)

---

## Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Button vs click-sprite decision delays phase 3 | Menu blocked | Decide in phase 0.3 workaround log; default Option B if schedule slips |
| `scene.restart` touches ECS gateway | Regressions in play mode | Phase 3.2 tests + manual play gate |
| Collision layers scope creep | Delays phase 3 | Minimum: 4 categories + bitmask; no full physics editor |
| Docs written but not validated | False release gate | Phase 5 gate requires external tester follow tutorial only |
| Version `2.0.0` vs `0.1.0-alpha` confusion | Support noise | Phase 0.1 + 5.3a align labels |

---

## Tracking

Update this table when a phase gate passes:

| Phase | Status | Gate date | Notes |
|:-----:|:------:|:---------:|-------|
| 0 | ✅ Done | 2026-06-24 | [`PHASE0_WORKAROUND_LOG.md`](PHASE0_WORKAROUND_LOG.md); tests 1026/1026; HUD Option B |
| 1 | ⬜ | | |
| 2 | ⬜ | | |
| 3 | ⬜ | | |
| 4 | ⬜ | | |
| 5 | ⬜ | | |

**Changelog (this file)**

| Date | Change |
|------|--------|
| 2026-06-24 | Initial roadmap from MVP gap analysis |
| 2026-06-24 | Phase 0 complete; HUD Option B; workaround log added |

---

## Related documents

| Document | Role |
|----------|------|
| [`MVP_RELEASE_GATE.md`](MVP_RELEASE_GATE.md) | What “done” means for alpha |
| [`CHECKLIST_SICUREZZA_QUALITA_AFFIDABILITA.md`](CHECKLIST_SICUREZZA_QUALITA_AFFIDABILITA.md) | Security/quality cross-check at gate 5 |
| [`OBJECT_MODEL_MIGRATION.md`](OBJECT_MODEL_MIGRATION.md) | Object type architecture (pre-release) |
| [`LOGIC_BOARD_SPEC.md`](LOGIC_BOARD_SPEC.md) | Logic Board contracts for phase 3 |
| [`PHASE0_WORKAROUND_LOG.md`](PHASE0_WORKAROUND_LOG.md) | Phase 0 vertical slice assessment, workaround catalog, HUD decision |
| [`PRE_RELEASE_NATIVE_RULES.md`](PRE_RELEASE_NATIVE_RULES.md) | Implementation policy |

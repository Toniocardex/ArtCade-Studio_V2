# Phase 0 — Vertical Slice Workaround Log

> **Date:** 2026-06-24  
> **Method:** Codebase trace + compiler/runtime contract review (no manual GUI session).  
> **Gate reference:** [`MVP_RELEASE_GATE.md`](MVP_RELEASE_GATE.md) acceptance scenario  
> **Roadmap:** [`PRE_RELEASE_ROADMAP.md`](PRE_RELEASE_ROADMAP.md) Phase 0  
> **Next phase:** Phase 1 (data integrity) unless a Phase 0 blocker below is promoted.

---

## Baseline snapshot (0.1–0.2)

| Item | Value |
|------|-------|
| Editor package version | `2.0.0` (`editor/package.json`) |
| Tauri app version | `2.0.0` (`editor/src-tauri/tauri.conf.json`) |
| Target public label | `0.1.0-alpha` (per gate — **not yet applied**) |
| Project format | `formatVersion: 3`, monolithic `project.json` |
| Test suite (2026-06-24) | **184** files, **1026** tests — **all passed** |
| Command | `cd editor; npm test -- --run` |

---

## HUD / menu decision (0.5)

**Decision:** **Option B** — official MVP pattern for alpha.

| Option | Verdict |
|--------|---------|
| A — `ButtonComponent` | Defer to post-alpha unless Phase 3 schedule allows |
| **B — screen-space sprite + `onObjectClick` + `loadScene`** | **Adopt now** |

**Rationale**

- `onObjectClick` trigger exists in schema (`triggers.json`) and compiler.
- `TextComponent.screenSpace` + `setText` with global variable covers score/HUD.
- No `ButtonComponent` in runtime; building one is Phase 3-sized work.
- Gate requires menus that work, not a widget named “Button”.

**Official pattern (document in tutorial Phase 5)**

1. Object type `MenuButton` — sprite (or tinted rect placeholder), `screenSpace: true`, large hit area.
2. Global or scene board: **When** `onObjectClick` (left) **Then** `loadScene('scene_level')`.
3. Start scene = menu scene (`activeSceneId`); level is second scene.

Recorded in `PRE_RELEASE_ROADMAP.md` §3.5.

---

## Gate scenario walkthrough

Legend: **OK** = works today without engine patches · **WORK** = doable with documented workaround · **BLOCK** = blocks external tester or needs Phase 1+ fix

| Step | Gate requirement | Status | Notes / workaround |
|------|------------------|--------|-------------------|
| 1 | Create new project | **OK** | File → New → Platformer (or Blank) |
| 2 | Import Player + Ground sprites | **WORK** | Asset explorer → Import PNG; OS drop **images only** (audio/font via button) |
| 3 | Create object definitions | **WORK** | Adding instance creates type; no “type only” flow — acceptable |
| 4 | Assign textures | **OK** | Inspector `SpriteSection` or double-click asset |
| 5 | Add colliders | **OK** | `ComponentsSection` → Physics collider |
| 6 | Movement + jump | **OK** | Platformer template ships `platformerController`; LB `requestPlatformerJump` optional |
| 7 | Second scene | **OK** | Scene explorer → Add scene |
| 8 | Start menu | **WORK** | Menu scene + `onObjectClick` → `loadScene` (Option B); no `onSceneStart` — use `onSpawn` / global `onStart` for boot |
| 9 | Enemy / obstacle | **WORK** | New object type + `LinearMover` or kinematic physics; no template enemy |
| 10 | Collectible coin | **WORK** | Type `Coin` + sensor collider; LB `onCollisionEnter` with `Coin` class |
| 11 | Score variable | **OK** | `ProjectVariablesSection` + `modifyVariable` / `setText` bind |
| 12 | Animations | **WORK** | Sprite Studio clips on asset; `playAnimation` action; pause/stop not in LB |
| 13 | Audio | **WORK** | Import OGG/WAV; `playSound` / `playMusic`; assign path in action picker |
| 14 | HUD (score on screen) | **OK** | Text component, screen-space, `setText` with `prefix: 'Score: '` |
| 15 | Game over / victory | **WORK** | `onHealthDepleted` + `loadScene('scene_gameover')` or `setVisible` on overlay text; no dedicated screen type |
| 16 | Save project | **OK** | Save / Save As; atomic write via Tauri |
| 17 | Close + reopen | **OK** | Round-trip tested in codec tests |
| 18 | Play in editor | **OK** | F5 preview; STOP restores design state |
| 19 | Fix after play | **WORK** | STOP restores layout; **in-game `restartScene` does not fully reset** to saved layout (Phase 3.2) |
| 20 | Export Windows | **OK** | Build → `dist/<GameName>/` with exe + `game.artcade` |
| 21 | Run outside editor | **OK** | Native `game.exe` in dist folder |
| 22 | No hand-edited JSON/Lua | **WORK** | Logic Board covers gameplay; **manual Lua only if bypassing LB** |
| 23 | No silent broken refs | **BLOCK** | Delete asset **without** ref check (Phase 1.1) |

**Cycle verdict:** Steps 1–21 are **reachable** with Option B menu pattern and Logic Board. Step 23 and several **WORK** items are unacceptable for a naive external tester without docs — drives Phase 1–5 order.

---

## Workaround catalog (by severity)

### BLOCK — fix before external alpha

| ID | Issue | Workaround today | Fix phase |
|----|-------|------------------|-----------|
| W-B1 | Delete asset does not check references | **Resolved in Phase 1.1:** delete is blocked with dependency list | **Done** |
| W-B2 | No end-user tutorial | Team oral handoff only | **5.1** |
| W-B3 | `docs/LUA_GAME_API.md` missing | Read compiler tests / AGENTS.md | **5.1** |

### HIGH — tester will hit friction

| ID | Issue | Workaround today | Fix phase |
|----|-------|------------------|-----------|
| W-H1 | No `onSceneStart` | Use `onSpawn` on object-type boards; global `onStart` for boot only | **3.1a** |
| W-H2 | `scene.restart()` / replay reset incomplete | STOP editor preview instead of in-game restart | **3.2** |
| W-H3 | Platformer template = player + ground only | Manual build coin/enemy/menu/HUD | **0.4 / 3.5c** |
| W-H4 | No multi-select / copy-paste instances | Duplicate one-by-one (Ctrl+D) | **2.1–2.2** |
| W-H5 | Overlap selection | Click in hierarchy tree | **2.1c** |
| W-H6 | Duplicate object type name silent no-op | **Resolved in Phase 1.2a:** explicit duplicate message | **Done** |
| W-H7 | Project settings scattered (FPS, bg, window) | Defaults in `project.json` / scene viewport | **4.1** |

### MEDIUM — documented in tutorial OK for alpha

| ID | Issue | Workaround today | Fix phase |
|----|-------|------------------|-----------|
| W-M1 | Menu = sprite + click, not Button widget | Option B pattern | Doc **5.1** |
| W-M2 | HUD images = screen-space sprites | Same | Doc |
| W-M3 | Layer hide/show for UI | `setVisible` on entities; layer visibility N/A | **2.4** |
| W-M4 | Animation pause/stop | Re-play clip or hide sprite | **3.4b** |
| W-M5 | Export output folder fixed to `dist/` | Accept default path | **4.3** |
| W-M6 | No play pause | Stop and play again | **4.2** |
| W-M7 | Console no clear / focus source | Read messages manually | **4.2** |
| W-M8 | Re-import same PNG creates duplicate asset | **Resolved in Phase 1.1d:** content hash blocks duplicate imports | **Done** |
| W-M9 | Instance rename allows duplicates | **Resolved in Phase 1.2b:** duplicate scene names rejected | **Done** |
| W-M10 | No Lua trust warning on open | **Resolved in Phase 1.3c:** trust confirmation before load | **Done** |

### LOW — P1 or doc-only

| ID | Issue | Fix phase |
|----|-------|-----------|
| W-L1 | Canvas scale/rotate gizmo | Inspector only → tutorial | P1 / doc |
| W-L2 | Asset rename | Re-import with new name | **1.2c** |
| W-L3 | `compareVariable` not in JSON schema | Still works in compiler | **3.1c** |
| W-L4 | Scene-scoped variables | Use globals for MVP | **3.3** |
| W-L5 | Collision layer/mask | Use class-based collision only | **3.4a** |
| W-L6 | Version `2.0.0` vs `0.1.0-alpha` | Internal only until **5.3a** |

---

## Platformer template gap (0.4)

Current `createPlatformerProject()` (`editor/src/utils/project-templates.ts`):

| Shipped | Missing for gate scenario |
|---------|---------------------------|
| Player + `platformerController` | Menu scene |
| Ground + `solid` | Level scene (rename `scene_main` or add `scene_level`) |
| `physicsMode: auto` | Coin type + sensor |
| Single scene | Enemy / hazard type |
| No sprites (tint only) | Sample sprites or documented placeholder art |
| No logic boards | Global `score` variable |
| No audio refs | HUD text instance |
| | Logic boards: coin pickup, game over, menu → play |
| | `activeSceneId` = menu scene |

**Target artifact (Phase 3.5c, not Phase 0):** extend template or add `examples/platformer-alpha/` on disk with above content, built only through editor actions (or programmatic `ProjectDoc` matching editor output).

**Reference:** compiler already documents coin pickup pattern in `compiler.test.ts` (“jump on Space + coin pickup”).

---

## Logic Board coverage vs gate (sanity check)

| Gate minimum | Present |
|--------------|---------|
| Triggers: start, tick, timer, input, mouse, spawn/destroy, collision, trigger, animation end | **Yes** (`triggers.json`) |
| `onSceneStart` | **No** → W-H1 |
| Conditions: compare, bool, exists, visible, input, collision class, variable compare | **Partial** — no `objectVisible`; `compareVariable` TS-only |
| Actions: move, velocity, visible, spawn/destroy, scene, anim, audio, vars, wait, log | **Yes** |
| Deterministic Lua + validation | **Yes** (1026 tests) |

---

## Phase 0 gate checklist

| Criterion | Status |
|-----------|--------|
| Workaround log exists | **Done** (this file) |
| `npm test -- --run` green | **Done** (1026/1026) |
| HUD decision recorded | **Done** (Option B) |
| Template gap documented | **Done** (§ Platformer template gap) |
| Team agrees phase order | **Pending user sign-off** |

**Phase 0 exit:** ✅ Ready to start **Phase 1** (data integrity).

---

## Recommended immediate tasks (Phase 1 entry)

1. **1.1a** — `collect-project-asset-refs.ts` (all ref sites including `objectTypes.sprite`, logic image refs).
2. **1.1b** — Block delete with dependency dialog in `useAssetExplorerActions.ts`.
3. **1.2a** — Duplicate object type name → user-visible error.

Do **not** start Phase 3 template until Phase 1 delete-safety lands (otherwise tutorial project breaks on asset cleanup).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-24 | Initial Phase 0 assessment |

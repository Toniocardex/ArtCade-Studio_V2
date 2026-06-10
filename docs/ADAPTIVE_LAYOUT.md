# ArtCade Studio — Adaptive Editor Layout

> **Status**: Approved specification (implementation reference)  
> **Version**: 1.0  
> **Date**: 2026-06-02  
> **Audience**: Editor / React developers, reviewers, collaborators  
> **Source**: Product decisions from layout planning session + `risoluzione_editor.docx` v1.0 (adapted to ArtCade architecture)

This document is the **canonical implementation reference** for responsive editor layout work. Do not implement layout changes without aligning to the decisions in §2 and the phase breakdown in §10.

**Related docs**

| Doc | Role |
|-----|------|
| `EDITOR_UI_DESIGN_SYSTEM.md` | Tokens, themes — chrome only, not game pixels |
| `docs/README.md` | Documentation index |
| `LOGIC_BOARD_UX_CHARTER.md` · `LOGIC_BOARD_SPEC.md` (Parte I) | Logic Board module UI and artist-first authoring |

---

## Table of contents

1. [Problem and goals](#1-problem-and-goals)
2. [Locked product decisions](#2-locked-product-decisions)
3. [Current codebase baseline](#3-current-codebase-baseline)
4. [Architecture overview](#4-architecture-overview)
5. [Layout tiers and breakpoints](#5-layout-tiers-and-breakpoints)
6. [Tier wireframes](#6-tier-wireframes)
7. [Global rules (all phases)](#7-global-rules-all-phases)
8. [Phase specifications](#8-phase-specifications)
9. [Persistence and storage keys](#9-persistence-and-storage-keys)
10. [Implementation roadmap](#10-implementation-roadmap)
11. [Test matrix](#11-test-matrix)
12. [Explicit non-goals](#12-explicit-non-goals)

---

## 1. Problem and goals

### 1.1 Problem

At **1920×1080** the editor workbench is usable. At **1366×768** and below, fixed sidebars, top chrome (~96px), and bottom dock compress the canvas and make panels illegible. The issue is a **rigid layout**, not monitor DPI alone.

### 1.2 Goals

| Goal | Success criterion |
|------|-------------------|
| Usable at 1366×768 | All essential workflows reachable without horizontal scroll; canvas ≥ 400×300 px |
| No regression at 1080p+ | Full layout matches pre-change behavior at 100% UI scale |
| Canvas isolation | Game preview (WASM) never scales with editor UI |
| Persistent layout | Panel sizes survive restart **per exact window resolution bucket** |
| Native-first | No `transform: scale()` on chrome; use CSS tokens + `rem` / `--editor-scale` |

### 1.3 Target resolutions

| Resolution | Tier (typical) | Objective |
|------------|----------------|-----------|
| ≥ 1920×1080 | `full` | Full workbench — maintain current UX |
| 1366×768 | `compact` | Compact shell — functional, readable |
| 1280×720 | `compact` / `minimal` | Minimum viable authoring |
| 2560×1440+ (HiDPI) | `full` + UI scale 115% | Readable chrome, sharp text |
| Ultra-wide 21:9 | `full` | Side panels expand; canvas uses remaining space |
| < 1024×600 | `unsupported` | Non-blocking warning; minimal shell only |

**Measurement**: All breakpoints use the **editor workspace container** size (`ResizeObserver` on `.editor-workspace`), not `window.screen` and not monitor resolution when the window is not maximized.

---

## 2. Locked product decisions

These answers are **final** for v1 of adaptive layout. Do not revert without explicit product review.

### 2.1 Structural (batch 1)

| ID | Topic | Decision |
|----|-------|----------|
| **D1** | Logic Board placement | **Tab module only** — `Canvas \| Logic Board \| Script Editor` via `ModuleTabs`. Bottom dock remains **Console + Logic Preview** (and other dock panels). **No** fixed Logic Board strip under the canvas. |
| **D2** | Inspector in `compact` tier | **Right overlay drawer** (~280px) over the canvas. No fixed narrow inspector column. |
| **D3** | Resolution warning banner | Show from **1280px workspace width** immediately (do not wait for Phase 4). Align `EditorViewportBanner` to doc messaging tiers over time. |
| **D4** | UI scale mechanism | **`font-size` + `rem` / spacing tokens** via `--editor-scale` on `.editor-shell`. **No** `transform: scale()` on chrome. |
| **D5** | Settings surface | **VIEW menu only** — no dedicated “Editor Settings” dialog in v1. Optional: StatusBar badge opens nothing extra beyond VIEW (see Phase 1). |

### 2.2 Detail (batch 2)

| ID | Topic | Decision |
|----|-------|----------|
| **D6** | Left sidebar in `compact` | **Unified tabs**: `[Project \| Assets \| Objects]` — one panel visible at a time in a single left column (~200px). |
| **D7** | Focus mode | **F11** + toolbar expand button; exit **manual only** (F11 / “Exit Focus”) — **no** auto-exit on object selection. |
| **D8** | First-launch UI scale | **Silent auto-apply** per table §8.1.3; user changes later via VIEW. No blocking first-run dialog. |
| **D9** | Layout persistence bucket | **Exact resolution** string `WxH` (e.g. `1366x768`, `1920x1080`) — separate saved layout per bucket. |
| **D10** | Bottom dock in `compact` | **Collapsed by default**; expands as **bottom-sheet** (slide up). |
| **D11** | Module tabs in `compact` / `minimal` | **Icon-only** + `title` / tooltip; labels hidden. |

### 2.3 Decision traceability

| Rejected alternative | ID | Reason |
|---------------------|-----|--------|
| Logic Board fixed 200px under canvas | D1 | Conflicts with full-screen Logic module; duplicates `ModuleTabs` |
| Inspector fixed 180px column in compact | D2 | Unreadable; wastes horizontal space |
| Banner only after Phase 4 | D3 | Users need feedback at 1280px during rollout |
| `transform: scale()` chrome | D4 | Blur / hitbox issues on HiDPI |
| Editor Settings dialog | D5 | Scope control; VIEW sufficient for v1 |
| Layout bucket by tier only | D9 | User asked for per-resolution memory |
| Auto-exit Focus on select | D7 | Interrupts flow; manual exit only |

---

## 3. Current codebase baseline

Implementers should know what already exists before adding phases.

| Area | Location | Current behavior |
|------|----------|------------------|
| Shell layout | `editor/src/App.tsx` — `EditorLayout`, `CanvasView` | Left sidebar + canvas + right inspector; `ResizeHandle` horizontal |
| Panel width persist | `editor/src/hooks/usePersistedWidth.ts` | `localStorage` keys `artcade.sidebar-left-w-v3`, `artcade.sidebar-right-w-v3`; clamp 180–480 |
| Default widths | `editor/src/constants/editor-layout.ts`, `:root` in `index.css` | Left 280px, right 320px, dock 280px |
| Bottom dock | `editor/src/components/shell/BottomDock.tsx` | Resizable height `artcade.bottom-dock-h-v5`; panels: console, timeline, logic preview, events |
| Module modes | `editor/src/components/shell/ModuleTabs.tsx` | `canvas` \| `logic` \| `script` — mutually exclusive full workspace |
| Narrow banner | `editor/src/components/shell/EditorViewportBanner.tsx` | Warning if `innerWidth < 1520` — **must change to 1280** (Phase 1) |
| VIEW menu | `editor/src/components/menu-bar/ViewToolbarMenu.tsx` | Theme toggle today — extend with Interface items |
| Design tokens | `editor/src/index.css`, `docs/EDITOR_UI_DESIGN_SYSTEM.md` | No `--editor-scale` yet |
| Game viewport | `editor/src/panels/PreviewPanel.tsx` | WASM — **must not** inherit `--editor-scale |

**Important**: `viewportSize` / `worldSize` on scenes are **game** settings (`editor-viewport.ts`), not editor UI. Never conflate them with `--editor-scale`.

---

## 4. Architecture overview

Three stacked layers (implement in roadmap order):

```
┌─────────────────────────────────────────────────────────┐
│ Layer 3 — Layout tier (Phase 4)                          │
│   full | compact | minimal | unsupported                 │
│   → different shell component trees                      │
├─────────────────────────────────────────────────────────┤
│ Layer 2 — Workbench state (Phase 2–3)                  │
│   Focus mode, panel sizes, dock collapsed, visibility    │
│   → persisted per artcade.layout-v2::<WxH>              │
├─────────────────────────────────────────────────────────┤
│ Layer 1 — UI scale (Phase 1)                           │
│   --editor-scale on .editor-shell                        │
│   → font-size + rem spacing; PreviewPanel excluded       │
└─────────────────────────────────────────────────────────┘
```

**Dependency rule**: Phase 3 (resize + persist) should be stable before Phase 4 (tier refactors), because tier changes assume persisted dimensions. Phase 1 may proceed in parallel with Phase 2.

---

## 5. Layout tiers and breakpoints

### 5.1 Tier definitions

| Tier | Workspace width | Workspace height | Shell behavior |
|------|-----------------|------------------|----------------|
| `full` | ≥ 1600 | ≥ 900 | Current three-column + bottom dock + full ModuleTabs labels |
| `compact` | ≥ 1280 and < 1600 **or** height < 900 but ≥ 680 | ≥ 680 | D6, D2, D10, D11 |
| `minimal` | ≥ 1024 and < 1280 **or** height < 680 but ≥ 600 | ≥ 600 | Near–Focus mode; hamburger / VIEW for panels |
| `unsupported` | < 1024 **or** < 600 | — | Banner + minimal shell; advise 1366×768 minimum |

**Evaluation**: Use **both** width and height. Example: 1400×650 → `minimal` (height fails `compact`).

Suggested hook API:

```ts
export type LayoutTier = 'full' | 'compact' | 'minimal' | 'unsupported'

export function resolveLayoutTier(width: number, height: number): LayoutTier {
  if (width < 1024 || height < 600) return 'unsupported'
  if (width < 1280 || height < 680) return 'minimal'
  if (width < 1600 || height < 900) return 'compact'
  return 'full'
}
```

File: `editor/src/hooks/useEditorLayoutTier.ts` (new, Phase 4).

### 5.2 Banner copy (D3)

| Tier | Banner |
|------|--------|
| `compact` (optional) | Informational only if needed after layout ships — prefer silent compact shell |
| `minimal` | `Low resolution — some features may be hard to use. Recommended minimum: 1366×768.` |
| `unsupported` | `Resolution not supported — use at least 1024×600 (1366×768 recommended).` |

**Phase 1 interim** (before tier shell): single banner when workspace width < **1280px**:

`Narrow window — layout is optimized for 1280px width or wider.`

Update `EditorViewportBanner.tsx` constant from `1520` → `1280` and prefer measuring `.editor-workspace` instead of `window.innerWidth` when Phase 4 lands.

---

## 6. Tier wireframes

### 6.1 `full` tier (≥ 1600×900)

```
┌──────────────────────────────────────────────────────────────┐
│ MenuBar                                                       │
│ [ Canvas ] [ Logic Board ] [ Script Editor ]    ← labels      │
├──────────┬─────────────────────────────────────┬─────────────┤
│ Left     │                                     │ Inspector   │
│ Sidebar  │         PreviewPanel (WASM)         │ resizable   │
│ 280px    │         min 400×300               │ 320px       │
│ default  │                                     │             │
├──────────┴─────────────────────────────────────┴─────────────┤
│ BottomDock (Console | Logic Preview | …)                     │
├──────────────────────────────────────────────────────────────┤
│ StatusBar — zoom, grid, runtime, UI 100%                     │
└──────────────────────────────────────────────────────────────┘
```

Logic Board: user switches to **Logic Board** tab → full workspace `LogicBoardPanel` (unchanged).

### 6.2 `compact` tier (D6, D2, D10, D11)

```
┌──────────────────────────────────────────────────────────────┐
│ MenuBar (compact toolbar — overflow "…" when needed)         │
│ [▣] [⚡] [</>]  ← ModuleTabs icon-only + tooltip              │
├──────────┬───────────────────────────────────────────────────┤
│ [Project]│                                                   │
│ [Assets] │         PreviewPanel                              │
│ [Objects]│         Inspector = overlay drawer (right) →      │
│ ~200px   │                                                   │
├──────────┴───────────────────────────────────────────────────┤
│ BottomDock COLLAPSED — tap/sheet expands upward              │
├──────────────────────────────────────────────────────────────┤
│ StatusBar — UI 85% (example)                                 │
└──────────────────────────────────────────────────────────────┘
```

- **Inspector drawer**: opens via selection, inspector toggle, or shortcut; closes manually or Escape; width 280px default; does not shrink canvas below min when open (overlay, not reflow).
- **Logic Board**: only via ⚡ tab (full screen).
- **Dock**: collapsed state persisted in layout bucket (D9, D10).

### 6.3 `minimal` tier

```
┌──────────────────────────────────────────────────────────────┐
│ Essential toolbar: Play/Stop | Select | Zoom | ☰ | Exit Focus│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    PreviewPanel (~max area)                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ StatusBar (minimal)                                          │
└──────────────────────────────────────────────────────────────┘
```

Panels: VIEW menu + hamburger + shortcuts (`Ctrl+1` left, `Ctrl+2` inspector, etc. — define in Phase 4.2).

**Focus mode** (Phase 2) is similar visually; Focus is user-toggled at any tier; `minimal` is automatic by size.

### 6.4 Logic Board module (all tiers)

When `state.mode === 'logic'`:

| Tier | Behavior |
|------|----------|
| `full` | Current `LogicBoardPanel` layout |
| `compact` | Collapsible events sidebar; graph prioritized |
| `minimal` | Graph full width; events via drawer |

---

## 7. Global rules (all phases)

Apply to every PR touching editor chrome.

### 7.1 Text and legibility

- Minimum rendered editor font: **11px** after `--editor-scale` applied.
- Truncate long names with **middle ellipsis** (`foo…bar`), not end-only.
- Numeric inputs: never truncate values; field grows or uses compact notation.
- Panel titles: slightly larger than body text.

### 7.2 Icons and buttons

- Minimum hit target: **24×24px** after scale.
- Toolbar at 85% scale: icon-only + tooltip (compact tier always icon-only per D11).
- Disabled controls: 40% opacity, still visible.
- Toolbar overflow: `…` menu — never silently hide tools.

### 7.3 Dialogs and popups

- Max width 90% of workspace; max height 85%.
- Internal scroll if content overflows.
- Center relative to **editor window**, not screen.
- Tooltips and menus flip to stay inside workspace bounds.

### 7.4 Canvas (game area)

- Canvas minimum: **400×300 px** in workspace — panels shrink first.
- **Editor zoom** (canvas) ≠ **UI scale** — independent systems.
- Rulers/guides follow canvas zoom and scroll, not `--editor-scale`. Tick labels use absolute world coordinates; origin aligns with the scene frame top-left (padding `EDITOR_CANVAS_PADDING_PX`).

### 7.5 Animation

| Interaction | Duration | Easing | Notes |
|-------------|----------|--------|-------|
| Focus enter/exit | 180ms | ease-in-out | Side panels slide; input disabled during transition |
| Tier change | 300ms | ease-in-out | Optional VIEW → “Reduce motion” disables all |
| Dock bottom-sheet | 200ms | ease-out | Compact tier |

---

## 8. Phase specifications

### Phase 1 — Global UI scale

**Goal**: Immediate density fix at 1366×768 without restructuring layout.

#### 1.1 CSS contract

Add to `:root` / `.editor-shell` in `editor/src/index.css`:

```css
.editor-shell {
  --editor-scale: 1; /* 0.75 | 0.85 | 0.9 | 1 | 1.15 | 1.25 */
  font-size: calc(12px * var(--editor-scale));
}
```

- Migrate editor chrome spacing to `rem` or `calc(Npx * var(--editor-scale))` incrementally; priority: MenuBar, sidebars, inspector, dock, StatusBar, dialogs.
- **Exclude** `.editor-workspace` game preview subtree from font-size inheritance if needed — wrap PreviewPanel root with `font-size: 12px` reset or isolate under non-scaled container.

#### 1.2 Allowed scale values

| Scale | Use case |
|-------|----------|
| 75% | Emergency density |
| 85% | Recommended 1366×768 |
| 90% | 1600×900 band |
| 100% | Default 1080p |
| 115% | 1440p+ HiDPI |
| 125% | 4K / accessibility |

#### 1.3 Silent auto-detect (D8)

On first run (no `artcade.editor-ui-scale-v1` in `localStorage`), set scale from workspace size at boot:

| Workspace size | Auto scale |
|----------------|------------|
| Width < 1280 or height < 720 | 75% + tier will flag unsupported/minimal |
| 1280–1365 × 680–767 | 75% |
| 1366–1599 × 768–899 | **85%** |
| 1600–1919 × 900–1079 | 90% |
| 1920–2559 × 1080–1439 | 100% |
| ≥ 2560 × ≥ 1440 | 115% |

Implement: `editor/src/utils/editor-ui-scale.ts` + `useEditorUiScale` hook.

#### 1.4 VIEW menu (D5)

Extend `ViewToolbarMenu.tsx`:

```
VIEW
  …
  Interface ─────────────────
    UI Scale ►  75% | 85% | 90% | 100% | 115% | 125%
    Reset UI Scale to 100%
  …
```

#### 1.5 Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+=` | Increase scale step |
| `Ctrl+-` | Decrease scale step |
| `Ctrl+0` | Reset to 100% |

Wire in `useEditorShortcuts` or dedicated hook; do not conflict with canvas zoom shortcuts.

#### 1.6 StatusBar

Display `UI 85%` (or current %) in `StatusBar.tsx` — read-only indicator (no popover required in v1).

#### 1.7 Banner (D3)

- Change `MIN_WIDTH` in `EditorViewportBanner.tsx` from `1520` to `1280`.
- Prefer workspace width when hook available (Phase 4); interim `innerWidth` acceptable in 1.7.

#### 1.8 Phase 1 completion criteria

- [ ] All six scale steps apply instantly without restart
- [ ] PreviewPanel / WASM unchanged at any scale
- [ ] Value persisted in `artcade.editor-ui-scale-v1`
- [ ] Auto-detect runs once when key missing
- [ ] No regression at 1920×1080 @ 100%
- [ ] Modals fit viewport at 75% scale

#### 1.9 Phase 1 files (expected touch)

| File | Change |
|------|--------|
| `editor/src/index.css` | `--editor-scale`, rem migration (incremental) |
| `editor/src/utils/editor-ui-scale.ts` | New |
| `editor/src/hooks/useEditorUiScale.ts` | New |
| `editor/src/components/menu-bar/ViewToolbarMenu.tsx` | Interface submenu |
| `editor/src/components/StatusBar.tsx` | UI % badge |
| `editor/src/components/shell/EditorViewportBanner.tsx` | 1280 threshold |
| `editor/src/App.tsx` | Bind scale class on `.editor-shell` |

---

### Phase 2 — Focus mode

**Goal**: User-controlled maximum canvas area (D7).

#### 2.1 States

| State | Visible |
|-------|---------|
| `normal` | Active layout tier shell |
| `focus` | Canvas + reduced toolbar + StatusBar (minimal) |

**Not in v1**: `focus+inspector` combined state (rejected auto-inspector behavior).

#### 2.2 Reduced toolbar contents

| Control | Required |
|---------|----------|
| Play / Stop / Pause | Yes |
| Simulation speed | Yes |
| Mouse coordinates on canvas | Yes |
| Canvas zoom | Yes |
| Exit Focus | Yes |
| Expand / F11 hint | Yes |

#### 2.3 Activation

| Input | Action |
|-------|--------|
| `F11` | Toggle focus |
| Toolbar “expand” icon on canvas chrome | Toggle focus |
| Optional later: double-click canvas tab | Toggle (if not conflicting) |

**Exit**: F11, Exit Focus button only — **not** on entity select.

#### 2.4 Animation (§7.5)

180ms slide; `pointer-events: none` on workspace during transition.

#### 2.5 VIEW menu

```
Interface
  Focus Mode          (toggle, checked when active)
  Reduce Motion       (disables tier/focus animations)
```

#### 2.6 Store

Add UI flags to editor store (e.g. `focusMode: boolean`, `reduceMotion: boolean`) via `ui-reducer.ts` — persist `reduceMotion` in `artcade.editor-preferences-v1` if desired; `focusMode` is **session-only** (not persisted).

#### 2.7 Phase 2 completion criteria

- [ ] F11 works from canvas mode
- [ ] No side panels or bottom dock visible in focus
- [ ] WASM preview still runs play/stop
- [ ] Reduce motion skips CSS transitions
- [ ] No auto-exit on selection

#### 2.8 Phase 2 files

| File | Change |
|------|--------|
| `editor/src/store/reducers/ui-reducer.ts` | focusMode, reduceMotion |
| `editor/src/App.tsx` or `EditorLayout` | Conditional chrome |
| `editor/src/panels/PreviewPanel.tsx` | Focus toolbar variant |
| `editor/src/hooks/useFocusModeShortcut.ts` | New |
| `ViewToolbarMenu.tsx` | Focus + Reduce motion |

---

### Phase 3 — Resizable panels + exact-resolution persistence

**Goal**: User sizing with snap, debounced save per `WxH` bucket (D9).

#### 3.1 Replace / extend persistence

New module: `editor/src/utils/editor-layout-persist.ts`

```ts
export type EditorLayoutSnapshot = {
  leftW: number
  rightW: number
  dockH: number
  dockCollapsed: boolean
  leftTab?: 'project' | 'assets' | 'objects'  // compact tier
  dockVisibility?: DockPanelVisibility
}

export function layoutStorageKey(width: number, height: number): string {
  return `artcade.layout-v2::${width}x${height}`
}
```

Debounce writes **500ms** after last drag.

#### 3.2 Panel limits

| Panel | Min | Default (`full`) | Max | Snap widths |
|-------|-----|------------------|-----|-------------|
| Left | 150 | 280 | 400 | 180, 240, 300, 360 |
| Right (inspector column `full` only) | 180 | 320 | 450 | same |
| Bottom dock | 120 content + chrome | 280 | min(60% workspace height, cap) | — |
| Canvas | 400 × 300 | remaining | — | hard floor |

Double-click resize handle → restore defaults for current tier.

#### 3.3 Hook migration

Evolve `usePersistedWidth` → `usePersistedLayout(bucket)` returning full snapshot.

#### 3.4 VIEW menu

```
Interface
  Reset Layout for Current Resolution
```

Clears only `artcade.layout-v2::<current WxH>`.

#### 3.5 Critical rule

**Never reset layout on editor open** unless user explicitly resets or bucket key is missing (then use tier defaults).

#### 3.6 Phase 3 completion criteria

- [ ] Drag resize with 6px hit zone, correct cursors
- [ ] Snap feedback at preset widths
- [ ] Separate saved layouts for 1366×768 vs 1920×1080 on same machine
- [ ] Double-click reset works per panel
- [ ] Canvas never below 400×300

#### 3.7 Phase 3 files

| File | Change |
|------|--------|
| `usePersistedWidth.ts` / new `usePersistedLayout.ts` | Bucket-aware |
| `ResizeHandle.tsx`, `VerticalResizeHandle.tsx` | Snap + double-click |
| `App.tsx` `CanvasView` | Wire snapshot |
| `BottomDock.tsx` | `dockCollapsed` in snapshot |
| `editor-layout-persist.ts` | New |

---

### Phase 4 — Layout tiers (structural shell)

**Goal**: `full` / `compact` / `minimal` / `unsupported` shells (§5–6).

#### 4.1 Sub-phase 4.A — Tier detection

- `useEditorLayoutTier.ts` + `ResizeObserver` on `.editor-workspace`
- Tier change dispatches store action or context; 300ms transition unless reduce motion

#### 4.2 Sub-phase 4.B — `compact` shell

| Component | Work |
|-----------|------|
| `LeftSidebar` | Unified tabs D6 — new `CompactLeftSidebar.tsx` |
| `InspectorPanel` | `InspectorDrawer.tsx` overlay D2 |
| `ModuleTabs` | Icon-only variant D11 |
| `BottomDock` | Default collapsed D10 + sheet UX |
| `MenuBar` | Overflow `…` for crowded tools |

#### 4.3 Sub-phase 4.C — `minimal` shell

- `MinimalShell.tsx` — hamburger, essential toolbar
- Panel shortcuts documented in VIEW menu
- Banner copy per §5.2

#### 4.4 Sub-phase 4.D — `full` parity

- Ensure `full` tier matches pre-adaptive behavior at 100% scale
- Regression pass 1920×1080

#### 4.5 Sub-phase 4.E — Logic Board tier tweaks

- Adjust `LogicBoardPanel` sidebars per §6.4

#### 4.6 Phase 4 completion criteria

- [ ] Live resize across breakpoints without losing project
- [ ] 1366×768 checklist (§11) passes
- [ ] Inspector overlay does not block play controls
- [ ] Module tab tooltips accessible

#### 4.7 Phase 4 files (new / major)

| File | Purpose |
|------|---------|
| `hooks/useEditorLayoutTier.ts` | Tier resolution |
| `components/shell/layout/FullWorkbench.tsx` | Extract from App |
| `components/shell/layout/CompactWorkbench.tsx` | D6–D11 |
| `components/shell/layout/MinimalWorkbench.tsx` | Minimal |
| `components/shell/InspectorDrawer.tsx` | D2 |
| `components/shell/CompactLeftSidebar.tsx` | D6 |
| `App.tsx` | Tier switcher |

---

### Phase 5 — Floating / dockable panels (deferred)

**Prerequisite**: Phase 4 stable in production for at least one release cycle.

Per original doc §7 — **out of v1 scope** except stub in backlog:

- Detach: double-click panel title, drag title out of dock zone
- Reattach: drag to highlight zones
- Multi-monitor: restore position if display still connected; else clamp to primary

**Candidates**: Inspector, Console, Logic Preview — **not** main WASM canvas.

Do not start Phase 5 until Phases 1–4 sign-off.

---

## 9. Persistence and storage keys

| Key | Scope | Content |
|-----|-------|---------|
| `artcade.editor-ui-scale-v1` | User global | `0.75` … `1.25` |
| `artcade.layout-v2::1366x768` | User + exact workspace size | `EditorLayoutSnapshot` JSON |
| `artcade.editor-preferences-v1` | User global | `reduceMotion`, future prefs |
| `artcade.sidebar-left-w-v3` | Legacy | Migrate to v2 bucket on read, then deprecate |
| `artcade.sidebar-right-w-v3` | Legacy |同上 |
| `artcade.bottom-dock-h-v5` | Legacy | Migrate into snapshot |
| `artcade.dock-panels-v1` | User global | Dock tab visibility — may merge into snapshot |

**Not persisted**: canvas zoom, cursor position, selected entity, `focusMode` session flag.

**Not in project file**: never write layout prefs to `.artcade`.

---

## 10. Implementation roadmap

| Phase | Delivers | Depends on | Est. risk |
|-------|----------|------------|-----------|
| **1** | UI scale, banner 1280, VIEW, StatusBar | — | Low |
| **2** | Focus mode F11 | — | Low |
| **3** | Resize + `layout-v2::WxH` | Phase 1 stable (scale affects px read) | Medium |
| **4** | Tier shells compact/minimal | Phase 3 | High |
| **5** | Floating panels | Phase 4 | High |

**Parallelism**: Phase 1 and 2 may run in parallel. Phase 3 starts after Phase 1 merge. Phase 4 never starts before Phase 3 completion criteria.

**Documentation**: Update this file’s checklist sections when sub-phases complete.

---

## 11. Test matrix

### 11.1 Per resolution smoke

| Resolution | UI scale | Tests |
|------------|----------|-------|
| 1366×768 | 85% auto | §11.2 compact checklist |
| 1280×720 | 75% | Minimal/compact border; banner visible |
| 1920×1080 | 100% | No layout regression; separate bucket from 768 |
| 2560×1440 | 115% auto | Fonts sharp; icons not blurry |

### 11.2 Compact checklist (from product doc)

- [ ] All panels reachable without horizontal scroll
- [ ] Toolbar uses overflow, not overlap
- [ ] Canvas ≥ 400px wide
- [ ] Logic Board tab usable
- [ ] Dialogs fit in window at 75% UI scale
- [ ] Tooltips stay inside window
- [ ] StatusBar visible including UI %
- [ ] Layout persists after restart (same `WxH`)

### 11.3 Edge cases

| Case | Expected |
|------|----------|
| Resize window across tier mid-session | Tier animates; project stays open |
| Change UI scale with dialog open | Dialog reflows immediately |
| Panel drag below minimum | Clamps to min |
| Monitor DPI change | Bucket by workspace px; Tauri may report CSS px — document in PR if diverges |
| Two editor windows different sizes | Independent buckets per window instance (each writes its own `WxH` key on close) |

### 11.4 Automated tests

- `resolveLayoutTier()` unit tests — all boundary values §5.1
- `editor-ui-scale.ts` auto-detect boundaries
- `layoutStorageKey()` format
- Optional: Playwright viewport snapshots at 1366×768 and 1920×1080 (future)

Run before each phase merge: `cd editor; npm test -- --run`

---

## 12. Explicit non-goals

The following are **not** part of v1 adaptive layout:

| Item | Notes |
|------|-------|
| Logic Board strip under canvas | D1 rejected |
| Editor Settings dialog | D5 — VIEW only |
| `transform: scale()` UI | D4 rejected |
| Auto-exit Focus on select | D7 rejected |
| Cloud sync of layout prefs | Local only |
| Scaling game preview resolution | Game uses project scene settings |
| Tier-only layout buckets without `WxH` | D9 rejected |
| Phase 5 floating windows | Deferred |

---

## Appendix A — VIEW menu target structure (v1 complete)

```
VIEW
  Theme Toggle (existing)
  ─────────────────────
  Interface
    UI Scale ►
      75%
      85%
      90%
      100%  ✓
      115%
      125%
    Reset UI Scale (100%)
    ─────────────────
    Focus Mode          [toggle]
    Reduce Motion       [toggle]
    ─────────────────
    Reset Layout for Current Resolution
  ─────────────────────
  (existing view items…)
```

---

## Appendix B — Shortcut summary

| Shortcut | Phase | Action |
|----------|-------|--------|
| `Ctrl+Shift+=` | 1 | Increase UI scale (canvas mode reserves Ctrl+= for zoom) |
| `Ctrl+Shift+-` | 1 | Decrease UI scale |
| `Ctrl+Shift+0` | 1 | UI scale 100% |
| `F11` | 2 | Toggle Focus mode |
| `Ctrl+1` | 4 | Toggle left panel (minimal) — TBD |
| `Ctrl+2` | 4 | Toggle inspector drawer — TBD |

---

## Appendix C — Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-06-02 | Phases 1–4 implemented; UI scale shortcuts use Ctrl+Shift (canvas zoom keeps Ctrl+=) |
| 1.0 | 2026-06-02 | Initial spec from planning session; all D1–D11 locked |

---

*End of document — implement phases in §10 order; update checkboxes in §8 when sub-phases ship.*

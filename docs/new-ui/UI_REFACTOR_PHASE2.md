# UI Refactor — Fase 2 (2026)

Workbench alignment with [`New_UI_canvas.png`](../assets/new-ui/New_UI_canvas.png) and [`LOGIC_BOARD_UI_SPEC.md`](LOGIC_BOARD_UI_SPEC.md).

## Layout (implemented)

| Region | Target | Implementation |
|--------|--------|----------------|
| Top chrome | 96px (menu + module tabs) | `.editor-top-chrome` in [`editor/src/index.css`](../../editor/src/index.css), wrapper in [`App.tsx`](../../editor/src/App.tsx) |
| Left column | 280px default | `--editor-left-w-default`, [`usePersistedWidth`](../../editor/src/hooks/usePersistedWidth.ts) |
| Right inspector | 320px default | `--editor-right-w-default` |
| Bottom dock | 280px open default | `--editor-dock-h-default`, `bottomPanelCollapsed: false` at boot |
| Narrow window hint | Non-layout | [`EditorViewportBanner`](../../editor/src/components/shell/EditorViewportBanner.tsx) overlays top chrome |

Constants mirror CSS: [`editor/src/constants/editor-layout.ts`](../../editor/src/constants/editor-layout.ts).

## Camera frame

- New projects: world **1280×640**, viewport **512×320** (`DEFAULT_VIEWPORT_SIZE`).
- Edit mode: dashed DOM overlay [`CameraFrameOverlay`](../../editor/src/panels/preview/CameraFrameOverlay.tsx) when viewport &lt; world.
- Camera preview clip toggle unchanged (`cameraPreview`).

## Bottom dock

Panels (fixed order): Debug Console · Animation Timeline · Logic Board Preview · Event Debugger.

Boot: dock expanded ~280px; `LOAD_PROJECT` no longer forces collapse. Default visibility: Console + Logic Preview (`artcade.dock-panels-v1`). Per-panel toggles: **VIEW → Bottom panels** ([`DockPanelsViewSection`](../../editor/src/components/menu-bar/DockPanelsViewSection.tsx)).

## Contextual inspector

| Mode | Trigger |
|------|---------|
| Scene Settings | Default / no entity, asset, or layer |
| Entity Inspector | `selection.entityId` |
| Asset Inspector | `SELECT_INSPECTOR_ASSET` from Project Explorer |
| Layer Settings | Layer row in Scene Layers panel (stub) |

Logic block editing remains on Logic Board (`LogicInspectorPanel`).

## Design tokens (Fase 2)

`.editor-input`, `.editor-panel-header`, `.editor-checkbox`, `.editor-dock-body` in `index.css`; inspector fields and dock bodies consume them.

## Phase 2b — Mockup chrome (UI-only)

- Bottom dock: **4 columns** visible at once (Console compact, Timeline filmstrip, Logic graph + list, Event table).
- Canvas: **rulers** (world px, scroll-synced; camera preview shows absolute world coords), **footer** (Grid / Snap), **Active layer** in toolbar.
- Inspector: **Variable Watch** stub, **Layer** dropdown on entity.
- Menu: **HELP**, project **version** next to name.

## Smoke checklist

- [ ] Blank project: dashed 512×320 frame centered in 1280×640 grid
- [ ] Bottom dock open ~280px on launch; resize 260–300 feels readable
- [ ] Top chrome measures 96px; module tabs visible
- [ ] Select asset → right panel shows Asset Inspector
- [ ] Select layer row → Layer Settings stub
- [ ] Select entity → Entity Inspector
- [ ] Ctrl+8 camera preview clip still works
- [ ] `npm test -- --run` green

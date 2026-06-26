# ArtCade — Presentation Architecture (ADR)

> **Status:** Accepted (target architecture)  
> **Date:** 2026-06-24  
> **Replaces:** ad-hoc fit/scroll/camera logic distributed across React, `Renderer`, and `editor-api`  
> **Related:** [`NORTH_STAR_ARCHITECTURE.md`](NORTH_STAR_ARCHITECTURE.md) §9, [`TECHNICAL_DEBT_REVIEW.md`](TECHNICAL_DEBT_REVIEW.md) §6

---

## Decision

ArtCade adopts a **Shared Presentation Core** independent of the renderer, runtime, and frontend, accompanied by an **explicit-pass render pipeline**.

- **React** sends only surface metrics, input events, and navigation intents.
- **Presentation Core** owns output policies, coordinate-space transforms, editor-view pan/zoom, and produces an **immutable, versioned `PresentationSnapshot`** per committed frame.
- **Renderer**, **Compositor**, **picking**, and **overlays** consume the **same committed snapshot** for that frame.
- **Runtime** owns simulation and `GameCameraState`; **Editor** owns `EditorViewState` and tools; **Scene / SpatialQuery** owns world queries and entity selection.
- **No consumer** may independently recalculate fit, letterboxing, or surface↔world transforms.

---

## Problem (current repository)

Viewport, fit, letterboxing, pan, zoom, and picking are split across competing authorities:

| Location | What it decides today |
|----------|----------------------|
| `canvas-viewport-layout.ts` | Scroll centring, scroll↔world |
| `runtime-canvas-presentation.ts` | Play CSS fit scale |
| `editor-zoom.ts` | Editor fit zoom |
| `Renderer::updateCameraProjection()` | Fit, letterbox offset, play compositor |
| `Renderer::setEditorCamera` + `editorCameraActive` | Edit camera vs projection fight |
| `Renderer::screenToWorld` | Picking transform |
| `CameraManager::screenToWorld` | Second transform path (shake) |
| DOM scroll (`scrollLeft` / `scrollTop`) | Simulated world navigation |

This produces drift: grid misalignment, off-centre scenes after aspect-ratio changes, picking vs render mismatch, and WASM/native divergence.

**Goal:** eliminate concurrent authorities on view transforms — not merely move them from TypeScript into `renderer.cpp`.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                       React Editor                          │
│  PreviewPanel · Rulers · Toolbar · Overlay UI · Input      │
│       │         ▲                         │                 │
│       │ intents │ PresentationSnapshot    │ DOM events      │
└───────┼─────────┼─────────────────────────┼─────────────────┘
        │         │                         │
        ▼         │                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  C++ Presentation Core                      │
│  ViewController · CoordinateMapper · OutputPolicy           │
│  produces PresentationSnapshot (committed per frame)        │
└─────────────────────────────┬─────────────────────────────────┘
                            │ immutable snapshot
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              PipelineBuilder → RenderPipeline               │
│  ScenePass → GameView RT → BlitPass → Backbuffer            │
│              (+ Grid / Gizmo / Debug overlay passes)        │
└─────────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                   Native / WASM backend
```

**Key rule:** Presentation describes *what* the view is; Renderer decides *how* to draw; Compositor combines RTs. Presentation does **not** emit draw calls or pass execution plans inside the snapshot.

---

## Coordinate spaces

All transforms must name their space explicitly. Do not overload “screen”.

| Space | Description |
|-------|-------------|
| **DOM client** | Browser layout coordinates (pre-DPR) |
| **CSS pixel** | Canvas element size in CSS px |
| **Framebuffer** | GPU backbuffer pixels (`round(cssSize × devicePixelRatio)`) |
| **Presentation** | Rectangle and scale after output policy (letterbox, integer fit) |
| **Logical viewport** | Game lens resolution (`SceneDef.viewportSize`) |
| **World** | Authoring / simulation space (top-left origin, Y-down) |

**Mapping chain:**

```
DOM / CSS surface
      ↓ devicePixelRatio
Framebuffer surface
      ↓ presentation transform (policy)
Logical viewport
      ↓ camera (editor or game)
World
```

### Semantic point types (non-interchangeable)

Even when stored as `Vector2`, use distinct types in Presentation Core:

```cpp
struct SurfacePoint   { double x, y; };
struct LogicalPoint   { double x, y; };
struct WorldPointD    { double x, y; };  // double in core; float at draw boundary
```

Presentation Core uses **double** for pan, zoom accumulation, rulers, and picking at large world coordinates. Conversion to `float` happens when preparing draw commands.

---

## Camera model

### Three layers for game camera

```cpp
struct GameCameraState {
    Vector2 position;
    float zoom;
    float rotation;
};

struct CameraModifiers {
    Vector2 translationOffset;  // shake, recoil, cinematic
    float zoomMultiplier;
    float rotationOffset;
};

struct EffectiveGameCamera {
    Vector2 position;
    float zoom;
    float rotation;
};

EffectiveGameCamera composeCamera(
    const GameCameraState& base,
    const CameraModifiers& modifiers);
```

- **Runtime** owns `GameCameraState` and simulation-driven updates.
- **CameraManager** produces **modifiers** (e.g. shake), not surface transforms.
- **Presentation** consumes `EffectiveGameCamera` (or `EditorCamera`) when building the snapshot.

### Editor camera (separate)

```cpp
struct EditorCamera {
    Vector2 position;
    float rotation;
    float zoom;
};
```

**Do not** reuse one mutable camera struct for editor and game. Presentation selects the active camera by `PresentationMode`.

### `CameraManager::screenToWorld` — remove

CameraManager must not know the surface. All surface↔world math lives in Presentation Core.

---

## Presentation modes

```cpp
enum class PresentationMode {
    SceneEdit,        // full world, EditorCamera
    CameraPreview,    // GameCamera, simulation may be frozen
    PlayEmbedded,     // GameCamera, runtime active (editor docked play)
    PlayExternal,     // separate Tauri / browser window
    PlayFullscreen,
};
```

| Mode | Camera | GameView RT | Output policy |
|------|--------|-------------|---------------|
| SceneEdit | Editor | Optional / direct to surface | N/A (1:1 world slice) |
| CameraPreview | Game (effective) | Yes | Optional WYSIWYG preview |
| PlayEmbedded | Game (effective) | Yes | `world.outputPolicy` |
| PlayExternal / Fullscreen | Game (effective) | Yes | `world.outputPolicy` |

---

## State vs snapshot

### Mutable state (input to solver)

```cpp
struct PresentationState {
    PresentationMode mode;
    OutputPolicy outputPolicy;

    SurfaceMetrics surface;   // cssSize, framebufferSize, devicePixelRatio
    Size2D logicalSize;       // game viewport (from scene)

    EditorViewState editorView;
    GameViewState gameView;   // references GameCameraState + modifiers source
};
```

### Immutable snapshot (per committed frame)

```cpp
struct PresentationSnapshot {
    uint64_t revision;

    PresentationMode effectiveMode;

    Size2D gameViewLogicalSize;
    Rectangle surfaceRect;
    Rectangle gameViewDestOnSurface;
    Rectangle clipRect;

    Matrix3 worldToLogical;
    Matrix3 logicalToSurface;
    Matrix3 worldToSurface;

    Matrix3 surfaceToLogical;
    Matrix3 logicalToWorld;
    Matrix3 surfaceToWorld;

    float presentationScale;
    bool letterboxActive;
    TextureFilter presentFilter;  // e.g. nearest for pixel art
};
```

**Snapshot does NOT contain:**

- `std::vector<PassType>` or compositor execution instructions
- Draw commands or RT handles

Pipeline construction is a separate step:

```cpp
struct ViewRenderFeatures {
    bool drawGrid;
    bool drawGizmos;
    bool drawSelection;
    bool drawPhysicsDebug;
    bool drawCameraFrame;
};

RenderPipeline buildPipeline(
    const PresentationSnapshot& presentation,
    const ViewRenderFeatures& features);
```

---

## Frame atomicity

Presentation must commit **one snapshot per frame** for all C++ consumers.

```cpp
class PresentationSystem {
    PresentationSnapshot committedSnapshot_;

public:
    void beginFrame();  // committedSnapshot_ = calculateSnapshot(currentState_);

    const PresentationSnapshot& committedSnapshot() const;
};
```

**Rule:** rendering, picking, and C++ overlays for frame *N* all use `committedSnapshot()` for revision *Rₙ*. No consumer reads a “latest available” snapshot mid-frame.

React receives `PresentationChangedEvent` after commit:

```cpp
struct PresentationChangedEvent {
    uint64_t revision;
    PresentationSnapshot snapshot;
};
```

React stores the last event in a shared store; rulers, camera frame overlay, zoom label, and mouse readouts use **the same revision**.

### Input events carry origin space and revision

```cpp
struct SurfacePointerEvent {
    PointerId id;
    PointerDevice device;

    SurfacePoint position;   // CSS surface space — converted to framebuffer inside core
    SurfaceDelta delta;

    ButtonMask buttons;
    ModifierMask modifiers;

    uint64_t presentationRevision;  // revision when browser captured the event
};
```

Core may:

- apply the matching snapshot if still in a short history (2–3 revisions), or
- map with the latest committed snapshot, or
- drop incompatible events during radical surface resize.

---

## Surface resize (single API)

**Only** entry point for panel/window sizing:

```cpp
void resizeSurface(Size2D cssSize, float devicePixelRatio);
```

Internal:

```cpp
struct SurfaceMetrics {
    Size2D cssSize;
    Size2D framebufferSize;
    float devicePixelRatio;
};
// framebufferSize = round(cssSize * devicePixelRatio)
```

**Deprecate** passing `cssW * dpr` separately in `editor_set_edit_camera`.

DOM events arrive in CSS pixels; rendering uses framebuffer pixels.

---

## ViewController (intents, not ad-hoc IPC)

React / bindings forward normalized pointer events; ViewController handles semantics:

```cpp
viewController.beginPan(surfacePoint);
viewController.updatePan(surfacePoint);
viewController.endPan();

viewController.zoomAt(surfacePoint, zoomDelta);  // cursor-anchored
viewController.frameWorldBounds(bounds);
viewController.resetView();
```

**Zoom-at-cursor** (lives in ViewController, not React):

```
WorldPoint before = snapshot.surfaceToWorld(cursor);
view.zoom *= zoomFactor;
WorldPoint after  = recalculate(view).surfaceToWorld(cursor);
view.position += before - after;
```

---

## Picking

```cpp
WorldPointD world = presentation.committedSnapshot().surfaceToWorld(surfacePoint);
PickResult result = spatialQuery.pick(world, pickOptions);
```

Presentation maps coordinates only. Scene / `EditorInputController` / spatial query owns hit testing.

---

## React integration

### React owns (browser integration)

- Pointer capture, wheel + modifiers, preventDefault
- Panel resize → `resizeSurface`
- `devicePixelRatio` updates
- Focus / blur
- Publishing intents to ViewController

### React does NOT own

- Fit, letterbox, crop, stretch math
- `scrollLeft` / `scrollTop` as world coordinates
- Per-component WASM polling of layout

### Overlay strategy

| Overlay | Layer |
|---------|--------|
| Grid, gizmos, selection outlines, collision debug, in-scene camera frame | C++ passes |
| Rulers, zoom %, toolbar, badges, context menus | React (reads snapshot only) |

Rulers use **derived fields** from snapshot when possible; full matrices for advanced overlays.

### TypeScript snapshot contract (WASM ABI)

Document in bindings:

- Matrix layout: row-major, column vectors (or chosen convention — **one**)
- Y-down, origin top-left of surface
- Units: CSS vs framebuffer labelled per field

```ts
type PresentationSnapshot = {
  revision: number

  contentRect: Rect
  visibleWorldBounds: Bounds

  worldOriginOnSurface: Point
  surfacePixelsPerWorldUnit: number

  worldToSurface: Matrix3
  surfaceToWorld: Matrix3
}
```

Simple UI uses derived fields; matrices reserved for complex overlays.

### Scrollbars

Initial navigation: middle-mouse pan, space+drag, wheel zoom, **F** frame selection, **Home** frame world, reset view. Optional fake scrollbars later map to **editor camera**, not DOM world size.

---

## Render targets (naming)

- **GameView RT** — logical viewport resolution (`viewportSize`). Used in play and camera preview.
- **Scene view** — in SceneEdit, render world slice via **EditorCamera** directly; **do not** allocate an RT the size of the entire world.

Avoid `World RT` meaning `worldSize × worldSize` — unbounded for large levels.

---

## Module layout (target)

```
runtime-cpp/src/
├── presentation/           # NO dependency on renderer, runtime, editor, Raylib
│   ├── presentation_state.hpp
│   ├── presentation_snapshot.hpp
│   ├── presentation_system.cpp
│   ├── coordinate_mapper.cpp
│   ├── output_policy.cpp
│   └── view_controller.cpp
│
├── modules/renderer/       # consumes PresentationSnapshot only
│   ├── compositor.cpp      # executes BlitPass; does not compute fit
│   └── passes/
│       ├── scene_pass.cpp
│       ├── blit_pass.cpp
│       ├── grid_pass.cpp
│       └── gizmo_pass.cpp
│
├── scene/ or spatial-query/
│   └── picking.cpp         # world coordinates in
│
├── modules/runtime/        # simulation, GameCameraState
│
├── modules/editor-api/     # EditorViewportApi façade
│   └── presentation_bindings.cpp
```

### Allowed dependencies

| Module | May depend on | Must not |
|--------|---------------|----------|
| `presentation/` | std, core types | renderer, runtime, editor, Raylib |
| `rendering/` | presentation snapshot | mutating PresentationState |
| `runtime/` | presentation (read), game camera state | surface control |
| `editor/` | presentation (intents), editor tools | fit math |
| `scene/` | world types | surface transforms |
| `bindings/` | presentation, editor façade | direct Renderer exposure |
| React | events, snapshot store | fit / world transforms |

**Hard rules:**

1. `renderer.cpp` **must not** mutate `PresentationState`.
2. Presentation Core **must not** emit draw calls.

---

## Migration map (from current code)

| Current | Target |
|---------|--------|
| `compositor-layout.*` in `modules/renderer/` | `presentation/output_policy.cpp` |
| `Renderer::updateCameraProjection` view math | `presentation/coordinate_mapper` |
| `editorCameraActive` flag | `PresentationMode` + committed snapshot |
| `Renderer::screenToWorld` | `PresentationSnapshot::surfaceToWorld` |
| `CameraManager::screenToWorld` | **remove** |
| `editor_set_edit_camera` | `resizeSurface` + ViewController intents |
| `canvas-viewport-layout.ts` fit/scroll truth | deprecated; snapshot store |
| `playFitScale` | remove (policy in Presentation) |
| DOM scroll spacer | remove (Phase 6) |
| `editor-input-controller` pick path | `surfaceToWorld` from snapshot |

Temporary adapters may delegate old APIs to Presentation with `[[deprecated]]` and a removal phase.

---

## Deprecated API list (end state)

| API | Action |
|-----|--------|
| `Renderer::screenToWorld` | REMOVE |
| `CameraManager::screenToWorld` | REMOVE |
| `Renderer::updateCameraProjection` (view policy) | INTERNAL / REMOVE |
| `editor_set_edit_camera` | REPLACE |
| `canvas-viewport-layout.ts` fit calculations | REMOVE as source of truth |
| `playFitScale` | REMOVE |
| DOM scroll position as world state | REMOVE |
| `editorCameraActive` in Renderer | REMOVE |

---

## Migration phases

| Phase | Scope | Visual behaviour |
|-------|--------|------------------|
| **1** | Extract presentation math + golden tests (policy, fit, letterbox, mapper, DPI) | Unchanged |
| **2** | Versioned atomic snapshot; Renderer + picking consume committed snapshot | Unchanged |
| **3** | Separate `EditorCamera` / `GameCamera`; explicit modes; remove `editorCameraActive` | Unchanged |
| **4** | Picking on Presentation only; remove duplicate `screenToWorld` | Unchanged |
| **5** | React snapshot store via `RuntimeSyncService` / `PresentationChangedEvent` | TS layout demoted |
| **6** | Remove DOM scroll spacer; canvas = fixed surface; pan/zoom as intents | UX shift (no scroll world) |
| **7** | Explicit passes: Scene, GameView, Blit, Grid, Gizmo, Debug | Structural |
| **8** | Same snapshot/policy for embedded play, external window, fullscreen, native exe | Parity |
| **9** | Generic render graph | **Only when needed** (split screen, minimap, post FX, multi-view) |

Phases **1 + 2** should land together where possible (math without snapshot does not stop drift).

Phase **3** (dual camera) before relying on GameView RT refactors (Phase 7/8).

---

## Required tests

Mathematical golden tests (C++; TS mirror optional for bindings):

1. **Round-trip:** `surfaceToWorld(worldToSurface(p)) ≈ p`
2. **Letterbox:** viewport 320×240, surface 1920×1080, integer fit 4× → content 1280×960, offset (320, 60)
3. **High DPI:** CSS 800×600, DPR 1.5 → framebuffer 1200×900
4. **Zoom-at-cursor:** world point under cursor invariant across zoom
5. **Resize:** editor camera world position unchanged on panel resize (unless explicit policy)
6. **Picking edge:** inside viewport, on letterbox, borders, negative coords, non-integer zoom
7. **Native / WASM parity:** same inputs → equivalent snapshot within epsilon

---

## Integer vs smooth scaling

- **Integer fit** — pixel art, play, export (`floor` scale when ≥ 1)
- **Smooth fit** — editor navigation zoom

Encode explicitly in `OutputPolicy` / mode; do not hide `floor(scale)` only inside Fit path.

---

## EditorViewportApi (WASM / native façade)

React talks to a narrow façade, not `Renderer`:

```cpp
class EditorViewportApi {
public:
    void resizeSurface(Size2D cssSize, float devicePixelRatio);
    void submitPointerEvent(const SurfacePointerEvent& event);
    void setMode(PresentationMode mode);
    const PresentationSnapshot& committedSnapshot() const;
};
```

---

## Success criteria

- [x] Zero fit/letterbox math in `editor/src` (except snapshot consumption)
- [x] `Renderer` has no `editorCameraActive` or view-policy branches
- [x] One `screenToWorld` path: `PresentationSnapshot`
- [x] React rulers and camera overlay read one store revision
- [ ] Play embedded, external window, and native exe share `buildPipeline(snapshot, features)`
- [x] Golden tests cover all output policies and DPR ≠ 1

---

## Related documents

| Doc | Topic |
|-----|--------|
| [`NORTH_STAR_ARCHITECTURE.md`](NORTH_STAR_ARCHITECTURE.md) §9 | Camera & output policy (product) |
| [`TECHNICAL_DEBT_REVIEW.md`](TECHNICAL_DEBT_REVIEW.md) §6 | Renderer policy debt |
| [`REACT_WASM_PATTERN.md`](REACT_WASM_PATTERN.md) | Editor ↔ WASM boundaries |

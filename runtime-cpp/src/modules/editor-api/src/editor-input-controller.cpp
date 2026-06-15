#include "editor-input-controller.h"

#ifdef __EMSCRIPTEN__

#include "../include/editor-api.h"
#include "../../../app/render/ray-tint-widget.h"
#include "pointer-coords.h"
#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/renderer/include/renderer.h"
#include "../../../core/types.h"

#include <emscripten.h>
#include <emscripten/html5.h>

#include <cmath>
#include <string>

namespace ArtCade {

namespace {

/** Mirrors editor/src/utils/entity-position.ts snapToGridValue (authoring only). */
void snapWorldToEditorGrid(float& wx, float& wy) {
    if (!EditorAPI::s_editorSnapEnabled || EditorAPI::s_editorGridSize <= 0.f)
        return;
    const float cs = EditorAPI::s_editorGridSize;
    wx = std::round(wx / cs) * cs;
    wy = std::round(wy / cs) * cs;
}

} // namespace

// Defined here (instead of editor-api.cpp) so the input-related callbacks
// can refer to it without exposing a setter on EditorAPI. The canvas
// selector is set exactly once by initCanvas() at startup.
namespace {
std::string s_canvasSel       = "#canvas";
float       s_lastPanScreenX  = 0.f;
float       s_lastPanScreenY  = 0.f;

enum EditorToolId {
    ToolSelect = 0,
    ToolPan    = 1,
    ToolPaint  = 2,
    ToolErase  = 3,
};

// EmscriptenMouseEvent.targetX/Y are in CSS pixels of the (scaled) canvas
// element, but the world/tilemap is in the canvas' internal resolution
// (e.g. 1280x720). Without this scale the painted cell / dragged entity
// would be offset proportionally to the CSS downscale factor.
void toScreen(const EmscriptenMouseEvent* e, float& sxOut, float& syOut) {
    const Vec2 fb = Modules::pointerCoordsNormalizeToFramebuffer(
        static_cast<float>(e->targetX),
        static_cast<float>(e->targetY));
    sxOut = fb.x;
    syOut = fb.y;
}

void toWorld(const EmscriptenMouseEvent* e, float& wx, float& wy) {
    float screenX = 0.f, screenY = 0.f;
    toScreen(e, screenX, screenY);
    if (EditorAPI::s_renderer) {
        const Vec2 world = EditorAPI::s_renderer->screenToWorld(screenX, screenY);
        wx = world.x;
        wy = world.y;
    } else {
        wx = screenX;
        wy = screenY;
    }
}

// Paint the brush tile into the active scene's tilemap cell under (x,y).
// Assumes canvas==world 1:1 (no pan/zoom — like entity drag).
void paintTileAt(float x, float y) {
    auto* gw = EditorAPI::s_entityGateway;
    if (!gw) return;
    SceneDef* sc = gw->activeSceneMutable();
    if (!sc) return;
    TilemapData& tm = sc->tilemap;
    if (tm.cols <= 0 || tm.rows <= 0 || tm.tileSize <= 0.f) return;
    const int col = static_cast<int>(x / tm.tileSize);
    const int row = static_cast<int>(y / tm.tileSize);
    if (col < 0 || col >= tm.cols || row < 0 || row >= tm.rows) return;
    const int idx = row * tm.cols + col;
    if (idx < 0 || idx >= static_cast<int>(tm.data.size())) return;
    const int tid = EditorAPI::s_selectedTileId;
    if (tm.data[idx] == tid) return; // no-op: already that tile
    tm.data[idx] = tid;
    EditorAPI::notifyTilemapPainted(col, row, tid);
}

// Pick the top-most entity whose clickable box contains the world point.
// Entities are drawn centred on transform.position; we use a generous
// 64px (x scale) hit box so they're easy to grab in the editor viewport.
uint32_t pickEntityAt(float x, float y) {
    auto* gw = EditorAPI::s_entityGateway;
    if (!gw) return 0u;
    uint32_t hit = 0u;
    gw->forEachActiveRenderable([&](EntityId id, const Transform& transform, const SpriteComponent&) {
        float sx = transform.scale.x; if (sx < 0.f) sx = -sx;
        float sy = transform.scale.y; if (sy < 0.f) sy = -sy;
        const float hw = 32.f * (sx > 0.f ? sx : 1.f);
        const float hh = 32.f * (sy > 0.f ? sy : 1.f);
        const float cx = transform.position.x;
        const float cy = transform.position.y;
        if (x >= cx - hw && x <= cx + hw && y >= cy - hh && y <= cy + hh)
            hit = id;
    });
    return hit;
}
} // namespace

// =============================================================================
// EditorAPI native input callbacks (declared in editor-api.h)
// =============================================================================

EM_BOOL EditorAPI::onMouseMove(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    {
        float wx = 0.f, wy = 0.f;
        toWorld(e, wx, wy);
        EditorAPI::notifyCursorWorld(wx, wy);
    }
    float screenX = 0.f, screenY = 0.f;
    toScreen(e, screenX, screenY);
    if (RayTintWidget::isActive()) {
        RayTintWidget::onMouseMove(screenX, screenY);
        return EM_TRUE;
    }
    if (s_editorTool == ToolPan) {
        // Panning is owned by the editor's scroll container (it drives the
        // scrollbars + rulers and pushes the resulting camera target back via
        // editor_set_edit_camera). The runtime must NOT also move its camera,
        // or the two pans compound. Just consume the event.
        return EM_TRUE;
    }
    float wx, wy;
    toWorld(e, wx, wy);
    if (s_tilePaintMode) {
        if (s_isDragging) paintTileAt(wx, wy);
        return EM_TRUE;
    }
    if (s_isDragging && s_selectedEntityId != 0u) {
        snapWorldToEditorGrid(wx, wy);
        if (s_entityGateway) {
            Transform transform{};
            if (s_entityGateway->getAuthoringTransform(s_selectedEntityId, transform)) {
                transform.position.x = wx;
                transform.position.y = wy;
                s_entityGateway->setTransform(s_selectedEntityId, transform);
            }
        }
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onMouseDown(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    float screenX = 0.f, screenY = 0.f;
    toScreen(e, screenX, screenY);
    if (RayTintWidget::isActive()) {
        if (RayTintWidget::onMouseDown(screenX, screenY))
            return EM_TRUE;
    }
    toScreen(e, s_lastPanScreenX, s_lastPanScreenY);
    if (s_editorTool == ToolPan) {
        s_isDragging = true;
        return EM_TRUE;
    }
    float wx, wy;
    toWorld(e, wx, wy);
    s_dragStartX = wx;
    s_dragStartY = wy;
    if (s_tilePaintMode) {
        paintTileAt(s_dragStartX, s_dragStartY); // single click paints too
        s_isDragging = true;
        return EM_TRUE;
    }
    if (e->button == 0 && (e->ctrlKey || e->metaKey) && s_editorTool == ToolSelect) {
        const uint32_t picked = pickEntityAt(wx, wy);
        if (picked != 0u) {
            snapWorldToEditorGrid(wx, wy);
            notifyEntityDuplicateRequested(picked, wx, wy);
        }
        s_isDragging = false;
        return EM_TRUE;
    }
    s_isDragging = true;
    // Click-to-select: pick the entity under the cursor on the canvas so
    // the user doesn't have to go through the Hierarchy panel. A hit also
    // makes it the live-drag target (onMouseMove drags s_selectedEntityId).
    const uint32_t picked = pickEntityAt(wx, wy);
    if (picked != 0u) {
        s_selectedEntityId = picked;
        notifyEntitySelected(picked);
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onMouseUp(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    float screenX = 0.f, screenY = 0.f;
    toScreen(e, screenX, screenY);
    if (RayTintWidget::isActive()) {
        RayTintWidget::onMouseUp(screenX, screenY);
        return EM_TRUE;
    }
    const bool wasDragging = s_isDragging;
    s_isDragging = false;
    if (s_editorTool == ToolPan) return EM_TRUE;  // panning: no transform notify
    if (s_tilePaintMode)         return EM_TRUE;  // painting: no transform notify

    if (wasDragging && s_selectedEntityId != 0u && s_entityGateway) {
        // P1: mouse-up must echo rotation/scale from the gateway, never {0,1,1}.
        // onMouseMove only mutates position; skip notify if transform is unknown.
        Transform transform{};
        if (s_entityGateway->getAuthoringTransform(s_selectedEntityId, transform))
            notifyTransformChanged(s_selectedEntityId,
                transform.position.x, transform.position.y,
                transform.rotation,
                transform.scale.x, transform.scale.y);
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onKeyDown(int, const EmscriptenKeyboardEvent* key, void*) {
    if (s_mode != 0) return EM_FALSE;
    if (RayTintWidget::isActive() && key && key->keyCode == 256) { // Escape
        RayTintWidget::close(false);
        return EM_TRUE;
    }
    return EM_FALSE; // don't consume — let the browser handle F5, tab, etc.
}

EM_BOOL EditorAPI::onKeyUp(int, const EmscriptenKeyboardEvent*, void*) {
    return EM_FALSE;
}

// =============================================================================
// Public API
// =============================================================================

namespace EditorInputController {

void initCanvas(const char* canvasSelector) {
    if (canvasSelector && *canvasSelector) s_canvasSel = canvasSelector;
    Modules::pointerCoordsSetCanvasSelector(s_canvasSel.c_str());
    emscripten_set_mousemove_callback(canvasSelector, nullptr, 1, EditorAPI::onMouseMove);
    emscripten_set_mousedown_callback(canvasSelector, nullptr, 1, EditorAPI::onMouseDown);
    emscripten_set_mouseup_callback  (canvasSelector, nullptr, 1, EditorAPI::onMouseUp);
    emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, EditorAPI::onKeyDown);
    emscripten_set_keyup_callback  (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, EditorAPI::onKeyUp);
}

void shutdownCanvas() {
    emscripten_set_mousemove_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_mousedown_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_mouseup_callback  (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_keydown_callback  (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_keyup_callback    (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
}

} // namespace EditorInputController

} // namespace ArtCade

#endif // __EMSCRIPTEN__

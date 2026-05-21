#include "editor-input-controller.h"

#ifdef __EMSCRIPTEN__

#include "../include/editor-api.h"
#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/renderer/include/renderer.h"
#include "../../../core/types.h"

#include <emscripten.h>
#include <emscripten/html5.h>

#include <string>

namespace ArtCade {

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
    double cssW = 0.0, cssH = 0.0;
    int    iw   = 0,   ih   = 0;
    emscripten_get_element_css_size (s_canvasSel.c_str(), &cssW, &cssH);
    emscripten_get_canvas_element_size(s_canvasSel.c_str(), &iw,  &ih);
    const float sx = (cssW > 0.0) ? static_cast<float>(iw / cssW) : 1.f;
    const float sy = (cssH > 0.0) ? static_cast<float>(ih / cssH) : 1.f;
    sxOut = static_cast<float>(e->targetX) * sx;
    syOut = static_cast<float>(e->targetY) * sy;
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
    for (EntityId id : gw->activeSceneIds()) {
        Transform transform{};
        if (!gw->getTransform(id, transform)) continue;
        float sx = transform.scale.x; if (sx < 0.f) sx = -sx;
        float sy = transform.scale.y; if (sy < 0.f) sy = -sy;
        const float hw = 32.f * (sx > 0.f ? sx : 1.f);
        const float hh = 32.f * (sy > 0.f ? sy : 1.f);
        const float cx = transform.position.x;
        const float cy = transform.position.y;
        if (x >= cx - hw && x <= cx + hw && y >= cy - hh && y <= cy + hh)
            hit = id; // later in the list = drawn on top -> wins
    }
    return hit;
}
} // namespace

// =============================================================================
// EditorAPI native input callbacks (declared in editor-api.h)
// =============================================================================

EM_BOOL EditorAPI::onMouseMove(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    if (s_editorTool == ToolPan && s_isDragging) {
        float sx = 0.f, sy = 0.f;
        toScreen(e, sx, sy);
        if (s_renderer)
            s_renderer->panCameraByScreenDelta(sx - s_lastPanScreenX, sy - s_lastPanScreenY);
        s_lastPanScreenX = sx;
        s_lastPanScreenY = sy;
        return EM_TRUE;
    }
    float wx, wy;
    toWorld(e, wx, wy);
    if (s_tilePaintMode) {
        if (s_isDragging) paintTileAt(wx, wy);
        return EM_TRUE;
    }
    if (s_isDragging && s_selectedEntityId != 0u) {
        if (s_entityGateway) {
            Transform transform{};
            if (s_entityGateway->getTransform(s_selectedEntityId, transform)) {
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
    s_isDragging = true;
    toScreen(e, s_lastPanScreenX, s_lastPanScreenY);
    if (s_editorTool == ToolPan) return EM_TRUE;
    float wx, wy;
    toWorld(e, wx, wy);
    s_dragStartX = wx;
    s_dragStartY = wy;
    if (s_tilePaintMode) {
        paintTileAt(s_dragStartX, s_dragStartY); // single click paints too
        return EM_TRUE;
    }
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
    s_isDragging = false;
    if (s_editorTool == ToolPan) return EM_TRUE;  // panning: no transform notify
    if (s_tilePaintMode)         return EM_TRUE;  // painting: no transform notify

    if (s_selectedEntityId != 0u) {
        // Preserve rotation/scale: the live drag in onMouseMove only updates
        // position. Hard-coding {0, 1, 1} silently reverted a rotated or
        // scaled entity on every canvas drag (P1 — TECHNICAL_DEBT_REVIEW).
        // Read the real transform from the gateway so React stays in sync.
        float finalX, finalY;
        toWorld(e, finalX, finalY);
        float rot = 0.f, sx = 1.f, sy = 1.f;
        if (s_entityGateway) {
            Transform transform{};
            if (s_entityGateway->getTransform(s_selectedEntityId, transform)) {
                finalX = transform.position.x;
                finalY = transform.position.y;
                rot    = transform.rotation;
                sx     = transform.scale.x;
                sy     = transform.scale.y;
            }
        }
        notifyTransformChanged(s_selectedEntityId, finalX, finalY, rot, sx, sy);
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onKeyDown(int, const EmscriptenKeyboardEvent*, void*) {
    if (s_mode != 0) return EM_FALSE;
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

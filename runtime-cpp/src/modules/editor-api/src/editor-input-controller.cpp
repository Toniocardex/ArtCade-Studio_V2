#include "editor-input-controller.h"

#ifdef __EMSCRIPTEN__

#include "../include/editor-api.h"
#include "pointer-coords.h"
#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/renderer/include/renderer.h"
#include "../../../modules/presentation/include/presentation_snapshot.h"
#include "../../../core/types.h"

#include <emscripten.h>
#include <emscripten/html5.h>

#include <cmath>
#include <algorithm>
#include <string>
#include <vector>

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
        const ArtCade::Presentation::PresentationSnapshot& snapshot =
            EditorAPI::s_renderer->committedPresentationSnapshot();
        const ArtCade::Presentation::WorldPoint world = snapshot.surface_to_world(
            ArtCade::Presentation::SurfacePoint{ screenX, screenY });
        wx = static_cast<float>(world.x);
        wy = static_cast<float>(world.y);
    } else {
        wx = screenX;
        wy = screenY;
    }
}

// Pick gating: a layer is editable when it is NOT locked (global, per-layer)
// AND visible in the active scene (per-scene SceneLayerSettings).
bool layerAllowsCanvasEdit(Modules::RuntimeEntityGateway& gateway,
                           const std::string& layerId) {
    if (layerId.empty()) return true;
    bool locked = false, found = false;
    for (const auto& layer : gateway.sceneLayers()) {
        if (layer.id != layerId) continue;
        locked = layer.locked;
        found = true;
        break;
    }
    if (!found) return true;
    bool visible = true;
    if (const SceneDef* scene = gateway.activeScene()) {
        const auto it = scene->layerSettings.find(layerId);
        if (it != scene->layerSettings.end()) visible = it->second.visible;
    }
    return visible && !locked;
}

bool entityAllowsCanvasEdit(Modules::RuntimeEntityGateway& gateway,
                            EntityId id,
                            const SpriteComponent* sprite = nullptr) {
    if (sprite)
        return layerAllowsCanvasEdit(gateway, sprite->layerId);
    if (const EntityDef* def = gateway.getEntityDef(id))
        return layerAllowsCanvasEdit(gateway, def->layerId);
    return true;
}

// Stack rank by id (count - index, index 0 = top). Intra-layer ties break on
// renderOrder then insertion order in choosePickHit, so no magic multiplier.
int layerRenderPriority(Modules::RuntimeEntityGateway& gateway,
                        const std::string& layerId) {
    const auto& layers = gateway.sceneLayers();
    const int layerCount = static_cast<int>(layers.size());
    for (size_t i = 0; i < layers.size(); ++i) {
        if (layers[i].id != layerId) continue;
        return layerCount - static_cast<int>(i);
    }
    return 0;
}

struct PickHit {
    uint32_t id = 0u;
    int      layerPriority = 0;
    int32_t  renderOrder = 0;
    size_t   insertionIndex = 0u;
};

uint32_t choosePickHit(std::vector<PickHit>& hits, bool cycleOverlap) {
    if (hits.empty()) return 0u;
    std::stable_sort(hits.begin(), hits.end(), [](const PickHit& a, const PickHit& b) {
        if (a.layerPriority != b.layerPriority) return a.layerPriority > b.layerPriority;
        if (a.renderOrder != b.renderOrder) return a.renderOrder > b.renderOrder;
        return a.insertionIndex > b.insertionIndex;
    });
    if (cycleOverlap && EditorAPI::s_selectedEntityId != 0u) {
        for (size_t i = 0; i < hits.size(); ++i) {
            if (hits[i].id != EditorAPI::s_selectedEntityId) continue;
            return hits[(i + 1u) % hits.size()].id;
        }
    }
    return hits.front().id;
}

// Pick the top-most entity whose clickable box contains the world point.
// Entities are drawn centred on transform.position; we use a generous
// 64px (x scale) hit box so they're easy to grab in the editor viewport.
// Text/gauge-only entities (no sprite) fall back to a fixed 32x32 hitbox.
uint32_t pickEntityAt(float x, float y, bool cycleOverlap) {
    auto* gw = EditorAPI::s_entityGateway;
    if (!gw) return 0u;
    std::vector<PickHit> hits;

    // Pass 1: entities with sprites (sprite-scaled hitbox — takes priority).
    gw->forEachActiveRenderable([&](EntityId id, const Transform& transform, const SpriteComponent& sprite) {
        if (!entityAllowsCanvasEdit(*gw, id, &sprite)) return;
        float sx = transform.scale.x; if (sx < 0.f) sx = -sx;
        float sy = transform.scale.y; if (sy < 0.f) sy = -sy;
        const float hw = 32.f * (sx > 0.f ? sx : 1.f);
        const float hh = 32.f * (sy > 0.f ? sy : 1.f);
        const float cx = transform.position.x;
        const float cy = transform.position.y;
        if (x >= cx - hw && x <= cx + hw && y >= cy - hh && y <= cy + hh)
            hits.push_back(PickHit{
                id,
                layerRenderPriority(*gw, sprite.layerId),
                sprite.renderOrder,
                hits.size(),
            });
    });
    if (!hits.empty()) return choosePickHit(hits, cycleOverlap);

    // Pass 2: text/gauge-only entities that have no sprite (HUD elements).
    // Use the entity's authored transform with a fixed 32x32 default hitbox.
    for (EntityId id : gw->activeSceneIds()) {
        SpriteComponent sprite{};
        if (gw->getSprite(id, sprite)) continue; // covered by pass 1
        TextComponent text{};
        GaugeComponent gauge{};
        if (!gw->getText(id, text) && !gw->getGauge(id, gauge)) continue;
        if (!entityAllowsCanvasEdit(*gw, id)) continue;
        Transform transform{};
        if (!gw->getAuthoringTransform(id, transform)) continue;
        int layerPriority = 0;
        if (const EntityDef* def = gw->getEntityDef(id))
            layerPriority = layerRenderPriority(*gw, def->layerId);
        const float cx = transform.position.x;
        const float cy = transform.position.y;
        if (x >= cx - 32.f && x <= cx + 32.f && y >= cy - 32.f && y <= cy + 32.f)
            hits.push_back(PickHit{ id, layerPriority, 0, hits.size() });
    }
    return choosePickHit(hits, cycleOverlap);
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
    if (s_editorTool == ToolPan) {
        // Panning is owned by the editor's scroll container (it drives the
        // scrollbars + rulers and pushes the resulting camera target back via
        // editor_set_edit_camera). The runtime must NOT also move its camera,
        // or the two pans compound. Just consume the event.
        return EM_TRUE;
    }
    float wx, wy;
    toWorld(e, wx, wy);
    if (s_isDragging && s_selectedEntityId != 0u) {
        snapWorldToEditorGrid(wx, wy);
        if (s_entityGateway) {
            Transform transform{};
            if (
                entityAllowsCanvasEdit(*s_entityGateway, s_selectedEntityId) &&
                s_entityGateway->getAuthoringTransform(s_selectedEntityId, transform)
            ) {
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
    toScreen(e, s_lastPanScreenX, s_lastPanScreenY);
    if (s_editorTool == ToolPan) {
        s_isDragging = true;
        return EM_TRUE;
    }
    float wx, wy;
    toWorld(e, wx, wy);
    s_dragStartX = wx;
    s_dragStartY = wy;
    if (e->button == 0 && (e->ctrlKey || e->metaKey) && s_editorTool == ToolSelect) {
        const uint32_t picked = pickEntityAt(wx, wy, false);
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
    const uint32_t picked = pickEntityAt(wx, wy, e->altKey);
    if (picked != 0u) {
        s_selectedEntityId = picked;
        notifyEntitySelected(picked);
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onMouseUp(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    const bool wasDragging = s_isDragging;
    s_isDragging = false;
    if (s_editorTool == ToolPan) return EM_TRUE;  // panning: no transform notify

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

// camera-api.cpp — Lua bindings for CameraManager (via Renderer)
//
// Exposes:
//   camera.setPosition(x, y)    — move camera target to world point (x,y)
//   camera.move(dx, dy)         — relative pan
//   camera.setZoom(zoom)        — set zoom (1.0 = normal)
//   camera.zoomBy(delta)        — relative zoom change
//   camera.centerOn(entityId)   — follow an entity
//   camera.x()  / camera.y()   — read current camera target
//   camera.zoom()               — read current zoom
//
// Note: the Renderer stores the Camera2D directly; these calls delegate to
// Renderer::setCameraPosition / setCameraZoom / getCameraPosition / getCameraZoom.

#include "../include/game-api.h"
#include "../../entity-system/include/entity-manager.h"
#include "../../renderer/include/renderer.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindCameraAPI(sol::state& lua) {
    auto* renderer = ctx_.renderer;
    auto* em       = ctx_.entityManager;

    // camera.setPosition(x, y)
    lua.set_function("camera_setPosition", [renderer](float x, float y) {
        if (renderer) renderer->setCameraPosition({ x, y });
    });

    // camera.move(dx, dy)
    lua.set_function("camera_move", [renderer](float dx, float dy) {
        if (!renderer) return;
        auto pos = renderer->getCameraPosition();
        renderer->setCameraPosition({ pos.x + dx, pos.y + dy });
    });

    // camera.setZoom(zoom)
    lua.set_function("camera_setZoom", [renderer](float zoom) {
        if (renderer) renderer->setCameraZoom(zoom);
    });

    // camera.zoomBy(delta) — additive zoom change
    lua.set_function("camera_zoomBy", [renderer](float delta) {
        if (!renderer) return;
        renderer->setCameraZoom(renderer->getCameraZoom() + delta);
    });

    // camera.centerOn(entityId) — set camera target to entity position
    lua.set_function("camera_centerOn", [renderer, em](EntityId id) {
        if (!renderer || !em) return;
        auto* e = em->get(id);
        if (!e) return;
        renderer->setCameraPosition(e->transform.position);
    });

    // camera.x() / camera.y() — read back camera target
    lua.set_function("camera_x", [renderer]() -> float {
        return renderer ? renderer->getCameraPosition().x : 0.f;
    });
    lua.set_function("camera_y", [renderer]() -> float {
        return renderer ? renderer->getCameraPosition().y : 0.f;
    });
    lua.set_function("camera_getZoom", [renderer]() -> float {
        return renderer ? renderer->getCameraZoom() : 1.f;
    });

    // Lua-side convenience table
    lua.script(R"(
        camera = {}
        camera.setPosition = function(x, y)   camera_setPosition(x, y)   end
        camera.move        = function(dx, dy)  camera_move(dx, dy)        end
        camera.setZoom     = function(z)       camera_setZoom(z)          end
        camera.zoomBy      = function(d)       camera_zoomBy(d)           end
        camera.centerOn    = function(id)      camera_centerOn(id)        end
        camera.x           = function()  return camera_x()               end
        camera.y           = function()  return camera_y()               end
        camera.zoom        = function()  return camera_getZoom()         end
    )");
}

} // namespace ArtCade::Modules

#include "../include/game-api.h"
#include "../../renderer/include/renderer.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindShaderAPI(sol::state& lua) {
    auto* renderer = ctx_.renderer;
    auto* gw       = ctx_.entityGateway;

    lua.set_function("entity_setShader",
        [gw](EntityId id, const std::string& name) {
            if (!gw) return;
            if (auto* e = gw->get(id))
                e->sprite.shaderEffect = name;
        });

    lua.set_function("renderer_setScreenShader",
        [renderer](const std::string& name) {
            if (renderer) renderer->setScreenShader(name);
        });

    lua.script(R"(
        shaders = {}
        shaders.setEntity = function(id, name) entity_setShader(id, name) end
        shaders.setScreen = function(name) renderer_setScreenShader(name) end
    )");
}

} // namespace ArtCade::Modules

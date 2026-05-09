#include "../include/game-api.h"
#include "../../input/include/input.h"

#include <sol/sol.hpp>
#include <tuple>

namespace ArtCade::Modules {

void GameAPI::bindInputAPI(sol::state& lua) {
    auto* input = ctx_.input;

    lua.set_function("input_isKeyDown",      [input](const std::string& c) { return input->isKeyDown(c);      });
    lua.set_function("input_wasKeyPressed",  [input](const std::string& c) { return input->wasKeyPressed(c);  });
    lua.set_function("input_wasKeyReleased", [input](const std::string& c) { return input->wasKeyReleased(c); });
    lua.set_function("input_mousePosition",  [input]() -> std::tuple<float, float> {
        auto pos = input->mousePosition();
        return { pos.x, pos.y };
    });
    lua.set_function("input_mouseButtonDown", [input](int btn) { return input->isMouseButtonDown(btn); });

    lua.script(R"(
        input = {}
        input.isKeyDown       = function(code) return input_isKeyDown(code)        end
        input.wasKeyPressed   = function(code) return input_wasKeyPressed(code)    end
        input.wasKeyReleased  = function(code) return input_wasKeyReleased(code)   end
        input.mousePosition   = function()     return input_mousePosition()        end
        input.mouseButtonDown = function(btn)  return input_mouseButtonDown(btn)   end
    )");
}

} // namespace ArtCade::Modules

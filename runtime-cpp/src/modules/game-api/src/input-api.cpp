#include "../include/game-api.h"
#include "../../input/include/input.h"

#include <functional>
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
        input = input or {}
        input._onPressed  = {}
        input._onReleased = {}

        input.isKeyDown       = function(code) return input_isKeyDown(code)        end
        input.wasKeyPressed   = function(code) return input_wasKeyPressed(code)    end
        input.wasKeyReleased  = function(code) return input_wasKeyReleased(code)   end
        input.mousePosition   = function()     return input_mousePosition()        end
        input.mouseButtonDown = function(btn)  return input_mouseButtonDown(btn)   end

        local function registerInputHandler(bag, code, fn)
            assert(type(code) == "string" and code ~= "",
                "input: code must be a non-empty string")
            assert(type(fn) == "function",
                "input: handler must be a function")
            bag[code] = bag[code] or {}
            table.insert(bag[code], fn)
        end

        function input.onPressed(code, fn)
            registerInputHandler(input._onPressed, code, fn)
        end

        function input.onReleased(code, fn)
            registerInputHandler(input._onReleased, code, fn)
        end

        function input.clearHandlers()
            input._onPressed  = {}
            input._onReleased = {}
        end
    )");
}

namespace {

void dispatchInputBag(sol::state& lua,
                      sol::table bag,
                      const std::function<bool(const std::string&)>& isActive)
{
    if (!bag.valid()) return;

    for (auto&& kv : bag) {
        sol::object keyObj = kv.first;
        sol::object listObj = kv.second;
        if (!keyObj.is<std::string>() || !listObj.is<sol::table>())
            continue;

        const std::string code = keyObj.as<std::string>();
        if (!isActive(code)) continue;

        sol::table list = listObj.as<sol::table>();
        for (size_t i = 1; ; ++i) {
            sol::object slot = list[i];
            if (!slot.valid() || slot == sol::nil) break;
            sol::protected_function fn = slot.as<sol::protected_function>();
            if (!fn.valid()) continue;
            auto result = fn(code);
            if (!result.valid()) {
                sol::error err = result;
                sol::protected_function debugLog = lua["debug"]["log"];
                if (debugLog.valid())
                    debugLog(std::string("[input handler error] ") + err.what());
            }
        }
    }
}

} // namespace

void GameAPI::dispatchInputEvents() {
    if (!luaState_ || !ctx_.input) return;

    sol::state& lua = *luaState_;
    sol::table input = lua["input"];
    if (!input.valid()) return;

    sol::table pressedBag  = input["_onPressed"];
    sol::table releasedBag = input["_onReleased"];

    dispatchInputBag(lua, pressedBag,
        [input = ctx_.input](const std::string& code) {
            return input->wasKeyPressed(code);
        });
    dispatchInputBag(lua, releasedBag,
        [input = ctx_.input](const std::string& code) {
            return input->wasKeyReleased(code);
        });
}

} // namespace ArtCade::Modules

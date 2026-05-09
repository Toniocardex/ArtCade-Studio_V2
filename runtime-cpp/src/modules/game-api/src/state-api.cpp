#include "../include/game-api.h"
#include "../../../world/include/world.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindStateAPI(sol::state& lua) {
    auto* world = ctx_.world;

    // state.get(key) → value (int | float | string | bool)
    lua.set_function("state_get", [world](const std::string& key) -> sol::object {
        // TODO: convert StateValue variant to sol::object
        (void)world; (void)key;
        return sol::nil;
    });

    // state.set(key, value)
    lua.set_function("state_set", [world](const std::string& key, const sol::object& val) {
        if (val.is<int>())         world->setGlobalState(key, StateValue{val.as<int32_t>()});
        else if (val.is<float>())  world->setGlobalState(key, StateValue{val.as<float>()});
        else if (val.is<bool>())   world->setGlobalState(key, StateValue{val.as<bool>()});
        else if (val.is<std::string>()) world->setGlobalState(key, StateValue{val.as<std::string>()});
    });

    // state.add(key, amount) → new value (numeric only)
    lua.set_function("state_add", [world](const std::string& key, float amount) -> float {
        auto cur = world->getGlobalState(key);
        float next = 0.f;
        if (auto* v = std::get_if<int32_t>(&cur))   next = static_cast<float>(*v) + amount;
        else if (auto* v = std::get_if<float>(&cur)) next = *v + amount;
        world->setGlobalState(key, StateValue{next});
        return next;
    });

    lua.script(R"(
        state = {}
        state.get = function(key)         return state_get(key)         end
        state.set = function(key, val)    return state_set(key, val)    end
        state.add = function(key, amount) return state_add(key, amount) end
    )");
}

} // namespace ArtCade::Modules

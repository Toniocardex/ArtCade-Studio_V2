#include "../include/game-api.h"
#include "../../variable-manager/include/variable-manager.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindStateAPI(sol::state& lua) {
    auto* vm = ctx_.variableManager;

    lua.set_function("state_get",
        [vm](sol::this_state ts, const std::string& key) -> sol::object
        {
            if (!vm || !vm->exists(key)) return sol::lua_nil;
            sol::state_view L(ts);
            auto val = vm->get(key);
            if (auto* v = std::get_if<int32_t>(&val))     return sol::make_object(L, *v);
            if (auto* v = std::get_if<float>(&val))      return sol::make_object(L, *v);
            if (auto* v = std::get_if<std::string>(&val)) return sol::make_object(L, *v);
            if (auto* v = std::get_if<bool>(&val))       return sol::make_object(L, *v);
            return sol::lua_nil;
        });

    lua.set_function("state_set", [vm](const std::string& key, const sol::object& val) {
        if (!vm) return;
        if (val.is<int>())         vm->setInt(key, val.as<int32_t>());
        else if (val.is<float>())  vm->setFloat(key, val.as<float>());
        else if (val.is<bool>())   vm->setBool(key, val.as<bool>());
        else if (val.is<std::string>()) vm->setString(key, val.as<std::string>());
    });

    lua.set_function("state_add", [vm](const std::string& key, float amount) -> float {
        if (!vm) return 0.f;
        return vm->addFloat(key, amount);
    });

    lua.script(R"(
        state = {}
        state.get = function(key)         return state_get(key)         end
        state.set = function(key, val)    return state_set(key, val)    end
        state.add = function(key, amount) return state_add(key, amount) end
    )");
}

} // namespace ArtCade::Modules

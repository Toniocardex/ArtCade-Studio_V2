#include "../include/game-api.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindLifecycleAPI(sol::state& lua) {
    auto* gw = ctx_.entityGateway;

    lua.set_function("lifecycle_pollDestroyed", [gw](sol::this_state ts) -> sol::table {
        sol::state_view L(ts);
        sol::table out = L.create_table();
        if (!gw) return out;
        const auto events = gw->pollDestroyed();
        int i = 1;
        for (const auto& ev : events) {
            sol::table row = L.create_table();
            row["entityId"] = ev.entityId;
            out[i++] = row;
        }
        return out;
    });

    lua.script(R"(
        lifecycle = {}
        lifecycle.pollDestroyed = function() return lifecycle_pollDestroyed() end
    )");
}

} // namespace ArtCade::Modules

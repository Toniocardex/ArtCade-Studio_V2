// sensor-api.cpp — Lua bindings for World sensor overlap edges
//
//   sensor.poll() → array of { entityId, otherId, tag, enter }
// Drains the buffer filled by World::tickSensorOverlapEdges each frame.

#include "../include/game-api.h"
#include "../../../world/include/world.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindSensorAPI(sol::state& lua) {
    auto* world = ctx_.world;

    lua.set_function("sensor_poll", [world](sol::this_state ts) -> sol::table {
        sol::state_view lua(ts);
        sol::table out = lua.create_table();
        if (!world) return out;

        const auto edges = world->pollSensorEdges();
        int i = 1;
        for (const SensorEdgeEvent& ev : edges) {
            sol::table row = lua.create_table();
            row["entityId"] = ev.entityId;
            row["otherId"]  = ev.otherId;
            row["tag"]      = ev.targetTag;
            row["enter"]    = ev.enter;
            out[i++] = row;
        }
        return out;
    });

    lua.script(R"(
        sensor = {}
        sensor.poll = function() return sensor_poll() end
    )");
}

} // namespace ArtCade::Modules

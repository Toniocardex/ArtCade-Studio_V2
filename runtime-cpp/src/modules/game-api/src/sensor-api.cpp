// sensor-api.cpp — Lua bindings for World sensor overlap edges
//
//   sensor.poll() → array of { entityId, otherId, tag, enter }
// Drains the buffer filled by World::tickSensorOverlapEdges each frame.

#include "../include/game-api.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../world/include/world.h"

#include <algorithm>
#include <sol/sol.hpp>
#include <string>
#include <vector>

namespace ArtCade::Modules {

namespace {

constexpr char kSensorKeySeparator = '\x1f';

std::string sensorKey(const std::string& source, const std::string& target) {
    return source + kSensorKeySeparator + target;
}

sol::table makeSensorRow(sol::state_view lua, const SensorEdgeEvent& ev) {
    sol::table row = lua.create_table();
    row["entityId"] = ev.entityId;
    row["otherId"]  = ev.otherId;
    row["tag"]      = ev.targetTag;
    row["enter"]    = ev.enter;
    return row;
}

int nextArrayIndex(sol::table table) {
    int i = 1;
    for (;; ++i) {
        sol::object slot = table[i];
        if (!slot.valid() || slot == sol::nil)
            return i;
    }
}

void appendPendingSensorEvent(sol::state& lua,
                              sol::table sensor,
                              const SensorEdgeEvent& ev)
{
    sol::object pendingObj = sensor["_pending"];
    sol::table pending = pendingObj.is<sol::table>()
        ? pendingObj.as<sol::table>()
        : lua.create_table();
    pending[nextArrayIndex(pending)] = makeSensorRow(lua, ev);
    sensor["_pending"] = pending;
}

uint32_t dispatchSensorList(sol::state& lua,
                        sol::table list,
                        const SensorEdgeEvent& ev)
{
    if (!list.valid()) return 0;
    uint32_t dispatched = 0;
    for (size_t i = 1; ; ++i) {
        sol::object slot = list[i];
        if (!slot.valid() || slot == sol::nil) break;
        sol::protected_function fn = slot.as<sol::protected_function>();
        if (!fn.valid()) continue;
        auto result = fn(ev.entityId, ev.otherId, ev.targetTag);
        ++dispatched;
        if (!result.valid()) {
            sol::error err = result;
            sol::protected_function debugLog = lua["debug"]["log"];
            if (debugLog.valid())
                debugLog(std::string("[sensor handler error] ") + err.what());
        }
    }
    return dispatched;
}

uint32_t dispatchSensorHandlers(sol::state& lua,
                            sol::table bag,
                            const std::vector<std::string>& keys,
                            const SensorEdgeEvent& ev)
{
    if (!bag.valid()) return 0;
    uint32_t dispatched = 0;
    for (const std::string& key : keys) {
        sol::object listObj = bag[key];
        if (!listObj.is<sol::table>()) continue;
        dispatched += dispatchSensorList(lua, listObj.as<sol::table>(), ev);
    }
    return dispatched;
}

std::vector<std::string> sensorDispatchKeys(EntityId entityId,
                                            const std::string& className,
                                            const std::string& targetTag)
{
    const std::string idKey = std::to_string(entityId);
    const std::string any = "*";
    const std::string target = targetTag.empty() ? any : targetTag;

    std::vector<std::string> keys;
    auto add = [&keys](std::string key) {
        if (std::find(keys.begin(), keys.end(), key) == keys.end())
            keys.push_back(std::move(key));
    };

    add(sensorKey(idKey, target));
    if (!className.empty())
        add(sensorKey(className, target));
    add(sensorKey(any, target));
    add(sensorKey(idKey, any));
    if (!className.empty())
        add(sensorKey(className, any));
    add(sensorKey(any, any));
    return keys;
}

} // namespace

void GameAPI::bindSensorAPI(sol::state& lua) {
    auto* world = ctx_.world;

    lua.set_function("sensor_poll", [world](sol::this_state ts) -> sol::table {
        sol::state_view lua(ts);
        sol::table out = lua.create_table();
        if (!world) return out;

        sol::table sensor = lua["sensor"];
        if (sensor.valid()) {
            sol::object pendingObj = sensor["_pending"];
            if (pendingObj.is<sol::table>()) {
                sol::table pending = pendingObj.as<sol::table>();
                sol::object first = pending[1];
                if (first.valid() && first != sol::nil) {
                    sensor["_pending"] = lua.create_table();
                    return pending;
                }
            }
        }

        const auto edges = world->pollSensorEdges();
        int i = 1;
        for (const SensorEdgeEvent& ev : edges) {
            out[i++] = makeSensorRow(lua, ev);
        }
        return out;
    });

    lua.script(R"(
        sensor = sensor or {}
        sensor._pending = {}
        sensor._onEnter = {}
        sensor._onExit  = {}

        sensor.poll = function() return sensor_poll() end

        local function sensorKey(source, target)
            return tostring(source or "*") .. "\31" .. tostring(target or "*")
        end

        local function registerSensorHandler(bag, entityOrClass, targetTag, fn)
            assert(type(fn) == "function",
                "sensor: handler must be a function")
            local key = sensorKey(entityOrClass, targetTag)
            bag[key] = bag[key] or {}
            table.insert(bag[key], fn)
        end

        function sensor.onEnter(entityOrClass, targetTag, fn)
            registerSensorHandler(sensor._onEnter, entityOrClass, targetTag, fn)
        end

        function sensor.onExit(entityOrClass, targetTag, fn)
            registerSensorHandler(sensor._onExit, entityOrClass, targetTag, fn)
        end

        function sensor.clearHandlers()
            sensor._onEnter = {}
            sensor._onExit  = {}
        end
    )");
}

uint32_t GameAPI::dispatchSensorEvents() {
    if (!luaState_ || !ctx_.world) return 0;

    const auto events = ctx_.world->pollSensorEdges();
    if (events.empty()) return 0;

    sol::state& lua = *luaState_;
    sol::table sensor = lua["sensor"];
    if (!sensor.valid()) return 0;

    sol::table enterBag = sensor["_onEnter"];
    sol::table exitBag  = sensor["_onExit"];

    uint32_t dispatched = 0;
    for (const SensorEdgeEvent& ev : events) {
        appendPendingSensorEvent(lua, sensor, ev);
        const std::string cls = ctx_.entityGateway
            ? ctx_.entityGateway->className(ev.entityId)
            : std::string{};
        const auto keys = sensorDispatchKeys(ev.entityId, cls, ev.targetTag);
        dispatched += dispatchSensorHandlers(lua, ev.enter ? enterBag : exitBag, keys, ev);
    }
    return dispatched;
}

} // namespace ArtCade::Modules

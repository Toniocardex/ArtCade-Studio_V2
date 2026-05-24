#include "../include/game-api.h"
#include "../../sprite-animator/include/sprite-animator.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <algorithm>
#include <sol/sol.hpp>
#include <string>
#include <vector>

namespace ArtCade::Modules {

namespace {

constexpr char kAnimKeySeparator = '\x1f';

std::string animKey(const std::string& source, const std::string& clip) {
    return source + kAnimKeySeparator + clip;
}

std::vector<std::string> animDispatchKeys(EntityId entityId,
                                          const std::string& className,
                                          const std::string& clipName)
{
    const std::string idKey = std::to_string(entityId);
    const std::string any = "*";
    const std::string clip = clipName.empty() ? any : clipName;

    std::vector<std::string> keys;
    auto add = [&keys](std::string key) {
        if (std::find(keys.begin(), keys.end(), key) == keys.end())
            keys.push_back(std::move(key));
    };

    add(animKey(idKey, clip));
    add(animKey(idKey, any));
    if (!className.empty()) {
        add(animKey(className, clip));
        add(animKey(className, any));
    }
    add(animKey(any, clip));
    add(animKey(any, any));
    return keys;
}

uint32_t dispatchAnimList(sol::state& lua,
                          sol::table list,
                          EntityId entityId,
                          const std::string& clipName)
{
    if (!list.valid()) return 0;
    uint32_t dispatched = 0;
    for (size_t i = 1; ; ++i) {
        sol::object slot = list[i];
        if (!slot.valid() || slot == sol::nil) break;
        sol::protected_function fn = slot.as<sol::protected_function>();
        if (!fn.valid()) continue;
        auto result = fn(entityId, clipName);
        ++dispatched;
        if (!result.valid()) {
            sol::error err = result;
            sol::protected_function debugLog = lua["debug"]["log"];
            if (debugLog.valid())
                debugLog(std::string("[animation handler error] ") + err.what());
        }
    }
    return dispatched;
}

uint32_t dispatchAnimHandlers(sol::state& lua,
                              sol::table bag,
                              const std::vector<std::string>& keys,
                              EntityId entityId,
                              const std::string& clipName)
{
    if (!bag.valid()) return 0;
    uint32_t dispatched = 0;
    for (const std::string& key : keys) {
        sol::object listObj = bag[key];
        if (!listObj.is<sol::table>()) continue;
        dispatched += dispatchAnimList(lua, listObj.as<sol::table>(), entityId, clipName);
    }
    return dispatched;
}

} // namespace

void GameAPI::bindAnimationAPI(sol::state& lua) {
    auto* anim = ctx_.spriteAnimator;

    lua.set_function("animation_play", [anim](EntityId id, const std::string& clip) {
        if (anim) anim->play(id, clip);
    });

    lua.set_function("animation_pollFinished", [anim](sol::this_state ts) -> sol::table {
        sol::state_view L(ts);
        sol::table out = L.create_table();
        if (!anim) return out;
        const auto events = anim->pollFinished();
        int i = 1;
        for (const auto& ev : events) {
            sol::table row = L.create_table();
            row["entityId"] = ev.entityId;
            row["clip"]     = ev.clipName;
            out[i++] = row;
        }
        return out;
    });

    lua.script(R"(
        animation = animation or {}
        animation.play = function(id, clip) if id and clip ~= "" then return animation_play(id, clip) end end
        animation._onFinished = {}

        animation.pollFinished = function()
            -- Deprecated: prefer animation.onFinished(source, clipName, fn).
            return animation_pollFinished()
        end

        local function animKey(source, clipName)
            return tostring(source or "*") .. "\31" .. tostring(clipName or "*")
        end

        local function registerAnimHandler(bag, entityOrClass, clipName, fn)
            assert(type(fn) == "function",
                "animation: handler must be a function")
            local key = animKey(entityOrClass, clipName)
            bag[key] = bag[key] or {}
            table.insert(bag[key], fn)
        end

        function animation.onFinished(entityOrClass, clipName, fn)
            registerAnimHandler(animation._onFinished, entityOrClass, clipName, fn)
        end

        function animation.clearHandlers()
            animation._onFinished = {}
        end
    )");
}

uint32_t GameAPI::dispatchAnimationEvents() {
    if (!luaState_ || !ctx_.spriteAnimator) return 0;

    const auto events = ctx_.spriteAnimator->pollFinished();
    if (events.empty()) return 0;

    sol::state& lua = *luaState_;
    sol::table animation = lua["animation"];
    if (!animation.valid()) return 0;

    sol::table finishedBag = animation["_onFinished"];

    uint32_t dispatched = 0;
    for (const SpriteAnimator::FinishEvent& ev : events) {
        const std::string cls = ctx_.entityGateway
            ? ctx_.entityGateway->className(ev.entityId)
            : std::string{};
        const auto keys = animDispatchKeys(ev.entityId, cls, ev.clipName);
        dispatched += dispatchAnimHandlers(lua, finishedBag, keys, ev.entityId, ev.clipName);
    }
    return dispatched;
}

} // namespace ArtCade::Modules

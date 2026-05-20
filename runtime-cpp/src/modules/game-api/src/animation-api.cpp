#include "../include/game-api.h"
#include "../../sprite-animator/include/sprite-animator.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindAnimationAPI(sol::state& lua) {
    auto* anim = ctx_.spriteAnimator;

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
        animation = {}
        animation.pollFinished = function() return animation_pollFinished() end
    )");
}

} // namespace ArtCade::Modules

#include "../include/game-api.h"
#include "../../dialog/include/dialog-manager.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindDialogAPI(sol::state& lua) {
    auto* dm = ctx_.dialogManager;
    auto* gw = ctx_.entityGateway;

    lua.set_function("dialog_start",
        [dm, gw](uint32_t entityId, const std::string& dialogId) -> bool {
            if (!dm || !gw) return false;
            if (!gw->exists(entityId)) return false;
            return dm->startDialog(entityId, dialogId);
        });

    lua.set_function("dialog_start_on_host",
        [dm](uint32_t hostId, const std::string& dialogId) -> bool {
            if (!dm) return false;
            return dm->startDialog(hostId, dialogId);
        });

    lua.set_function("dialog_is_active", [dm]() -> bool {
        return dm && dm->isActive();
    });

    lua.script(R"(
        dialog = {}
        dialog.start = function(entityId, dialogId)
            return dialog_start(entityId, dialogId)
        end
        dialog.isActive = function()
            return dialog_is_active()
        end
    )");
}

} // namespace ArtCade::Modules

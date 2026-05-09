#include "../include/game-api.h"

namespace ArtCade::Modules {

GameAPI::GameAPI(const EngineContext& ctx) : ctx_(ctx) {}

bool GameAPI::init()     { return true; }
void GameAPI::shutdown() {}

void GameAPI::registerAll(sol::state& lua) {
    bindEntityAPI (lua);
    bindPhysicsAPI(lua);
    bindInputAPI  (lua);
    bindAudioAPI  (lua);
    bindStateAPI  (lua);
    bindDebugAPI  (lua);
    bindSaveAPI   (lua);
}

} // namespace ArtCade::Modules

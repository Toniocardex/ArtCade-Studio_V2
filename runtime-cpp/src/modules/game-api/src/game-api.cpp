#include "../include/game-api.h"

namespace ArtCade::Modules {

GameAPI::GameAPI(const EngineContext& ctx) : ctx_(ctx) {}

bool GameAPI::init()     { return true; }
void GameAPI::shutdown() {}

void GameAPI::registerAll(sol::state& lua) {
    luaState_ = &lua;      // cached for per-frame dispatch (lifecycle events)
    bindDebugAPI  (lua);   // first: debug.log available for others
    bindEventAPI  (lua);   // event bus (no deps)
    bindTimeAPI   (lua);   // timer system (no deps)
    bindEntityAPI (lua);   // entity / object / pool
    bindPhysicsAPI(lua);   // collision / physics
    bindInputAPI  (lua);   // input
    bindIntentAPI (lua);   // movement/platformer intents
    bindAudioAPI  (lua);   // audio
    bindStateAPI  (lua);   // state
    bindSaveAPI   (lua);   // save
    bindCameraAPI (lua);   // camera
    bindSensorAPI    (lua);
    bindAnimationAPI (lua);
    bindLifecycleAPI (lua);
    bindGridAPI      (lua);
    bindShaderAPI    (lua);
}

} // namespace ArtCade::Modules

#pragma once

#include "../../../core/module.h"
#include "../../../core/engine-context.h"

// Forward-declare sol::state — avoids pulling sol2 into every includer
namespace sol { class state; }

namespace ArtCade::Modules {

/**
 * GameAPI — Lua binding layer.
 *
 * This is the single entry point for registering ALL game functions into the
 * Lua VM.  Actual binding logic is split by domain into separate .cpp files:
 *
 *   entity-api.cpp   — entity.*  (position, velocity, destroy)
 *   physics-api.cpp  — collision.*
 *   input-api.cpp    — input.*
 *   audio-api.cpp    — audio.*
 *   state-api.cpp    — state.*
 *   debug-api.cpp    — debug.*
 *
 * game-api.cpp calls each sub-binder in sequence — it stays < 50 lines.
 */
class GameAPI final : public IModule {
public:
    explicit GameAPI(const EngineContext& ctx);

    bool init() override;
    void shutdown() override;

    // Register every category into the provided Lua state
    void registerAll(sol::state& lua);

private:
    const EngineContext& ctx_;

    void bindEntityAPI (sol::state& lua);
    void bindPhysicsAPI(sol::state& lua);
    void bindInputAPI  (sol::state& lua);
    void bindAudioAPI  (sol::state& lua);
    void bindStateAPI  (sol::state& lua);
    void bindDebugAPI  (sol::state& lua);
};

} // namespace ArtCade::Modules

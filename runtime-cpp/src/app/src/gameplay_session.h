#pragma once

// RU-02c (docs/RU02_GAMEPLAY_SESSION_REFACTOR.md, editor repo): the gameplay
// tick algorithm moved verbatim out of Application::tickFixedStep /
// Application::dispatchGameplayCollisionTransitions. Ownership of every
// referenced module stays with Application until RU-02e/f transfer it here -
// GameplayRuntimeRefs is the transitional non-owning-reference structure the
// plan calls T-01, scheduled for elimination once that ownership transfer
// happens. No new composition root: Application still constructs every
// module below exactly as it does today; this type only holds references to
// what already exists.

#include "gameplay_host_ports.h"

#include "../../core/types.h"
#include "../../modules/camera-manager/include/camera-manager.h"
#include "../../modules/event-bus/include/event-bus.h"
#include "../../modules/game-api/include/game-api.h"
#include "../../modules/game-state/include/game-state-manager.h"
#include "../../modules/logic-runtime/include/logic-runtime.h"
#include "../../modules/lua-runtime/include/lua-host.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/script-runtime/include/script-runtime.h"
#include "../../modules/sprite-animator/include/sprite-animator.h"
#include "../../modules/time/include/time-manager.h"
#include "../../modules/tween-manager/include/tween-manager.h"
#include "../../world/include/world.h"

#include <set>
#include <utility>

namespace ArtCade {

struct GameplayRuntimeRefs {
    World& world;
    Modules::Physics& physics;
    Modules::RuntimeEntityGateway& gateway;
    Modules::TimeManager& time;
    Modules::TweenManager& tweens;
    Modules::SpriteAnimator& animator;
    Modules::CameraManager& camera;
    Modules::GameStateManager& gameState;
    Modules::EventBus& events;
    Modules::GameAPI& gameApi;
    Modules::LuaHost& luaHost;
    Logic::LogicRuntime* logic = nullptr;
    Scripts::ScriptRuntime* scripts = nullptr;
    IGameplayAudioService* audio = nullptr;
    IGameplayDialogGate* dialog = nullptr;
    IRuntimeProfilerSink* profiler = nullptr;
};

class GameplaySession {
public:
    GameplaySession(GameplayRuntimeRefs refs, PhysicsMode physicsMode)
        : refs_(refs), physicsMode_(physicsMode) {}

    void tickFixedStep(float dt);

    // ScriptRuntime is reconstructed at project-load and scene-lifecycle time
    // (app_project_lifecycle.cpp installScriptScopesForActiveScene), unlike
    // every other reference here which Application wires once at boot -
    // Application must call this each time so refs_.scripts never goes stale.
    void setScriptRuntime(Scripts::ScriptRuntime* scripts) { refs_.scripts = scripts; }

    // Application::physicsMode_ can change after construction too
    // (applyRuntimeSettings, project-load time) - kept in sync the same way.
    void setPhysicsMode(PhysicsMode mode) { physicsMode_ = mode; }

    // Collision-pair tracking resets whenever Script scopes are reinstalled
    // for a scene (old pairs no longer meaningful against the new scopes) -
    // mirrors the pre-RU-02c mod_->activeGameplayCollisionPairs.clear() call
    // in installScriptScopesForActiveScene.
    void resetCollisionTracking() { activeGameplayCollisionPairs_.clear(); }

private:
    void dispatchGameplayCollisionTransitions();

    GameplayRuntimeRefs refs_;
    PhysicsMode physicsMode_;
    std::set<std::pair<EntityId, EntityId>> activeGameplayCollisionPairs_;
};

} // namespace ArtCade

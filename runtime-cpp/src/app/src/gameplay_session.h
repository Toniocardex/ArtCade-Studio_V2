#pragma once

// RU-02c/RU-02e-1 (docs/RU02_GAMEPLAY_SESSION_REFACTOR.md, editor repo): the
// gameplay tick algorithm moved verbatim out of Application::tickFixedStep /
// Application::dispatchGameplayCollisionTransitions (RU-02c), then the
// simulation graph itself (Physics/SceneManager/SceneMutationService/
// RuntimeEntityGateway/SceneLifecycleService/World) moved into this class's
// own composition root, `initialize()` (RU-02e-1). Application still
// constructs LogicRuntime/GameAPI/LuaHost/ScriptRuntime (RU-02e-2) and wires
// them in afterwards via `wireHostRefs()` - GameplayRuntimeRefs is the
// transitional non-owning-pointer structure the plan calls T-01, scheduled
// for elimination once RU-02e-2/f transfer those modules here too.

#include "gameplay_host_ports.h"

#include "../../core/types.h"
#include "../../modules/scene-system/include/scene-lifecycle-result.h"

#include <functional>
#include <memory>
#include <set>
#include <utility>
#include <vector>

namespace ArtCade::Modules {
class Physics;
class SceneManager;
class SceneMutationService;
class RuntimeEntityGateway;
class SceneLifecycleService;
class TimeManager;
class TweenManager;
class SpriteAnimator;
class CameraManager;
class GameStateManager;
class EventBus;
class GameAPI;
class LuaHost;
class VariableManager;
} // namespace ArtCade::Modules

namespace ArtCade::Logic {
class LogicRuntime;
} // namespace ArtCade::Logic

namespace ArtCade::Scripts {
class ScriptRuntime;
} // namespace ArtCade::Scripts

namespace ArtCade {

class World;

// RU-02d (docs/RU02_GAMEPLAY_SESSION_REFACTOR.md 5, editor repo): the host's
// input polling result for one frame, immutable once built. Deliberately
// narrower than the plan's own sketch (no pointer fields) - GameplaySession
// consumes no pointer/mouse input today; widen only when a real caller needs
// it, matching how the RU-02c host ports were scoped to actual usage.
struct GameplayInputFrame {
    std::vector<LogicKey> pressed;
    std::vector<LogicKey> released;
    std::vector<LogicKey> held;
};

// RU-02e-1: world/physics/gateway are no longer references here - they are
// owned by GameplaySession directly (see private members below) once
// initialize() builds the simulation graph. The remaining fields stay
// pointer-based (nullptr default) so this struct is default-constructible,
// which lets GameplaySession be constructed early (before GameAPI/LuaHost/
// Logic/Script exist) and wired up later via wireHostRefs().
struct GameplayRuntimeRefs {
    Modules::TimeManager* time = nullptr;
    Modules::TweenManager* tweens = nullptr;
    Modules::SpriteAnimator* animator = nullptr;
    Modules::CameraManager* camera = nullptr;
    Modules::GameStateManager* gameState = nullptr;
    Modules::EventBus* events = nullptr;
    Modules::GameAPI* gameApi = nullptr;
    Modules::LuaHost* luaHost = nullptr;
    Logic::LogicRuntime* logic = nullptr;
    Scripts::ScriptRuntime* scripts = nullptr;
    IGameplayAudioService* audio = nullptr;
    IGameplayDialogGate* dialog = nullptr;
    IRuntimeProfilerSink* profiler = nullptr;
};

class GameplaySession {
public:
    using BootStepFn = std::function<bool(const char*, bool)>;
    using SceneTransitionHandlerFn =
        std::function<void(const Modules::SceneTransitionResult&)>;

    explicit GameplaySession(Modules::VariableManager& variables);
    ~GameplaySession();

    // RU-02e-1: builds the simulation graph (Physics, SceneManager,
    // SceneMutationService, RuntimeEntityGateway, SceneLifecycleService,
    // World) in the same order and with the same internal wiring
    // Application::initSubsystems() used to perform directly. `bootStep`
    // preserves the existing boot-failure telemetry (same step names as
    // before: "physics", "scene_manager", "entity_gateway"). `onSceneTransition`
    // is the one callback that still needs to reach the host, since it
    // mutates Application::pendingSceneInvalidations_.
    bool initialize(PhysicsMode physicsMode,
                     const BootStepFn& bootStep,
                     SceneTransitionHandlerFn onSceneTransition);

    // Populates the remaining host-port/module pointers once GameAPI/LuaHost/
    // LogicRuntime exist (Application::initSubsystems(), after initialize()).
    void wireHostRefs(GameplayRuntimeRefs refs) { refs_ = refs; }

    World& world() { return *world_; }
    Modules::Physics& physics() { return *physics_; }
    Modules::SceneManager& sceneManager() { return *sceneManager_; }
    Modules::SceneMutationService& sceneMutation() { return *sceneMutation_; }
    Modules::RuntimeEntityGateway& entityGateway() { return *entityGateway_; }

    // RU-02d: dispatches one host-built input frame to Logic and Script
    // through the same immutable snapshot, then flushes queued destroys and
    // (if not dialog-blocked) GameAPI's own input handlers - exactly the
    // responsibilities the plan assigns to this method (RU02_GAMEPLAY_
    // SESSION_REFACTOR.md, RU-02d "Sessione"). No Input::poll() call and no
    // Raylib key lookup happen in here - the host already resolved
    // pressed/released/held into `input` before calling this.
    void dispatchInput(const GameplayInputFrame& input);

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

    // RU-02e-1: tears down the simulation graph in the exact relative order
    // Application::shutdownModules() used (world -> gateway -> lifecycle ->
    // mutation -> scene manager). Physics shuts down separately via
    // shutdownPhysics() since the original order interleaves it after
    // Application-owned audio/input, not contiguously with the rest of the
    // graph.
    void shutdownGraph();
    void shutdownPhysics();

private:
    void dispatchGameplayCollisionTransitions();

    Modules::VariableManager& variables_;

    std::unique_ptr<Modules::Physics> physics_;
    std::unique_ptr<Modules::SceneManager> sceneManager_;
    std::unique_ptr<Modules::SceneMutationService> sceneMutation_;
    std::unique_ptr<Modules::RuntimeEntityGateway> entityGateway_;
    std::unique_ptr<Modules::SceneLifecycleService> sceneLifecycle_;
    std::unique_ptr<World> world_;

    GameplayRuntimeRefs refs_{};
    PhysicsMode physicsMode_ = PhysicsMode::Auto;
    std::set<std::pair<EntityId, EntityId>> activeGameplayCollisionPairs_;
};

} // namespace ArtCade

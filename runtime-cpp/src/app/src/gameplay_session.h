#pragma once

// RU-02c/RU-02e-1/RU-02e-2/RU-02e-3 (docs/RU02_GAMEPLAY_SESSION_REFACTOR.md,
// editor repo): the gameplay tick algorithm moved verbatim out of
// Application::tickFixedStep / Application::dispatchGameplayCollisionTransitions
// (RU-02c), then the simulation graph (Physics/SceneManager/
// SceneMutationService/RuntimeEntityGateway/SceneLifecycleService/World)
// moved into this class's own composition root, `initialize()` (RU-02e-1),
// then RuntimeLogicHostAdapter/LogicRuntime/GameAPI/LuaHost moved in too via
// `initializeGameplayModules()` (RU-02e-2), then ScriptRuntime - reconstructed
// per-scene, unlike every other module here which is boot-time-stable - moved
// in via `resetScriptRuntime()`/`clearScriptRuntime()` (RU-02e-3). Every
// module the RU-02e gate names ("World/gateway/Logic/Script costruiti
// soltanto dalla sessione") is now session-owned.

#include "gameplay_host_ports.h"

#include "../../core/gameplay-runtime-host.h"
#include "../../core/types.h"
#include "../../modules/scene-system/include/scene-lifecycle-result.h"

#include <functional>
#include <memory>
#include <set>
#include <type_traits>
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
class Input;
class Audio;
} // namespace ArtCade::Modules

namespace ArtCade::Logic {
class LogicRuntime;
} // namespace ArtCade::Logic

namespace ArtCade::Scripts {
class ScriptRuntime;
} // namespace ArtCade::Scripts

namespace ArtCade {

class World;
struct EngineContext;

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

// RU-02e-2: minimal stand-in kept in its own translation unit-visible spot
// (moved verbatim from app_modules.h, previously private to the `game`
// executable target) so GameplaySession can own an instance directly.
// Forwards transform/platformer/animation/variable/destroy calls to
// World/RuntimeEntityGateway/VariableManager/Input/Physics - method bodies
// live in gameplay_session.cpp, where those concrete headers are already
// fully included; only reference/pointer members are declared here, so this
// header itself does not need their complete definitions.
class RuntimeLogicHostAdapter final : public IGameplayRuntimeHost {
public:
    using SpawnInstaller = std::function<bool(EntityId)>;

    RuntimeLogicHostAdapter(Modules::RuntimeEntityGateway& gateway, Modules::Audio& audio);

    /** World is constructed after this adapter; wired in once available. */
    void setWorld(World* world) { world_ = world; }
    void setVariableManager(Modules::VariableManager* variables) { variables_ = variables; }
    void setInput(Modules::Input* input) { input_ = input; }
    void setPhysics(Modules::Physics* physics) { physics_ = physics; }
    void setSpawnInstaller(SpawnInstaller installer) { spawnInstaller_ = std::move(installer); }

    bool setVisible(EntityId owner, bool value) override;
    bool isVisible(EntityId owner) override;
    bool setPosition(EntityId owner, Vec2 value) override;
    bool translate(EntityId owner, Vec2 delta) override;
    bool setRotation(EntityId owner, float radians) override;
    bool rotateBy(EntityId owner, float deltaRadians) override;
    bool setScale(EntityId owner, Vec2 scale) override;
    bool isGrounded(EntityId owner) override;
    bool isFalling(EntityId owner) override;
    bool requestPlatformerMove(EntityId owner, float axis) override;
    bool requestPlatformerJump(EntityId owner) override;
    bool isObjectType(EntityId entity, const ObjectTypeId& expected) override;
    bool requestDestroy(EntityId owner) override;
    bool playAnimationClip(EntityId owner, const AssetId& animationAssetId,
                           const std::string& clipId) override;
    bool stopAnimation(EntityId owner) override;
    bool setAnimationPlaybackSpeed(EntityId owner, float speed) override;
    bool playSound(EntityId owner, const AssetId& audioAssetId, float volume) override;
    bool setStateNumber(const GameVariableId& id, double value) override;
    bool addStateNumber(const GameVariableId& id, double delta) override;
    bool toggleStateBoolean(const GameVariableId& id) override;
    std::optional<double> getStateNumber(const GameVariableId& id) const override;
    bool setVelocity(EntityId owner, Vec2 velocity) override;
    bool isKeyDown(LogicKey key) override;
    EntityId spawnObjectType(EntityId owner, const ObjectTypeId& objectTypeId,
                             float x, float y) override;

private:
    Modules::RuntimeEntityGateway& gateway_;
    Modules::Audio& audio_;
    World* world_ = nullptr;
    Modules::VariableManager* variables_ = nullptr;
    Modules::Input* input_ = nullptr;
    Modules::Physics* physics_ = nullptr;
    SpawnInstaller spawnInstaller_;
};

// RU-02e-1/2: world/physics/gateway/logic/gameApi/luaHost are no longer
// references or pointers here - they are owned by GameplaySession directly
// (see private members below). The remaining fields stay pointer-based
// (nullptr default) so this struct is default-constructible, which lets
// GameplaySession be constructed early (before these modules exist) and
// wired up later via wireHostRefs().
struct GameplayRuntimeRefs {
    Modules::TimeManager* time = nullptr;
    Modules::TweenManager* tweens = nullptr;
    Modules::SpriteAnimator* animator = nullptr;
    Modules::CameraManager* camera = nullptr;
    Modules::GameStateManager* gameState = nullptr;
    Modules::EventBus* events = nullptr;
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

    // RU-02e-2: builds RuntimeLogicHostAdapter, LogicRuntime, GameAPI and
    // LuaHost, in the same order and with the same internal wiring
    // Application::initSubsystems() used to perform directly. `ctx` is
    // Application's own EngineContext (still host-owned - GameAPI needs it
    // fully populated with renderer/physics/input/audio/etc. by this point);
    // this method only sets `ctx.gameAPI`/`ctx.luaHost`, mirroring what
    // Application used to do right after constructing each. `audio`/`input`
    // are the two Application-owned modules RuntimeLogicHostAdapter needs.
    // `spawnInstaller` still needs to reach Application (installLogicScopeForEntity
    // touches mod_->logicScopes/logicObjectTypes, RU-02e-3 territory).
    bool initializeGameplayModules(EngineContext& ctx,
                                    Modules::Audio& audio,
                                    Modules::Input& input,
                                    RuntimeLogicHostAdapter::SpawnInstaller spawnInstaller,
                                    const BootStepFn& bootStep);

    // Populates the remaining host-port pointers Application still owns
    // outright (Application::initSubsystems(), after
    // initializeGameplayModules()).
    void wireHostRefs(GameplayRuntimeRefs refs) { refs_ = refs; }

    World& world() { return *world_; }
    Modules::Physics& physics() { return *physics_; }
    Modules::SceneManager& sceneManager() { return *sceneManager_; }
    Modules::SceneMutationService& sceneMutation() { return *sceneMutation_; }
    Modules::RuntimeEntityGateway& entityGateway() { return *entityGateway_; }
    RuntimeLogicHostAdapter& logicHost() { return *logicHost_; }
    Logic::LogicRuntime& logicRuntime() { return *logicRuntime_; }
    Modules::GameAPI& gameAPI() { return *gameAPI_; }
    Modules::LuaHost& luaHost() { return *luaHost_; }

    // RU-02d: dispatches one host-built input frame to Logic and Script
    // through the same immutable snapshot, then flushes queued destroys and
    // (if not dialog-blocked) GameAPI's own input handlers - exactly the
    // responsibilities the plan assigns to this method (RU02_GAMEPLAY_
    // SESSION_REFACTOR.md, RU-02d "Sessione"). No Input::poll() call and no
    // Raylib key lookup happen in here - the host already resolved
    // pressed/released/held into `input` before calling this.
    void dispatchInput(const GameplayInputFrame& input);

    void tickFixedStep(float dt);

    // RU-02e-3: ScriptRuntime is reconstructed at project-load and
    // scene-lifecycle time (app_project_lifecycle.cpp
    // installScriptScopesForActiveScene), unlike every other module here,
    // which is boot-time-stable - the session now owns it directly instead of
    // borrowing an Application-built instance. Discards any previous
    // instance, builds a fresh one bound to the session's own logicHost(),
    // and returns it so the caller can install scopes against it.
    Scripts::ScriptRuntime& resetScriptRuntime();
    // Install failure path: destroys the just-built instance without
    // replacing it (mirrors the old mod_->scriptRuntime.reset() +
    // setScriptRuntime(nullptr) pair on that path).
    void clearScriptRuntime() { scriptRuntime_.reset(); }

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

    // RU-02e-2: mirrors the same "don't collapse into one call" lesson -
    // Application-owned dialogManager shutdown sits in between the original
    // logicRuntime/logicHost and luaHost/gameAPI shutdown lines, so two
    // granular methods preserve that exact interleaving. shutdownScriptRuntime()
    // (RU-02e-3) is its own call too, since it used to sit between them.
    void shutdownLogicModules();
    void shutdownScriptRuntime();
    void shutdownScriptingModules();

private:
    void dispatchGameplayCollisionTransitions();

    Modules::VariableManager& variables_;

    std::unique_ptr<Modules::Physics> physics_;
    std::unique_ptr<Modules::SceneManager> sceneManager_;
    std::unique_ptr<Modules::SceneMutationService> sceneMutation_;
    std::unique_ptr<Modules::RuntimeEntityGateway> entityGateway_;
    std::unique_ptr<Modules::SceneLifecycleService> sceneLifecycle_;
    std::unique_ptr<World> world_;

    std::unique_ptr<RuntimeLogicHostAdapter> logicHost_;
    std::unique_ptr<Logic::LogicRuntime> logicRuntime_;
    std::unique_ptr<Modules::GameAPI> gameAPI_;
    std::unique_ptr<Modules::LuaHost> luaHost_;
    std::unique_ptr<Scripts::ScriptRuntime> scriptRuntime_;

    GameplayRuntimeRefs refs_{};
    PhysicsMode physicsMode_ = PhysicsMode::Auto;
    std::set<std::pair<EntityId, EntityId>> activeGameplayCollisionPairs_;
};

static_assert(!std::is_abstract_v<RuntimeLogicHostAdapter>,
              "RuntimeLogicHostAdapter must implement every IGameplayRuntimeHost method");

} // namespace ArtCade

#include "gameplay_session.h"

#include "../../core/engine-context.h"
#include "../../modules/audio/include/audio.h"
#include "../../modules/camera-manager/include/camera-manager.h"
#include "../../modules/event-bus/include/event-bus.h"
#include "../../modules/game-api/include/game-api.h"
#include "../../modules/game-state/include/game-state-manager.h"
#include "../../modules/input/include/input.h"
#include "../../modules/logic-core/include/logic-core.h"
#include "../../modules/logic-runtime/include/logic-runtime.h"
#include "../../modules/lua-runtime/include/lua-host.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/scene-system/include/scene-lifecycle-service.h"
#include "../../modules/scene-system/include/scene-manager.h"
#include "../../modules/scene-system/include/scene-mutation-service.h"
#include "../../modules/script-runtime/include/script-runtime.h"
#include "../../modules/sprite-animator/include/sprite-animator.h"
#include "../../modules/time/include/time-manager.h"
#include "../../modules/tween-manager/include/tween-manager.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../world/include/world.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <iostream>

namespace ArtCade {

namespace {

using Clock = std::chrono::steady_clock;

double elapsedMs(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}

} // namespace

// RU-02e-2: moved verbatim from app_modules.h (previously private to the
// `game` executable target's Application::Modules) - method bodies unchanged,
// only the declaring header moved so GameplaySession can own an instance.
RuntimeLogicHostAdapter::RuntimeLogicHostAdapter(
    Modules::RuntimeEntityGateway& gateway, Modules::Audio& audio)
    : gateway_(gateway), audio_(audio) {}

bool RuntimeLogicHostAdapter::setVisible(EntityId owner, bool value) {
    return gateway_.setRuntimeVisible(owner, value);
}
bool RuntimeLogicHostAdapter::isVisible(EntityId owner) {
    return gateway_.visibleInGame(owner);
}
bool RuntimeLogicHostAdapter::setPosition(EntityId owner, Vec2 value) {
    Transform transform{};
    if (!gateway_.getTransform(owner, transform)) return false;
    transform.position = value;
    return gateway_.setTransform(owner, transform);
}
bool RuntimeLogicHostAdapter::translate(EntityId owner, Vec2 delta) {
    if (!std::isfinite(delta.x) || !std::isfinite(delta.y)) return false;
    Transform transform{};
    if (!gateway_.getTransform(owner, transform)) return false;
    transform.position.x += delta.x;
    transform.position.y += delta.y;
    return gateway_.setTransform(owner, transform);
}
bool RuntimeLogicHostAdapter::setRotation(EntityId owner, float radians) {
    if (!std::isfinite(radians)) return false;
    Transform transform{};
    if (!gateway_.getTransform(owner, transform)) return false;
    transform.rotation = radians;
    return gateway_.setTransform(owner, transform);
}
bool RuntimeLogicHostAdapter::rotateBy(EntityId owner, float deltaRadians) {
    if (!std::isfinite(deltaRadians)) return false;
    Transform transform{};
    if (!gateway_.getTransform(owner, transform)) return false;
    transform.rotation += deltaRadians;
    return gateway_.setTransform(owner, transform);
}
bool RuntimeLogicHostAdapter::setScale(EntityId owner, Vec2 scale) {
    if (!std::isfinite(scale.x) || !std::isfinite(scale.y)
        || scale.x <= 0.f || scale.y <= 0.f) {
        return false;
    }
    Transform transform{};
    if (!gateway_.getTransform(owner, transform)) return false;
    transform.scale = scale;
    return gateway_.setTransform(owner, transform);
}
bool RuntimeLogicHostAdapter::isGrounded(EntityId owner) {
    return world_ && world_->isPlatformerGrounded(owner);
}
bool RuntimeLogicHostAdapter::isFalling(EntityId owner) {
    return world_ && world_->isPlatformerFalling(owner);
}
bool RuntimeLogicHostAdapter::requestPlatformerMove(EntityId owner, float axis) {
    PlatformerControllerComponent platformer{};
    if (!world_ || !std::isfinite(axis)
        || !gateway_.getPlatformerController(owner, platformer)) return false;
    world_->setMovementIntent(owner, axis, 0.f);
    return true;
}
bool RuntimeLogicHostAdapter::requestPlatformerJump(EntityId owner) {
    PlatformerControllerComponent platformer{};
    if (!world_ || !gateway_.getPlatformerController(owner, platformer)) return false;
    world_->requestJump(owner);
    return true;
}
bool RuntimeLogicHostAdapter::isObjectType(EntityId entity, const ObjectTypeId& expected) {
    return world_ && world_->isObjectType(entity, expected);
}
bool RuntimeLogicHostAdapter::requestDestroy(EntityId owner) {
    return world_ && world_->requestDestroy(owner);
}
bool RuntimeLogicHostAdapter::playAnimationClip(
    EntityId owner, const AssetId& animationAssetId, const std::string& clipId) {
    return world_ && world_->playAnimationClip(owner, animationAssetId, clipId);
}
bool RuntimeLogicHostAdapter::stopAnimation(EntityId owner) {
    return world_ && world_->stopAnimation(owner);
}
bool RuntimeLogicHostAdapter::setAnimationPlaybackSpeed(EntityId owner, float speed) {
    return world_ && world_->setAnimationPlaybackSpeed(owner, speed);
}
bool RuntimeLogicHostAdapter::playSound(
    EntityId owner, const AssetId& audioAssetId, float volume) {
    return world_ && world_->isActiveEntity(owner)
        && audio_.playResolvedAsset(audioAssetId, volume);
}
bool RuntimeLogicHostAdapter::setStateNumber(const GameVariableId& id, double value) {
    if (!variables_) return false;
    return variables_->setGlobal(id, value).accepted();
}
bool RuntimeLogicHostAdapter::addStateNumber(const GameVariableId& id, double delta) {
    if (!variables_) return false;
    return variables_->addNumber(id, delta).accepted();
}
bool RuntimeLogicHostAdapter::toggleStateBoolean(const GameVariableId& id) {
    if (!variables_) return false;
    return variables_->toggleBoolean(id).accepted();
}
std::optional<double> RuntimeLogicHostAdapter::getStateNumber(const GameVariableId& id) const {
    if (!variables_) return std::nullopt;
    return variables_->tryGetNumber(id);
}
bool RuntimeLogicHostAdapter::setVelocity(EntityId owner, Vec2 velocity) {
    if (!std::isfinite(velocity.x) || !std::isfinite(velocity.y)) return false;
    Transform transform{};
    if (!gateway_.getTransform(owner, transform)) return false;
    transform.velocity = velocity;
    if (!gateway_.setTransform(owner, transform)) return false;
    const uint32_t handle = gateway_.physicsHandle(owner);
    if (handle != 0 && physics_) physics_->setLinearVelocity(handle, velocity);
    return true;
}
bool RuntimeLogicHostAdapter::isKeyDown(LogicKey key) {
    return input_ && input_->isKeyDown(Logic::logicInputCode(key));
}
EntityId RuntimeLogicHostAdapter::spawnObjectType(
    EntityId owner, const ObjectTypeId& objectTypeId, float x, float y) {
    if (!world_ || !world_->isActiveEntity(owner) || objectTypeId.empty())
        return INVALID_ENTITY;
    if (!std::isfinite(x) || !std::isfinite(y)) return INVALID_ENTITY;
    const EntityId spawned = gateway_.spawnFromClass(objectTypeId, x, y);
    if (spawned == INVALID_ENTITY) return INVALID_ENTITY;
    // Installer must succeed when present; otherwise destroy the orphan and fail.
    if (spawnInstaller_ && !spawnInstaller_(spawned)) {
        gateway_.destroy(spawned);
        return INVALID_ENTITY;
    }
    return spawned;
}

GameplaySession::GameplaySession(Modules::VariableManager& variables)
    : variables_(variables) {}

// unique_ptr members need complete types at destruction; every module they
// point to is fully defined above by the time this runs.
GameplaySession::~GameplaySession() = default;

// RU-02e-1: lines moved from Application::initSubsystems() (app_bootstrap.cpp)
// in the same relative order, same boot-step names, same wiring - only the
// two SceneLifecycleService handlers that used to capture Application state
// (`gw = mod_->entityGateway.get()`) now capture `this` (GameplaySession),
// per the plan's callback rule (RU02_GAMEPLAY_SESSION_REFACTOR.md RU-02e:
// "Callback: non devono più catturare Application per modificare oggetti
// posseduti dalla sessione"). `onSceneTransition` still reaches the host,
// since it mutates Application::pendingSceneInvalidations_.
bool GameplaySession::initialize(PhysicsMode physicsMode,
                                  const BootStepFn& bootStep,
                                  SceneTransitionHandlerFn onSceneTransition) {
    physicsMode_ = physicsMode;

    physics_ = std::make_unique<Modules::Physics>();
    if (!bootStep("physics", physics_->init())) return false;

    sceneManager_ = std::make_unique<Modules::SceneManager>();
    if (!bootStep("scene_manager", sceneManager_->init())) return false;

    sceneMutation_ = std::make_unique<Modules::SceneMutationService>(*sceneManager_);

    entityGateway_ = std::make_unique<Modules::RuntimeEntityGateway>(*sceneManager_);
    if (!bootStep("entity_gateway", entityGateway_->init())) return false;

    sceneLifecycle_ = std::make_unique<Modules::SceneLifecycleService>(
        *sceneManager_,
        *sceneMutation_,
        [this]() { entityGateway_->syncSceneActivation(); });
    sceneLifecycle_->set_transition_handler(std::move(onSceneTransition));
    entityGateway_->set_scene_lifecycle_service(sceneLifecycle_.get());

    world_ = std::make_unique<World>(*entityGateway_, *physics_, variables_);
    entityGateway_->setPhysics(physics_.get());

    sceneLifecycle_->set_gameplay_reset_handler([this]() {
        world_->onSceneActivated();
    });
    sceneLifecycle_->set_restore_handler([this](const SceneId& sceneId) {
        return entityGateway_->restoreSceneFromAuthoring(sceneId);
    });
    world_->setSceneLifecycleService(sceneLifecycle_.get());

    return true;
}

// RU-02e-2: lines moved from Application::initSubsystems() (app_bootstrap.cpp)
// in the same relative order, same boot-step names, same wiring. `ctx` is
// Application's own EngineContext, already populated with everything the
// simulation graph above wires (renderer/physics/input/audio/sceneManager/
// entityGateway/assetLoader/world/dialogManager/...) by the time this runs -
// this method only ever writes ctx.gameAPI/ctx.luaHost, exactly like
// Application used to right after constructing each.
bool GameplaySession::initializeGameplayModules(
    EngineContext& ctx,
    Modules::Audio& audio,
    Modules::Input& input,
    RuntimeLogicHostAdapter::SpawnInstaller spawnInstaller,
    const BootStepFn& bootStep) {
    logicHost_ = std::make_unique<RuntimeLogicHostAdapter>(*entityGateway_, audio);
    logicRuntime_ = std::make_unique<Logic::LogicRuntime>(*logicHost_);

    logicHost_->setWorld(world_.get());
    logicHost_->setVariableManager(&variables_);
    logicHost_->setInput(&input);
    logicHost_->setPhysics(physics_.get());
    logicHost_->setSpawnInstaller(std::move(spawnInstaller));

    gameAPI_ = std::make_unique<Modules::GameAPI>(ctx);
    if (!bootStep("game_api", gameAPI_->init())) return false;
    ctx.gameAPI = gameAPI_.get();

    luaHost_ = std::make_unique<Modules::LuaHost>();
    luaHost_->registerBindings([this](sol::state& lua) {
        gameAPI_->registerAll(lua);
    });
    if (!bootStep("lua_host", luaHost_->init())) return false;
    ctx.luaHost = luaHost_.get();

    return true;
}

// RU-02e-3: replaces the old Application-side
// `mod_->scriptRuntime = std::make_unique<Scripts::ScriptRuntime>(*mod_->logicHost)`
// - same construction, now against the session's own logicHost_ instead of a
// borrowed pointer, and no separate setScriptRuntime() sync call needed since
// this class already owns the pointer it dispatches through.
Scripts::ScriptRuntime& GameplaySession::resetScriptRuntime() {
    scriptRuntime_ = std::make_unique<Scripts::ScriptRuntime>(*logicHost_);
    return *scriptRuntime_;
}

void GameplaySession::shutdownGraph() {
    if (world_) { world_->shutdown(); world_.reset(); }
    if (entityGateway_) {
        entityGateway_->set_scene_lifecycle_service(nullptr);
        entityGateway_->shutdown();
        entityGateway_.reset();
    }
    if (sceneLifecycle_) {
        sceneLifecycle_->cancel_transition();
        sceneLifecycle_.reset();
    }
    sceneMutation_.reset();
    if (sceneManager_) { sceneManager_->shutdown(); sceneManager_.reset(); }
}

void GameplaySession::shutdownPhysics() {
    if (physics_) { physics_->shutdown(); physics_.reset(); }
}

// RU-02e-2: matches Application::shutdownModules()'s original logicRuntime
// shutdown/reset immediately followed by logicHost.reset() (no explicit
// shutdown() call on logicHost - it never held resources beyond references).
void GameplaySession::shutdownLogicModules() {
    if (logicRuntime_) { logicRuntime_->shutdown(); logicRuntime_.reset(); }
    logicHost_.reset();
}

// RU-02e-3: matches the original Application-side
// `if (mod_->scriptRuntime) { mod_->scriptRuntime->shutdown(); mod_->scriptRuntime.reset(); }`,
// which used to sit between logicHost.reset() and luaHost's shutdown.
void GameplaySession::shutdownScriptRuntime() {
    if (scriptRuntime_) { scriptRuntime_->shutdown(); scriptRuntime_.reset(); }
}

// RU-02e-2: matches the original luaHost shutdown/reset immediately followed
// by gameAPI shutdown/reset.
void GameplaySession::shutdownScriptingModules() {
    if (luaHost_) { luaHost_->shutdown(); luaHost_.reset(); }
    if (gameAPI_) { gameAPI_->shutdown(); gameAPI_.reset(); }
}

// Moved from Application::loopIteration's input block (app_loop.cpp,
// pre-RU-02d). One structural change from the original, both sanctioned by
// the frame itself being category-shaped rather than per-key (RU-02d's own
// GameplayInputFrame): the original iterated Logic::supportedLogicKeys()
// once and handled pressed/released/held for each key together, in that
// interleaved order; here every pressed key dispatches before any released
// key, which dispatches before any held key. LogicRuntime::dispatch() and
// ScriptInputSnapshot both filter/normalize per (kind, key) independently of
// any other key, so this does not change what fires for a given key - only
// the relative order across *different* keys within the same frame, which
// nothing in this codebase currently depends on.
void GameplaySession::dispatchInput(const GameplayInputFrame& input) {
    if (logicRuntime_) logicRuntime_->beginFrame();
    Scripts::ScriptInputSnapshot scriptInput;
    for (LogicKey key : input.pressed) {
        if (logicRuntime_) logicRuntime_->dispatchKeyPressed(key);
        scriptInput.pressed.push_back(key);
    }
    for (LogicKey key : input.released) {
        if (logicRuntime_) logicRuntime_->dispatchKeyReleased(key);
        scriptInput.released.push_back(key);
    }
    for (LogicKey key : input.held) {
        if (logicRuntime_) logicRuntime_->dispatchKeyHeld(key);
        scriptInput.held.push_back(key);
    }
    if (scriptRuntime_) scriptRuntime_->dispatchInput(scriptInput);
    // Both languages consumed the same immutable input frame; queued
    // destroys may now commit before any fixed-step update.
    world_->flushEntityQueues();

    if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
        const auto start = Clock::now();
        const std::uint32_t events = gameAPI_->dispatchInputEvents();
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(events);
        }
    }
}

// Moved verbatim from Application::dispatchGameplayCollisionTransitions
// (app_loop.cpp) - only mod_->X became refs_.X/world_->X and the
// collision-pair state moved from Application::Modules into this class.
void GameplaySession::dispatchGameplayCollisionTransitions() {
    std::set<std::pair<EntityId, EntityId>> current;
    for (const CollisionWorld::ContactEvent& event : world_->collisionEvents()) {
        if (event.kind == CollisionWorld::ContactEvent::Kind::Exit
            || event.self == INVALID_ENTITY || event.other == INVALID_ENTITY
            || event.self == event.other
            || !world_->isActiveEntity(event.self)
            || !world_->isActiveEntity(event.other)) continue;
        current.emplace(std::min(event.self, event.other),
                        std::max(event.self, event.other));
    }

    std::set<std::pair<EntityId, EntityId>> entered;
    std::set<std::pair<EntityId, EntityId>> exited;
    for (const auto& pair : current)
        if (activeGameplayCollisionPairs_.count(pair) == 0) entered.insert(pair);
    for (const auto& pair : activeGameplayCollisionPairs_)
        if (current.count(pair) == 0) exited.insert(pair);

    const std::vector<EntityId> structuralOrder = entityGateway_->activeSceneIds();
    const auto dispatch = [&](const auto& edges, bool enter, auto invoke) {
        for (EntityId owner : structuralOrder) {
            for (const auto& pair : edges) {
                EntityId other = INVALID_ENTITY;
                if (pair.first == owner) other = pair.second;
                else if (pair.second == owner) other = pair.first;
                if (other != INVALID_ENTITY) invoke(owner, other, enter);
            }
        }
    };

    // One immutable entity-pair snapshot: every generated board runs before
    // any manual attachment, both in scene structural order.
    if (logicRuntime_) {
        dispatch(entered, true, [&](EntityId owner, EntityId other, bool) {
            logicRuntime_->dispatchCollisionEnter(owner, other);
        });
        dispatch(exited, false, [&](EntityId owner, EntityId other, bool) {
            logicRuntime_->dispatchCollisionExit(owner, other);
        });
    }
    if (scriptRuntime_) {
        dispatch(entered, true, [&](EntityId owner, EntityId other, bool) {
            scriptRuntime_->dispatchCollisionEnter(owner, other);
        });
        dispatch(exited, false, [&](EntityId owner, EntityId other, bool) {
            scriptRuntime_->dispatchCollisionExit(owner, other);
        });
    }
    activeGameplayCollisionPairs_ = std::move(current);
}

// Moved verbatim from Application::tickFixedStep (app_loop.cpp), post RU-02b
// (clearDrawQueue/splash already extracted to the host). mod_->X became
// refs_.X (now dereferenced through pointers) or world_/physics_/
// entityGateway_/logicRuntime_/gameAPI_/luaHost_ ->X for the members this
// class now owns directly (RU-02e-1/2).
void GameplaySession::tickFixedStep(float dt) {
    {
        const auto start = Clock::now();
        refs_.time->tick(dt);
        refs_.tweens->update(dt);
        refs_.animator->update(dt);
        refs_.camera->updateMotion(dt);
        refs_.gameState->update(dt);
        refs_.events->flushDeferred();
        if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
            world_->tickGameplaySystems(dt);
            entityGateway_->tickSceneTransition(dt);
        }
        if (refs_.profiler) refs_.profiler->addGameplayMs(elapsedMs(start));
    }
    // Drain animator events once; feed Logic Runtime then GameAPI Lua handlers.
    {
        const auto finished = refs_.animator->pollFinished();
        const auto events = refs_.animator->pollEvents();
        if (logicRuntime_) {
            for (const auto& ev : events) {
                if (ev.kind == Modules::SpriteAnimator::AnimEventKind::Start)
                    logicRuntime_->dispatchAnimationStarted(ev.entityId);
            }
            for (const auto& ev : finished)
                logicRuntime_->dispatchAnimationFinished(ev.entityId);
            logicRuntime_->dispatchTick(dt);
        }
        const auto start = Clock::now();
        const std::uint32_t luaEvents = gameAPI_->dispatchAnimationEvents(finished, events);
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(luaEvents);
        }
    }
    {
        const auto start = Clock::now();
        luaHost_->tick(dt);
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->setLuaTickEnabled(luaHost_->isScriptTickRequired());
        }
    }
    // Manual on_update runs after generated input rules and before platformer
    // integration, so its movement intent can deliberately override the board.
    if (scriptRuntime_) {
        scriptRuntime_->update(dt);
        world_->flushEntityQueues();
    }
    if (refs_.dialog) refs_.dialog->tick(dt);

    if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
        world_->tickPlatformerControllers(dt);
        world_->tickSimpleMovementIntents(dt);
    }
    const bool runPhysics = physicsMode_ == PhysicsMode::On
        || (physicsMode_ == PhysicsMode::Auto && physics_->hasActiveBodies());
    if (runPhysics) {
        const auto start = Clock::now();
        physics_->step(dt);
        if (refs_.profiler) refs_.profiler->addPhysicsMs(elapsedMs(start));
    }

    world_->flushEntityQueues();
    if (runPhysics) world_->syncPhysicsToEntities();
    world_->tickCameraTargets(dt);

    world_->refreshCollisionEvents();

    {
        const auto start = Clock::now();
        const std::uint32_t events = gameAPI_->dispatchLifecycleEvents();
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(events);
        }
    }

    world_->tickAutoDestroy(dt);
    {
        const auto start = Clock::now();
        world_->flushEntityQueues();
        if (refs_.profiler) refs_.profiler->addGameplayMs(elapsedMs(start));
    }
    {
        const auto start = Clock::now();
        const std::uint32_t events = gameAPI_->dispatchLifecycleEvents();
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(events);
        }
    }
    dispatchGameplayCollisionTransitions();

    // Drain errors from input/update/collision callbacks once the fixed-step
    // lifecycle has reached a stable post-dispatch boundary.
    if (scriptRuntime_) {
        for (const auto& diagnostic : scriptRuntime_->drainDiagnostics()) {
            std::cerr << "[Script] " << diagnostic.sourcePath;
            if (diagnostic.line > 0) std::cerr << ":" << diagnostic.line;
            std::cerr << " [" << diagnostic.callback << "] entity "
                      << diagnostic.owner << ": " << diagnostic.message << "\n";
        }
    }

    refs_.events->flushDeferred();
    if (refs_.audio) refs_.audio->update();
}

} // namespace ArtCade

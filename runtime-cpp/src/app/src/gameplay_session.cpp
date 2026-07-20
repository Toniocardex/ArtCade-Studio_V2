#include "gameplay_session.h"

#include "../../modules/camera-manager/include/camera-manager.h"
#include "../../modules/event-bus/include/event-bus.h"
#include "../../modules/game-api/include/game-api.h"
#include "../../modules/game-state/include/game-state-manager.h"
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
#include "../../world/include/world.h"

#include <algorithm>
#include <chrono>
#include <iostream>

namespace ArtCade {

namespace {

using Clock = std::chrono::steady_clock;

double elapsedMs(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}

} // namespace

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
    if (refs_.logic) refs_.logic->beginFrame();
    Scripts::ScriptInputSnapshot scriptInput;
    for (LogicKey key : input.pressed) {
        if (refs_.logic) refs_.logic->dispatchKeyPressed(key);
        scriptInput.pressed.push_back(key);
    }
    for (LogicKey key : input.released) {
        if (refs_.logic) refs_.logic->dispatchKeyReleased(key);
        scriptInput.released.push_back(key);
    }
    for (LogicKey key : input.held) {
        if (refs_.logic) refs_.logic->dispatchKeyHeld(key);
        scriptInput.held.push_back(key);
    }
    if (refs_.scripts) refs_.scripts->dispatchInput(scriptInput);
    // Both languages consumed the same immutable input frame; queued
    // destroys may now commit before any fixed-step update.
    world_->flushEntityQueues();

    if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
        const auto start = Clock::now();
        const std::uint32_t events = refs_.gameApi->dispatchInputEvents();
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
    if (refs_.logic) {
        dispatch(entered, true, [&](EntityId owner, EntityId other, bool) {
            refs_.logic->dispatchCollisionEnter(owner, other);
        });
        dispatch(exited, false, [&](EntityId owner, EntityId other, bool) {
            refs_.logic->dispatchCollisionExit(owner, other);
        });
    }
    if (refs_.scripts) {
        dispatch(entered, true, [&](EntityId owner, EntityId other, bool) {
            refs_.scripts->dispatchCollisionEnter(owner, other);
        });
        dispatch(exited, false, [&](EntityId owner, EntityId other, bool) {
            refs_.scripts->dispatchCollisionExit(owner, other);
        });
    }
    activeGameplayCollisionPairs_ = std::move(current);
}

// Moved verbatim from Application::tickFixedStep (app_loop.cpp), post RU-02b
// (clearDrawQueue/splash already extracted to the host). mod_->X became
// refs_.X (now dereferenced through pointers) or world_/physics_/
// entityGateway_->X for the members this class now owns directly (RU-02e-1).
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
        if (refs_.logic) {
            for (const auto& ev : events) {
                if (ev.kind == Modules::SpriteAnimator::AnimEventKind::Start)
                    refs_.logic->dispatchAnimationStarted(ev.entityId);
            }
            for (const auto& ev : finished)
                refs_.logic->dispatchAnimationFinished(ev.entityId);
            refs_.logic->dispatchTick(dt);
        }
        const auto start = Clock::now();
        const std::uint32_t luaEvents = refs_.gameApi->dispatchAnimationEvents(finished, events);
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(luaEvents);
        }
    }
    {
        const auto start = Clock::now();
        refs_.luaHost->tick(dt);
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->setLuaTickEnabled(refs_.luaHost->isScriptTickRequired());
        }
    }
    // Manual on_update runs after generated input rules and before platformer
    // integration, so its movement intent can deliberately override the board.
    if (refs_.scripts) {
        refs_.scripts->update(dt);
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
        const std::uint32_t events = refs_.gameApi->dispatchLifecycleEvents();
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
        const std::uint32_t events = refs_.gameApi->dispatchLifecycleEvents();
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(events);
        }
    }
    dispatchGameplayCollisionTransitions();

    // Drain errors from input/update/collision callbacks once the fixed-step
    // lifecycle has reached a stable post-dispatch boundary.
    if (refs_.scripts) {
        for (const auto& diagnostic : refs_.scripts->drainDiagnostics()) {
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

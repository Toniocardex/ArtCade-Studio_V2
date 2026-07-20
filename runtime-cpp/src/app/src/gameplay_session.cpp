#include "gameplay_session.h"

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
    refs_.world.flushEntityQueues();

    if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
        const auto start = Clock::now();
        const std::uint32_t events = refs_.gameApi.dispatchInputEvents();
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(events);
        }
    }
}

// Moved verbatim from Application::dispatchGameplayCollisionTransitions
// (app_loop.cpp) - only mod_->X became refs_.X and the collision-pair state
// moved from Application::Modules into this class.
void GameplaySession::dispatchGameplayCollisionTransitions() {
    std::set<std::pair<EntityId, EntityId>> current;
    for (const CollisionWorld::ContactEvent& event : refs_.world.collisionEvents()) {
        if (event.kind == CollisionWorld::ContactEvent::Kind::Exit
            || event.self == INVALID_ENTITY || event.other == INVALID_ENTITY
            || event.self == event.other
            || !refs_.world.isActiveEntity(event.self)
            || !refs_.world.isActiveEntity(event.other)) continue;
        current.emplace(std::min(event.self, event.other),
                        std::max(event.self, event.other));
    }

    std::set<std::pair<EntityId, EntityId>> entered;
    std::set<std::pair<EntityId, EntityId>> exited;
    for (const auto& pair : current)
        if (activeGameplayCollisionPairs_.count(pair) == 0) entered.insert(pair);
    for (const auto& pair : activeGameplayCollisionPairs_)
        if (current.count(pair) == 0) exited.insert(pair);

    const std::vector<EntityId> structuralOrder = refs_.gateway.activeSceneIds();
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
// refs_.X; profiler_.X/mod_->audio->X became refs_.profiler->X/refs_.audio->X
// through the new host ports, null-guarded like the pre-existing optional
// modules (logic/scripts/dialog) since Application passes them by pointer.
void GameplaySession::tickFixedStep(float dt) {
    {
        const auto start = Clock::now();
        refs_.time.tick(dt);
        refs_.tweens.update(dt);
        refs_.animator.update(dt);
        refs_.camera.updateMotion(dt);
        refs_.gameState.update(dt);
        refs_.events.flushDeferred();
        if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
            refs_.world.tickGameplaySystems(dt);
            refs_.gateway.tickSceneTransition(dt);
        }
        if (refs_.profiler) refs_.profiler->addGameplayMs(elapsedMs(start));
    }
    // Drain animator events once; feed Logic Runtime then GameAPI Lua handlers.
    {
        const auto finished = refs_.animator.pollFinished();
        const auto events = refs_.animator.pollEvents();
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
        const std::uint32_t luaEvents = refs_.gameApi.dispatchAnimationEvents(finished, events);
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(luaEvents);
        }
    }
    {
        const auto start = Clock::now();
        refs_.luaHost.tick(dt);
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->setLuaTickEnabled(refs_.luaHost.isScriptTickRequired());
        }
    }
    // Manual on_update runs after generated input rules and before platformer
    // integration, so its movement intent can deliberately override the board.
    if (refs_.scripts) {
        refs_.scripts->update(dt);
        refs_.world.flushEntityQueues();
    }
    if (refs_.dialog) refs_.dialog->tick(dt);

    if (!refs_.dialog || !refs_.dialog->blocksGameplay()) {
        refs_.world.tickPlatformerControllers(dt);
        refs_.world.tickSimpleMovementIntents(dt);
    }
    const bool runPhysics = physicsMode_ == PhysicsMode::On
        || (physicsMode_ == PhysicsMode::Auto && refs_.physics.hasActiveBodies());
    if (runPhysics) {
        const auto start = Clock::now();
        refs_.physics.step(dt);
        if (refs_.profiler) refs_.profiler->addPhysicsMs(elapsedMs(start));
    }

    refs_.world.flushEntityQueues();
    if (runPhysics) refs_.world.syncPhysicsToEntities();
    refs_.world.tickCameraTargets(dt);

    refs_.world.refreshCollisionEvents();

    {
        const auto start = Clock::now();
        const std::uint32_t events = refs_.gameApi.dispatchLifecycleEvents();
        if (refs_.profiler) {
            refs_.profiler->addLuaMs(elapsedMs(start));
            refs_.profiler->addLuaEvents(events);
        }
    }

    refs_.world.tickAutoDestroy(dt);
    {
        const auto start = Clock::now();
        refs_.world.flushEntityQueues();
        if (refs_.profiler) refs_.profiler->addGameplayMs(elapsedMs(start));
    }
    {
        const auto start = Clock::now();
        const std::uint32_t events = refs_.gameApi.dispatchLifecycleEvents();
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

    refs_.events.flushDeferred();
    if (refs_.audio) refs_.audio->update();
}

} // namespace ArtCade

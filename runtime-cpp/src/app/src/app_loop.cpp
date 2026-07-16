#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"

#ifdef ARTCADE_WASM
#include <emscripten/emscripten.h>
#endif

#include <algorithm>
#include <chrono>
#include <iostream>

namespace ArtCade {

namespace {

using Clock = std::chrono::steady_clock;

double elapsedMs(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}

std::string logicInputCode(LogicKey key) {
    const int value = static_cast<int>(key);
    if (value >= static_cast<int>(LogicKey::A) && value <= static_cast<int>(LogicKey::Z))
        return "Key" + Logic::logicKeyName(key);
    if (value >= static_cast<int>(LogicKey::Num0) && value <= static_cast<int>(LogicKey::Num9))
        return "Digit" + Logic::logicKeyName(key);
    return Logic::logicKeyName(key);
}

} // namespace

void Application::dispatchGameplayCollisionTransitions() {
    if (!mod_ || !mod_->world) return;
    std::set<std::pair<EntityId, EntityId>> current;
    for (const CollisionWorld::ContactEvent& event : mod_->world->collisionEvents()) {
        if (event.kind == CollisionWorld::ContactEvent::Kind::Exit
            || event.self == INVALID_ENTITY || event.other == INVALID_ENTITY
            || event.self == event.other
            || !mod_->world->isActiveEntity(event.self)
            || !mod_->world->isActiveEntity(event.other)) continue;
        current.emplace(std::min(event.self, event.other),
                        std::max(event.self, event.other));
    }

    std::set<std::pair<EntityId, EntityId>> entered;
    std::set<std::pair<EntityId, EntityId>> exited;
    for (const auto& pair : current)
        if (mod_->activeGameplayCollisionPairs.count(pair) == 0) entered.insert(pair);
    for (const auto& pair : mod_->activeGameplayCollisionPairs)
        if (current.count(pair) == 0) exited.insert(pair);

    const std::vector<EntityId> structuralOrder = mod_->entityGateway->activeSceneIds();
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
    if (mod_->logicRuntime) {
        dispatch(entered, true, [&](EntityId owner, EntityId other, bool) {
            mod_->logicRuntime->dispatchCollisionEnter(owner, other);
        });
        dispatch(exited, false, [&](EntityId owner, EntityId other, bool) {
            mod_->logicRuntime->dispatchCollisionExit(owner, other);
        });
    }
    if (mod_->scriptRuntime) {
        dispatch(entered, true, [&](EntityId owner, EntityId other, bool) {
            mod_->scriptRuntime->dispatchCollisionEnter(owner, other);
        });
        dispatch(exited, false, [&](EntityId owner, EntityId other, bool) {
            mod_->scriptRuntime->dispatchCollisionExit(owner, other);
        });
    }
    mod_->activeGameplayCollisionPairs = std::move(current);
}

void Application::tickFixedStep(float dt) {
    mod_->renderer->clearDrawQueue();

    {
        const auto start = Clock::now();
        mod_->timeManager->tick(dt);
        mod_->tweenManager->update(dt);
        mod_->spriteAnimator->update(dt);
        mod_->layerManager->update(dt);
        mod_->cameraManager->updateMotion(dt);
        mod_->gameStateManager->update(dt);
        mod_->eventBus->flushDeferred();
        if (!mod_->dialogManager || !mod_->dialogManager->isBlocking()) {
            mod_->world->tickGameplaySystems(dt);
            mod_->entityGateway->tickSceneTransition(dt);
        }
        profiler_.addGameplayMs(elapsedMs(start));
    }
    // Drain animator events once; feed Logic Runtime then GameAPI Lua handlers.
    {
        const auto finished = mod_->spriteAnimator->pollFinished();
        const auto events = mod_->spriteAnimator->pollEvents();
        if (mod_->logicRuntime) {
            for (const auto& ev : events) {
                if (ev.kind == ArtCade::Modules::SpriteAnimator::AnimEventKind::Start)
                    mod_->logicRuntime->dispatchAnimationStarted(ev.entityId);
            }
            for (const auto& ev : finished)
                mod_->logicRuntime->dispatchAnimationFinished(ev.entityId);
            mod_->logicRuntime->dispatchTick(dt);
        }
        const auto start = Clock::now();
        const uint32_t luaEvents = mod_->gameAPI->dispatchAnimationEvents(finished, events);
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.addLuaEvents(luaEvents);
    }
    {
        const auto start = Clock::now();
        mod_->luaHost->tick(dt);
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.setLuaTickEnabled(mod_->luaHost->isScriptTickRequired());
    }
    // Manual on_update runs after generated input rules and before platformer
    // integration, so its movement intent can deliberately override the board.
    if (mod_->scriptRuntime) {
        mod_->scriptRuntime->update(dt);
        mod_->world->flushEntityQueues();
    }
    if (mod_->dialogManager) mod_->dialogManager->tick(dt);

    if (!mod_->dialogManager || !mod_->dialogManager->isBlocking()) {
        mod_->world->tickPlatformerControllers(dt);
        mod_->world->tickSimpleMovementIntents(dt);
    }
    const bool runPhysics = physicsMode_ == PhysicsMode::On
        || (physicsMode_ == PhysicsMode::Auto && mod_->physics->hasActiveBodies());
    if (runPhysics) {
        const auto start = Clock::now();
        mod_->physics->step(dt);
        profiler_.addPhysicsMs(elapsedMs(start));
    }

    mod_->world->flushEntityQueues();
    if (runPhysics) mod_->world->syncPhysicsToEntities();
    mod_->world->tickCameraTargets(dt);

    mod_->world->refreshCollisionEvents();

    {
        const auto start = Clock::now();
        const uint32_t events = mod_->gameAPI->dispatchLifecycleEvents();
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.addLuaEvents(events);
    }

    mod_->world->tickAutoDestroy(dt);
    {
        const auto start = Clock::now();
        mod_->world->flushEntityQueues();
        profiler_.addGameplayMs(elapsedMs(start));
    }
    {
        const auto start = Clock::now();
        const uint32_t events = mod_->gameAPI->dispatchLifecycleEvents();
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.addLuaEvents(events);
    }
    dispatchGameplayCollisionTransitions();

    // Drain errors from input/update/collision callbacks once the fixed-step
    // lifecycle has reached a stable post-dispatch boundary.
    if (mod_->scriptRuntime) {
        for (const auto& diagnostic : mod_->scriptRuntime->drainDiagnostics()) {
            std::cerr << "[Script] " << diagnostic.sourcePath;
            if (diagnostic.line > 0) std::cerr << ":" << diagnostic.line;
            std::cerr << " [" << diagnostic.callback << "] entity "
                      << diagnostic.owner << ": " << diagnostic.message << "\n";
        }
    }

    mod_->eventBus->flushDeferred();
    mod_->audio->update();

    if (splash_) {
        splash_->update(dt);
        if (splash_->isDone()) splash_.reset();
    }
}

void Application::tickFrameEnd() {
    profiler_.setCounts(
        static_cast<uint32_t>(mod_->entityGateway->activeSceneEntityCount()),
        static_cast<uint32_t>(mod_->entityGateway->activePhysicsBodyCount()));
    {
        const auto start = Clock::now();
        renderActiveScene();
        profiler_.setRenderMs(elapsedMs(start));
    }
    EditorAPI::flushConsoleLines();
    EditorAPI::processSpritesheetPreviewQueue();
    mod_->input->resetFrameState();
    profiler_.endFrame();

    if (!mod_->renderer) return;
    const float dt = mod_->renderer->deltaTime();
    const float fps = (dt > 1e-6f) ? (1.f / dt) : 0.f;
    const auto snapshot = profiler_.snapshot();
    EditorAPI::publishRuntimeProfile(
        fps, static_cast<float>(snapshot.luaMs),
        static_cast<float>(snapshot.physicsMs),
        static_cast<float>(snapshot.renderMs),
        snapshot.entityCount, snapshot.activePhysicsBodies);
    EditorAPI::notifyRuntimeProfile(
        fps, static_cast<float>(snapshot.luaMs),
        static_cast<float>(snapshot.physicsMs),
        static_cast<float>(snapshot.renderMs),
        snapshot.entityCount, snapshot.activePhysicsBodies);
}

void Application::loopIteration() {
    profiler_.beginFrame();
#ifndef ARTCADE_WASM
    if (!running_ || mod_->renderer->shouldClose()) {
        running_ = false;
        return;
    }
#endif

    const float frameTime = mod_->renderer->deltaTime();
    accumulator_ += frameTime;
    if (accumulator_ > targetDt_ * 4.f) accumulator_ = targetDt_ * 4.f;

    mod_->input->poll();
#ifndef ARTCADE_WASM
    if (mod_->input->wasKeyPressed("F11")) {
        const auto mode = mod_->renderer->toggleBorderlessFullscreen();
        if (mod_->editorViewport)
            mod_->editorViewport->set_presentation_mode(mode);
    }
#endif

#ifdef ARTCADE_WASM
    const bool simulating = EditorAPI::s_mode == 1;
#else
    const bool simulating = true;
#endif

    float simulatedDt = 0.f;
    if (simulating) {
        if (mod_->logicRuntime || mod_->scriptRuntime) {
            Scripts::ScriptInputSnapshot scriptInput;
            if (mod_->logicRuntime) mod_->logicRuntime->beginFrame();
            for (LogicKey key : Logic::supportedLogicKeys()) {
                const std::string code = logicInputCode(key);
                const bool pressed = mod_->input->wasKeyPressed(code);
                const bool released = mod_->input->wasKeyReleased(code);
                const bool held = mod_->input->isKeyDown(code);
                if (pressed) {
                    if (mod_->logicRuntime) mod_->logicRuntime->dispatchKeyPressed(key);
                    scriptInput.pressed.push_back(key);
                }
                if (released) {
                    if (mod_->logicRuntime) mod_->logicRuntime->dispatchKeyReleased(key);
                    scriptInput.released.push_back(key);
                }
                if (held) {
                    if (mod_->logicRuntime) mod_->logicRuntime->dispatchKeyHeld(key);
                    scriptInput.held.push_back(key);
                }
            }
            if (mod_->scriptRuntime) mod_->scriptRuntime->dispatchInput(scriptInput);
            // Both languages consumed the same immutable input frame; queued
            // destroys may now commit before any fixed-step update.
            mod_->world->flushEntityQueues();
        }
        if (!mod_->dialogManager || !mod_->dialogManager->isBlocking()) {
            const auto start = Clock::now();
            const uint32_t events = mod_->gameAPI->dispatchInputEvents();
            profiler_.addLuaMs(elapsedMs(start));
            profiler_.addLuaEvents(events);
        }
        while (accumulator_ >= targetDt_) {
            tickFixedStep(targetDt_);
            accumulator_ -= targetDt_;
            simulatedDt += targetDt_;
        }
    } else {
        accumulator_ = 0.f;
    }

    if (mod_->cameraManager->trauma() > 0.f) {
        const float shakeDt = simulatedDt > 0.f ? simulatedDt : frameTime;
        mod_->cameraManager->refreshShakeOffset(shakeDt);
        mod_->cameraManager->decayTrauma(shakeDt);
    }

    tickFrameEnd();
}

void Application::mainLoop() {
#ifdef ARTCADE_WASM
    webInstance_ = this;
    emscripten_set_main_loop(webLoopCallback, 0, 1);
#else
    while (running_ && !mod_->renderer->shouldClose()) loopIteration();
#endif
}

} // namespace ArtCade

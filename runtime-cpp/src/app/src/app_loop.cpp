#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"

#ifdef ARTCADE_WASM
#include <emscripten/emscripten.h>
#endif

#include <chrono>

namespace ArtCade {

namespace {

using Clock = std::chrono::steady_clock;

double elapsedMs(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}

} // namespace

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
    {
        const auto start = Clock::now();
        const uint32_t events = mod_->gameAPI->dispatchAnimationEvents();
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.addLuaEvents(events);
    }
    {
        const auto start = Clock::now();
        mod_->luaHost->tick(dt);
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.setLuaTickEnabled(mod_->luaHost->isScriptTickRequired());
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

    mod_->world->refreshSensorEdges();

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
        mod_->renderer->toggleBorderlessFullscreen();
    }
#endif

#ifdef ARTCADE_WASM
    const bool simulating = EditorAPI::s_mode == 1;
#else
    const bool simulating = true;
#endif

    float simulatedDt = 0.f;
    if (simulating) {
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

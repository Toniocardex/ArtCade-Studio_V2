#include "engine/renderer.h"
#include "engine/physics.h"
#include "engine/input.h"
#include "engine/audio.h"
#include "engine/lua-host.h"
#include "engine/game-api.h"
#include "game/world.h"
#include "game/asset-loader.h"
#include "utils/logger.h"

#include <iostream>
#include <memory>

using namespace ArtCade;

int main(int argc, char* argv[]) {
    // ========================================================================
    // Initialization
    // ========================================================================

    Logger::init();
    Logger::log("ArtCade V2 Engine - Starting...");

    // Determine project path
    std::string projectPath = "game.artcade";
    if (argc > 1) {
        projectPath = argv[1];
    }

    Logger::log("Loading project: " + projectPath);

    // ========================================================================
    // Create Engine Systems
    // ========================================================================

    auto renderer = std::make_unique<Renderer>();
    auto physics = std::make_unique<Physics>();
    auto input = std::make_unique<Input>();
    auto audio = std::make_unique<Audio>();
    auto world = std::make_unique<World>();
    auto luaHost = std::make_unique<LuaHost>();
    auto gameAPI = std::make_unique<GameAPI>(renderer.get(), physics.get(), world.get());

    // ========================================================================
    // Initialize Systems
    // ========================================================================

    Logger::log("Initializing renderer...");
    if (!renderer->init(1280, 720, "ArtCade V2")) {
        Logger::error("Failed to initialize renderer");
        return 1;
    }

    Logger::log("Initializing physics...");
    physics->init({0.0f, -9.81f});

    Logger::log("Initializing input...");
    input->init();

    Logger::log("Initializing audio...");
    audio->init();

    // ========================================================================
    // Load Project
    // ========================================================================

    Logger::log("Loading project assets...");
    AssetLoader assetLoader;
    ProjectDoc projectDoc;

    // Try to load from .artcade file, fall back to directory
    if (!assetLoader.loadProject(projectPath, projectDoc)) {
        Logger::log("Trying to load from directory: " + projectPath);
        if (!assetLoader.loadProjectFromDirectory(projectPath, projectDoc)) {
            Logger::error("Failed to load project from: " + projectPath);
            return 1;
        }
    }

    Logger::log("Project loaded: " + projectDoc.projectName);

    Logger::log("Initializing world...");
    world->init(projectDoc);

    // Load active scene
    if (!projectDoc.activeSceneId.empty()) {
        world->loadScene(projectDoc.activeSceneId);
    }

    // ========================================================================
    // Initialize Lua
    // ========================================================================

    Logger::log("Initializing Lua host...");
    luaHost->init(gameAPI.get());

    std::vector<uint8_t> mainScriptBytecode;
    if (!assetLoader.loadLuaBytecode(projectDoc.mainScriptPath, mainScriptBytecode)) {
        Logger::warning("Could not load main script: " + projectDoc.mainScriptPath);
    } else {
        if (!luaHost->loadBytecodeFromBuffer(mainScriptBytecode.data(), mainScriptBytecode.size())) {
            Logger::error("Failed to load Lua bytecode");
            if (luaHost->hasErrors()) {
                Logger::error("Lua error: " + luaHost->getLastError());
            }
            return 1;
        }
    }

    // ========================================================================
    // Main Game Loop
    // ========================================================================

    Logger::log("Entering main game loop...");

    float targetDeltaTime = 1.0f / projectDoc.targetFPS;
    float accumulator = 0.0f;

    while (!renderer->shouldClose()) {
        // ====================================================================
        // Fixed Timestep Loop
        // ====================================================================

        float frameTime = 0.016667f; // TODO: Use actual delta from Raylib

        input->poll();

        // Process fixed timesteps
        accumulator += frameTime;
        while (accumulator >= targetDeltaTime) {
            // 1. Lua tick (game logic)
            try {
                luaHost->tick(targetDeltaTime);
            } catch (const std::exception& e) {
                Logger::error("Lua error during tick: " + std::string(e.what()));
            }

            // 2. Physics simulation
            physics->step(targetDeltaTime);

            // 3. Update world state
            world->updateActiveScene();

            accumulator -= targetDeltaTime;
        }

        // ====================================================================
        // Rendering
        // ====================================================================

        glm::vec4 bgColor = {0.1f, 0.1f, 0.1f, 1.0f};
        if (world->getActiveScene()) {
            bgColor = world->getActiveScene()->backgroundColor;
        }

        renderer->beginFrame(bgColor);

        // Render all entities in active scene
        auto entityIds = world->getActiveSceneEntities();
        for (EntityId id : entityIds) {
            // TODO: Render entity (sprite, debug shapes, etc.)
        }

        renderer->endFrame();

        // Clear frame input state
        input->resetFrameState();
    }

    // ========================================================================
    // Shutdown
    // ========================================================================

    Logger::log("Shutting down...");

    luaHost->shutdown();
    audio->shutdown();
    input->shutdown();
    physics->shutdown();
    world->shutdown();
    renderer->shutdown();

    Logger::log("ArtCade V2 Engine - Shutdown complete");
    Logger::shutdown();

    return 0;
}

#include "../include/app.h"

#include "../../modules/renderer/include/renderer.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/input/include/input.h"
#include "../../modules/audio/include/audio.h"
#include "../../modules/lua-runtime/include/lua-host.h"
#include "../../modules/entity-system/include/entity-manager.h"
#include "../../modules/scene-system/include/scene-manager.h"
#include "../../modules/asset-system/include/asset-loader.h"
#include "../../modules/game-api/include/game-api.h"
#include "../../world/include/world.h"

#include <iostream>
#include <memory>

namespace ArtCade {

// ---- Pimpl for module storage -------------------------------------------
struct Application::Modules {
    std::unique_ptr<ArtCade::Modules::Renderer>      renderer;
    std::unique_ptr<ArtCade::Modules::Physics>       physics;
    std::unique_ptr<ArtCade::Modules::Input>         input;
    std::unique_ptr<ArtCade::Modules::Audio>         audio;
    std::unique_ptr<ArtCade::Modules::LuaHost>       luaHost;
    std::unique_ptr<ArtCade::Modules::EntityManager> entityManager;
    std::unique_ptr<ArtCade::Modules::SceneManager>  sceneManager;
    std::unique_ptr<ArtCade::Modules::AssetLoader>   assetLoader;
    std::unique_ptr<ArtCade::Modules::GameAPI>       gameAPI;
    std::unique_ptr<World>                           world;
};

// ---- Construction / destruction -----------------------------------------

Application::Application()  : mod_(std::make_unique<Modules>()) {}
Application::~Application() { shutdownModules(); }

// ---- Entry point --------------------------------------------------------

int Application::run(int argc, char* argv[]) {
    std::string projectPath = (argc > 1) ? argv[1] : "game.artcade";

    if (!initModules(projectPath)) {
        std::cerr << "[App] Initialization failed.\n";
        return 1;
    }

    running_ = true;
    mainLoop();
    shutdownModules();
    return 0;
}

// ---- Initialization (dependency order) ----------------------------------

bool Application::initModules(const std::string& projectPath) {
    // Layer 0 — leaf modules with no engine deps
    mod_->renderer      = std::make_unique<ArtCade::Modules::Renderer>();
    mod_->physics       = std::make_unique<ArtCade::Modules::Physics>();
    mod_->input         = std::make_unique<ArtCade::Modules::Input>();
    mod_->audio         = std::make_unique<ArtCade::Modules::Audio>();
    mod_->entityManager = std::make_unique<ArtCade::Modules::EntityManager>();
    mod_->assetLoader   = std::make_unique<ArtCade::Modules::AssetLoader>();

    if (!mod_->renderer->init()      ||
        !mod_->physics->init()       ||
        !mod_->input->init()         ||
        !mod_->audio->init()         ||
        !mod_->entityManager->init() ||
        !mod_->assetLoader->init())
        return false;

    mod_->renderer->setWindowSize(1280, 720, "ArtCade V2");

    // Layer 1 — scene manager depends on entity manager
    mod_->sceneManager = std::make_unique<ArtCade::Modules::SceneManager>(*mod_->entityManager);
    if (!mod_->sceneManager->init()) return false;

    // Layer 2 — world ties entity + scene + physics together
    mod_->world = std::make_unique<World>(
        *mod_->entityManager, *mod_->sceneManager, *mod_->physics);

    // Layer 3 — build EngineContext so GameAPI and LuaHost can see everyone
    ctx_.renderer      = mod_->renderer.get();
    ctx_.physics       = mod_->physics.get();
    ctx_.input         = mod_->input.get();
    ctx_.audio         = mod_->audio.get();
    ctx_.entityManager = mod_->entityManager.get();
    ctx_.sceneManager  = mod_->sceneManager.get();
    ctx_.assetLoader   = mod_->assetLoader.get();
    ctx_.world         = mod_->world.get();

    mod_->gameAPI = std::make_unique<ArtCade::Modules::GameAPI>(ctx_);
    if (!mod_->gameAPI->init()) return false;
    ctx_.gameAPI = mod_->gameAPI.get();

    // Layer 4 — Lua host (needs GameAPI to register bindings)
    mod_->luaHost = std::make_unique<ArtCade::Modules::LuaHost>();
    mod_->luaHost->registerBindings([&](sol::state& lua) {
        mod_->gameAPI->registerAll(lua);
    });
    if (!mod_->luaHost->init()) return false;
    ctx_.luaHost = mod_->luaHost.get();

    // Load project
    ProjectDoc doc;
    bool loaded = projectPath.ends_with(".artcade")
        ? mod_->assetLoader->loadArtcade(projectPath, doc)
        : mod_->assetLoader->loadDirectory(projectPath, doc);

    if (!loaded) {
        std::cerr << "[App] Could not load project: " << projectPath << "\n";
        return false;
    }

    mod_->world->init(doc);

    // Load main Lua script
    std::vector<uint8_t> bytecode;
    if (mod_->assetLoader->loadLuaBytecode(doc.mainScriptPath, bytecode))
        mod_->luaHost->loadBytecodeBuffer(bytecode.data(), bytecode.size());

    targetDt_ = 1.f / doc.targetFPS;

    std::cout << "[App] Project loaded: " << doc.projectName << "\n";
    return true;
}

// ---- Main loop ----------------------------------------------------------

void Application::mainLoop() {
    float accumulator = 0.f;

    while (running_ && !mod_->renderer->shouldClose()) {
        // TODO: get actual delta from Raylib GetFrameTime()
        float frameTime = 0.016667f;
        accumulator += frameTime;

        mod_->input->poll();

        // Fixed timestep
        while (accumulator >= targetDt_) {
            mod_->luaHost->tick(targetDt_);
            mod_->physics->step(targetDt_);
            mod_->world->syncPhysicsToEntities();
            mod_->audio->update();
            accumulator -= targetDt_;
        }

        renderActiveScene();
        mod_->input->resetFrameState();
    }
}

// ---- Render -------------------------------------------------------------

void Application::renderActiveScene() {
    Vec4 bgColor = {0.08f, 0.08f, 0.1f, 1.f};

    if (auto* scene = mod_->sceneManager->activeScene())
        bgColor = scene->backgroundColor;

    mod_->renderer->beginFrame(bgColor);

    for (EntityId id : mod_->world->activeEntityIds()) {
        const auto* e = mod_->entityManager->get(id);
        if (!e) continue;

        mod_->renderer->drawSprite(
            e->sprite.spriteAssetId,
            e->transform.position,
            e->transform.rotation,
            e->transform.scale,
            e->sprite.tint,
            e->sprite.alpha);
    }

    mod_->renderer->endFrame();
}

// ---- Shutdown (reverse dependency order) --------------------------------

void Application::shutdownModules() {
    if (mod_->luaHost)       { mod_->luaHost->shutdown();       mod_->luaHost.reset();       }
    if (mod_->gameAPI)       { mod_->gameAPI->shutdown();       mod_->gameAPI.reset();       }
    if (mod_->world)         { mod_->world->shutdown();         mod_->world.reset();         }
    if (mod_->sceneManager)  { mod_->sceneManager->shutdown();  mod_->sceneManager.reset();  }
    if (mod_->assetLoader)   { mod_->assetLoader->shutdown();   mod_->assetLoader.reset();   }
    if (mod_->entityManager) { mod_->entityManager->shutdown(); mod_->entityManager.reset(); }
    if (mod_->audio)         { mod_->audio->shutdown();         mod_->audio.reset();         }
    if (mod_->input)         { mod_->input->shutdown();         mod_->input.reset();         }
    if (mod_->physics)       { mod_->physics->shutdown();       mod_->physics.reset();       }
    if (mod_->renderer)      { mod_->renderer->shutdown();      mod_->renderer.reset();      }
}

} // namespace ArtCade

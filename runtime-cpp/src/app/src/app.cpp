#include "../include/app.h"

#ifdef ARTCADE_WASM
#include <emscripten/emscripten.h>
#endif

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

// New modules
#include "../../modules/time/include/time-manager.h"
#include "../../modules/event-bus/include/event-bus.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../modules/game-state/include/game-state-manager.h"
#include "../../modules/texture-manager/include/texture-manager.h"
#include "../../modules/sprite-animator/include/sprite-animator.h"
#include "../../modules/layer-manager/include/layer-manager.h"
#include "../../modules/camera-manager/include/camera-manager.h"
#include "../../modules/tween-manager/include/tween-manager.h"
#include "../../modules/save-load/include/save-load-manager.h"

#include <iostream>
#include <memory>

namespace ArtCade {

// ---- Pimpl for module storage -------------------------------------------
struct Application::Modules {
    // Core systems
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

    // New modules
    std::unique_ptr<ArtCade::Modules::TimeManager>      timeManager;
    std::unique_ptr<ArtCade::Modules::EventBus>         eventBus;
    std::unique_ptr<ArtCade::Modules::VariableManager>  variableManager;
    std::unique_ptr<ArtCade::Modules::GameStateManager> gameStateManager;
    std::unique_ptr<ArtCade::Modules::TextureManager>   textureManager;
    std::unique_ptr<ArtCade::Modules::SpriteAnimator>   spriteAnimator;
    std::unique_ptr<ArtCade::Modules::LayerManager>     layerManager;
    std::unique_ptr<ArtCade::Modules::CameraManager>    cameraManager;
    std::unique_ptr<ArtCade::Modules::TweenManager>     tweenManager;
    std::unique_ptr<ArtCade::Modules::SaveLoadManager>  saveLoadManager;
};

// ---- Construction / destruction -----------------------------------------

Application::Application()  : mod_(std::make_unique<Modules>()) {}
Application::~Application() { shutdownModules(); }

// ---- Emscripten static state --------------------------------------------

#ifdef ARTCADE_WASM
Application* Application::webInstance_ = nullptr;

void Application::webLoopCallback() {
    if (webInstance_) webInstance_->loopIteration();
}
#endif

// ---- Entry point --------------------------------------------------------

int Application::run(int argc, char* argv[]) {
#ifdef ARTCADE_WASM
    // Su WASM non ci sono argomenti runtime; il progetto è preloadato nel VFS
    std::string projectPath = "test-project";
    (void)argc; (void)argv;
#else
    std::string projectPath = (argc > 1) ? argv[1] : "game.artcade";
#endif

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
    // Layer 0a — stateless utility modules (no deps at all)
    mod_->eventBus        = std::make_unique<ArtCade::Modules::EventBus>();
    mod_->timeManager     = std::make_unique<ArtCade::Modules::TimeManager>();
    mod_->variableManager = std::make_unique<ArtCade::Modules::VariableManager>();
    mod_->tweenManager    = std::make_unique<ArtCade::Modules::TweenManager>();
    mod_->spriteAnimator  = std::make_unique<ArtCade::Modules::SpriteAnimator>();
    mod_->layerManager    = std::make_unique<ArtCade::Modules::LayerManager>();
    mod_->cameraManager   = std::make_unique<ArtCade::Modules::CameraManager>();
    mod_->saveLoadManager = std::make_unique<ArtCade::Modules::SaveLoadManager>();

    if (!mod_->eventBus->init()        ||
        !mod_->timeManager->init()     ||
        !mod_->variableManager->init() ||
        !mod_->tweenManager->init()    ||
        !mod_->spriteAnimator->init()  ||
        !mod_->layerManager->init()    ||
        !mod_->cameraManager->init()   ||
        !mod_->saveLoadManager->init())
        return false;

    ctx_.eventBus        = mod_->eventBus.get();
    ctx_.timeManager     = mod_->timeManager.get();
    ctx_.variableManager = mod_->variableManager.get();
    ctx_.tweenManager    = mod_->tweenManager.get();
    ctx_.spriteAnimator  = mod_->spriteAnimator.get();
    ctx_.layerManager    = mod_->layerManager.get();
    ctx_.cameraManager   = mod_->cameraManager.get();
    ctx_.saveLoadManager = mod_->saveLoadManager.get();

    // GameStateManager needs EventBus
    mod_->gameStateManager = std::make_unique<ArtCade::Modules::GameStateManager>();
    mod_->gameStateManager->setEventBus(mod_->eventBus.get());
    if (!mod_->gameStateManager->init()) return false;
    ctx_.gameStateManager = mod_->gameStateManager.get();

    // Layer 0b — leaf modules with no engine deps
    mod_->renderer      = std::make_unique<ArtCade::Modules::Renderer>();
    mod_->physics       = std::make_unique<ArtCade::Modules::Physics>();
    mod_->input         = std::make_unique<ArtCade::Modules::Input>();
    mod_->audio         = std::make_unique<ArtCade::Modules::Audio>();
    mod_->entityManager = std::make_unique<ArtCade::Modules::EntityManager>();
    mod_->assetLoader   = std::make_unique<ArtCade::Modules::AssetLoader>();

    // Set window params before init() opens the Raylib window
    mod_->renderer->setWindowSize(1280, 720, "ArtCade V2");

    if (!mod_->renderer->init()      ||
        !mod_->physics->init()       ||
        !mod_->input->init()         ||
        !mod_->audio->init()         ||
        !mod_->entityManager->init() ||
        !mod_->assetLoader->init())
        return false;

    // TextureManager needs Raylib window open
    mod_->textureManager = std::make_unique<ArtCade::Modules::TextureManager>();
    if (!mod_->textureManager->init()) return false;
    ctx_.textureManager = mod_->textureManager.get();

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
    auto endsWith = [](const std::string& s, const char* suffix) {
        std::size_t slen = std::strlen(suffix);
        return s.size() >= slen && s.compare(s.size() - slen, slen, suffix) == 0;
    };
    bool loaded = endsWith(projectPath, ".artcade")
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

// ---- Single frame -------------------------------------------------------

void Application::loopIteration() {
    // Su WASM non c'è "shouldClose" (il browser gestisce la chiusura)
#ifndef ARTCADE_WASM
    if (!running_ || mod_->renderer->shouldClose()) {
        running_ = false;
        return;
    }
#endif

    float frameTime = mod_->renderer->deltaTime();
    accumulator_ += frameTime;

    mod_->input->poll();

    // Fixed timestep
    while (accumulator_ >= targetDt_) {
        mod_->timeManager->tick(targetDt_);
        mod_->tweenManager->update(targetDt_);
        mod_->spriteAnimator->update(targetDt_);
        mod_->layerManager->update(targetDt_);
        mod_->cameraManager->update(targetDt_);
        mod_->gameStateManager->update(targetDt_);
        mod_->eventBus->flushDeferred();
        mod_->luaHost->tick(targetDt_);
        mod_->physics->step(targetDt_);
        mod_->world->syncPhysicsToEntities();
        mod_->audio->update();
        accumulator_ -= targetDt_;
    }

    renderActiveScene();
    mod_->input->resetFrameState();
}

// ---- Main loop ----------------------------------------------------------

void Application::mainLoop() {
#ifdef ARTCADE_WASM
    // Emscripten prende il controllo del loop — la callback viene chiamata
    // da requestAnimationFrame del browser (~60fps). Non ritorna.
    webInstance_ = this;
    emscripten_set_main_loop(webLoopCallback, 0, 1);
#else
    while (running_ && !mod_->renderer->shouldClose())
        loopIteration();
#endif
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
    // Shutdown in reverse init order
    if (mod_->luaHost)          { mod_->luaHost->shutdown();          mod_->luaHost.reset();          }
    if (mod_->gameAPI)          { mod_->gameAPI->shutdown();          mod_->gameAPI.reset();          }
    if (mod_->world)            { mod_->world->shutdown();            mod_->world.reset();            }
    if (mod_->sceneManager)     { mod_->sceneManager->shutdown();     mod_->sceneManager.reset();     }
    if (mod_->assetLoader)      { mod_->assetLoader->shutdown();      mod_->assetLoader.reset();      }
    if (mod_->entityManager)    { mod_->entityManager->shutdown();    mod_->entityManager.reset();    }
    if (mod_->audio)            { mod_->audio->shutdown();            mod_->audio.reset();            }
    if (mod_->input)            { mod_->input->shutdown();            mod_->input.reset();            }
    if (mod_->physics)          { mod_->physics->shutdown();          mod_->physics.reset();          }
    if (mod_->textureManager)   { mod_->textureManager->shutdown();   mod_->textureManager.reset();   }
    if (mod_->renderer)         { mod_->renderer->shutdown();         mod_->renderer.reset();         }
    // New modules (no Raylib dep — shut down after window closes)
    if (mod_->gameStateManager) { mod_->gameStateManager->shutdown(); mod_->gameStateManager.reset(); }
    if (mod_->saveLoadManager)  { mod_->saveLoadManager->shutdown();  mod_->saveLoadManager.reset();  }
    if (mod_->cameraManager)    { mod_->cameraManager->shutdown();    mod_->cameraManager.reset();    }
    if (mod_->layerManager)     { mod_->layerManager->shutdown();     mod_->layerManager.reset();     }
    if (mod_->spriteAnimator)   { mod_->spriteAnimator->shutdown();   mod_->spriteAnimator.reset();   }
    if (mod_->tweenManager)     { mod_->tweenManager->shutdown();     mod_->tweenManager.reset();     }
    if (mod_->variableManager)  { mod_->variableManager->shutdown();  mod_->variableManager.reset();  }
    if (mod_->timeManager)      { mod_->timeManager->shutdown();      mod_->timeManager.reset();      }
    if (mod_->eventBus)         { mod_->eventBus->shutdown();         mod_->eventBus.reset();         }
}

} // namespace ArtCade

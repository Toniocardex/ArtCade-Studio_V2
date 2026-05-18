#include "../include/app.h"

#include <raylib.h>   // GetScreenWidth/Height for splash overlay

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
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/asset-system/include/asset-loader.h"
#include "../../modules/game-api/include/game-api.h"
#include "../../world/include/world.h"

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
#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"

#include <cstring>
#include <iostream>
#include <memory>
#include <vector>

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
    std::unique_ptr<ArtCade::Modules::RuntimeEntityGateway> entityGateway;
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
// Suddiviso in tre helper privati per mantenere ogni funzione < 50 righe.

bool Application::initModules(const std::string& projectPath) {
    return initUtilities()
        && initSubsystems()
        && loadProject(projectPath);
}

// Layer 0 — moduli stateless (nessuna dipendenza da Raylib, Lua o tra loro).
// Comprende anche GameStateManager che dipende solo da EventBus.
bool Application::initUtilities() {
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

    mod_->gameStateManager = std::make_unique<ArtCade::Modules::GameStateManager>();
    mod_->gameStateManager->setEventBus(mod_->eventBus.get());
    if (!mod_->gameStateManager->init()) return false;
    ctx_.gameStateManager = mod_->gameStateManager.get();

    return true;
}

// Layer 1-4 — sottosistemi con dipendenze da Raylib e Lua.
// Ordine: renderer → physics/input/audio → textures → scene → world → API → Lua.
bool Application::initSubsystems() {
    mod_->renderer      = std::make_unique<ArtCade::Modules::Renderer>();
    mod_->physics       = std::make_unique<ArtCade::Modules::Physics>();
    mod_->input         = std::make_unique<ArtCade::Modules::Input>();
    mod_->audio         = std::make_unique<ArtCade::Modules::Audio>();
    mod_->entityManager = std::make_unique<ArtCade::Modules::EntityManager>();
    mod_->assetLoader   = std::make_unique<ArtCade::Modules::AssetLoader>();

    mod_->renderer->setWindowSize(1280, 720, "ArtCade V2");

    if (!mod_->renderer->init()      ||
        !mod_->physics->init()       ||
        !mod_->input->init()         ||
        !mod_->audio->init()         ||
        !mod_->entityManager->init() ||
        !mod_->assetLoader->init())
        return false;

    // TextureManager richiede la finestra Raylib già aperta
    mod_->textureManager = std::make_unique<ArtCade::Modules::TextureManager>();
    if (!mod_->textureManager->init()) return false;
    ctx_.textureManager = mod_->textureManager.get();

    mod_->sceneManager = std::make_unique<ArtCade::Modules::SceneManager>(*mod_->entityManager);
    if (!mod_->sceneManager->init()) return false;

    mod_->entityGateway = std::make_unique<ArtCade::Modules::RuntimeEntityGateway>(
        *mod_->entityManager, *mod_->sceneManager);
    if (!mod_->entityGateway->init()) return false;

    mod_->world = std::make_unique<World>(
        *mod_->entityGateway, *mod_->physics);

    // Popola EngineContext — GameAPI e LuaHost ne hanno bisogno
    ctx_.renderer      = mod_->renderer.get();
    ctx_.physics       = mod_->physics.get();
    ctx_.input         = mod_->input.get();
    ctx_.audio         = mod_->audio.get();
    ctx_.entityManager = mod_->entityManager.get();
    ctx_.sceneManager  = mod_->sceneManager.get();
    ctx_.entityGateway = mod_->entityGateway.get();
    ctx_.assetLoader   = mod_->assetLoader.get();
    ctx_.world         = mod_->world.get();

    mod_->gameAPI = std::make_unique<ArtCade::Modules::GameAPI>(ctx_);
    if (!mod_->gameAPI->init()) return false;
    ctx_.gameAPI = mod_->gameAPI.get();

    mod_->luaHost = std::make_unique<ArtCade::Modules::LuaHost>();
    mod_->luaHost->registerBindings([&](sol::state& lua) {
        mod_->gameAPI->registerAll(lua);
    });
    if (!mod_->luaHost->init()) return false;
    ctx_.luaHost = mod_->luaHost.get();

    // Wire EditorAPI to EntityManager + SceneManager so editor commands
    // (editor_load_project, editor_set_transform) can reach engine state.
    EditorAPI::wireEngine(mod_->entityGateway.get());
    EditorAPI::wireLua(mod_->luaHost.get());   // hot-reload from Logic Board
    EditorAPI::init("#artcade-canvas");

    return true;
}

// Layer 5 — carica il progetto (directory dev o .artcade), inizializza il
// world con le entità/scene e inietta lo script Lua principale.
bool Application::loadProject(const std::string& projectPath) {
    auto endsWith = [](const std::string& s, const char* suffix) {
        const std::size_t slen = std::strlen(suffix);
        return s.size() >= slen && s.compare(s.size() - slen, slen, suffix) == 0;
    };

    ProjectDoc doc;
    const bool loaded = endsWith(projectPath, ".artcade")
        ? mod_->assetLoader->loadArtcade(projectPath, doc)
        : mod_->assetLoader->loadDirectory(projectPath, doc);

    if (!loaded) {
        std::cerr << "[App] Could not load project: " << projectPath << "\n";
        return false;
    }

    mod_->world->init(doc);

    // Phase D2: cache tile id → render colour for renderActiveScene()
    tileColors_.clear();
    for (const auto& t : doc.tilePalette)
        tileColors_[t.id] = t.color;

    std::vector<uint8_t> bytecode;
    if (mod_->assetLoader->loadLuaBytecode(doc.mainScriptPath, bytecode))
        mod_->luaHost->loadBytecodeBuffer(bytecode.data(), bytecode.size());

    targetDt_ = 1.f / doc.targetFPS;
    licenseTier_ = doc.licenseTier;

    // Show branded splash overlay on FREE tier (watermark requirement)
    if (licenseTier_ == "free")
        splash_ = std::make_unique<ArtCade::Modules::SplashState>("free");

    std::cout << "[App] Project loaded: " << doc.projectName
              << " (license=" << licenseTier_ << ")\n";
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

    // Cap accumulator to prevent spiral-of-death: if a frame spike happens
    // (e.g. audio trigger, entity destruction, JS GC) we allow at most 4
    // fixed steps per render frame.  This trades a little temporal accuracy
    // for rock-solid frame pacing and eliminates the "jump" on coin pick-up.
    if (accumulator_ > targetDt_ * 4.f)
        accumulator_ = targetDt_ * 4.f;

    mod_->input->poll();

    // Fixed timestep
    while (accumulator_ >= targetDt_) {
        // Clear Lua draw queue BEFORE this tick so that if multiple ticks
        // run in one render frame, only the LAST tick's drawScene() commands
        // survive to endFrame().  Without this, a frame with 2+ ticks
        // accumulates draw lists from every tick: objects destroyed in tick N
        // still appear as ghosts from tick N-1 (the coin-pickup flash).
        mod_->renderer->clearDrawQueue();

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

        // AutoDestroy system (Phase D1): lifespan>0 → destroy after N seconds.
        {
            std::vector<ArtCade::EntityId> toKill;
            for (ArtCade::EntityId id : mod_->entityManager->allIds()) {
                ArtCade::EntityDef* e = mod_->entityManager->get(id);
                if (!e || !e->autoDestroy || e->autoDestroy->lifespan <= 0.f)
                    continue;
                e->autoDestroy->_timeAlive += targetDt_;
                if (e->autoDestroy->_timeAlive >= e->autoDestroy->lifespan)
                    toKill.push_back(id);
            }
            for (ArtCade::EntityId id : toKill) {
                ArtCade::EntityDef* e = mod_->entityManager->get(id);
                if (e && e->physics.physicsHandle > 0)
                    mod_->physics->destroyBody(e->physics.physicsHandle);
                std::cout << "[AutoDestroy] destroyed entity " << id << "\n";
                mod_->entityManager->destroyEntity(id);
            }
        }

        mod_->audio->update();

        if (splash_) {
            splash_->update(targetDt_);
            if (splash_->isDone()) splash_.reset();
        }

        accumulator_ -= targetDt_;
    }

    renderActiveScene();
    EditorAPI::flushConsoleLines();
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
    // Use scene background colour (or neutral dark if no active scene)
    Vec4 bgColor = {0.05f, 0.07f, 0.10f, 1.f};
    if (const SceneDef* sc = mod_->sceneManager->activeScene())
        bgColor = sc->backgroundColor;

    mod_->renderer->beginFrame(bgColor);

    // Phase D2: tilemap layer (drawn under entities)
    if (const SceneDef* sc = mod_->sceneManager->activeScene()) {
        const auto& tm = sc->tilemap;
        if (tm.cols > 0 && tm.rows > 0) {
            const int n = static_cast<int>(tm.data.size());
            for (int r = 0; r < tm.rows; ++r) {
                for (int c = 0; c < tm.cols; ++c) {
                    const int idx = r * tm.cols + c;
                    if (idx >= n) continue;
                    const int id = tm.data[idx];
                    if (id <= 0) continue;
                    auto it = tileColors_.find(id);
                    const Vec4 col = (it != tileColors_.end())
                        ? it->second : Vec4{0.5f, 0.5f, 0.5f, 1.f};
                    mod_->renderer->drawRect(
                        c * tm.tileSize, r * tm.tileSize,
                        tm.tileSize, tm.tileSize, col);
                }
            }
        }
    }

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

    // FREE-tier splash overlay drawn on top of the game frame
    if (splash_)
        splash_->render(GetScreenWidth(), GetScreenHeight());

    mod_->renderer->endFrame();
}

// ---- Shutdown (reverse dependency order) --------------------------------

void Application::shutdownModules() {
    // Shutdown in reverse init order
    if (mod_->luaHost)          { mod_->luaHost->shutdown();          mod_->luaHost.reset();          }
    if (mod_->gameAPI)          { mod_->gameAPI->shutdown();          mod_->gameAPI.reset();          }
    if (mod_->world)            { mod_->world->shutdown();            mod_->world.reset();            }
    if (mod_->entityGateway)    { mod_->entityGateway->shutdown();    mod_->entityGateway.reset();    }
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

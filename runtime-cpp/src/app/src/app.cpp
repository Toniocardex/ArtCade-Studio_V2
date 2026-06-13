#include "../include/app.h"

#include <optional>

#ifdef ARTCADE_WASM
#include <emscripten/emscripten.h>
#endif

#include "../../modules/renderer/include/renderer.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/input/include/input.h"
#include "../../modules/audio/include/audio.h"
#include "../../modules/lua-runtime/include/lua-host.h"
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
#include "../../modules/sprite-animator/include/animation-clips-registry.h"
#include "../../modules/layer-manager/include/layer-manager.h"
#include "../../modules/camera-manager/include/camera-manager.h"
#include "../../modules/tween-manager/include/tween-manager.h"
#include "../../modules/save-load/include/save-load-manager.h"
#include "../../modules/dialog/include/dialog-manager.h"
#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"

#include "../render/editor-overlay-renderer.h"
#include "../render/ray-tint-widget.h"
#include "../render/tilemap-renderer.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

namespace {

using ArtCade::Modules::VariableManager;

/** Raw value → string, matching the Lua _logic_tostr path (integral → "12"). */
std::string textValueToString(const VariableManager::Value& v) {
    if (const auto* i = std::get_if<int32_t>(&v))     return std::to_string(*i);
    if (const auto* b = std::get_if<bool>(&v))        return *b ? "true" : "false";
    if (const auto* s = std::get_if<std::string>(&v)) return *s;
    if (const auto* f = std::get_if<float>(&v)) {
        char buf[32];
        if (std::isfinite(*f) && *f == std::floor(*f))
            std::snprintf(buf, sizeof(buf), "%lld",
                          static_cast<long long>(*f));
        else
            std::snprintf(buf, sizeof(buf), "%g", *f);
        return buf;
    }
    return "";
}

double textValueToNumber(const VariableManager::Value& v) {
    if (const auto* i = std::get_if<int32_t>(&v)) return *i;
    if (const auto* f = std::get_if<float>(&v))   return *f;
    if (const auto* b = std::get_if<bool>(&v))    return *b ? 1.0 : 0.0;
    if (const auto* s = std::get_if<std::string>(&v)) {
        try { return std::stod(*s); } catch (...) { return 0.0; }
    }
    return 0.0;
}

/** Format a bound value; mirror of _logic_fmt in compiler-prelude.ts. */
std::string formatTextValue(const VariableManager::Value& v,
                            const std::string& fmt, int digits) {
    if (fmt.empty() || fmt == "text") return textValueToString(v);
    const double n = textValueToNumber(v);
    char buf[64];
    if (digits < 0) digits = 0;
    if (fmt == "integer") {
        std::snprintf(buf, sizeof(buf), "%lld", std::llround(n));
    } else if (fmt == "padded") {
        std::snprintf(buf, sizeof(buf), "%0*lld", digits, std::llround(n));
    } else if (fmt == "time") {
        long long s = std::llround(n);
        if (s < 0) s = 0;
        std::snprintf(buf, sizeof(buf), "%lld:%02lld", s / 60, s % 60);
    } else if (fmt == "percent") {
        std::snprintf(buf, sizeof(buf), "%lld%%", std::llround(n));
    } else if (fmt == "decimals") {
        std::snprintf(buf, sizeof(buf), "%.*f", digits, n);
    } else {
        return textValueToString(v);
    }
    return buf;
}

void drawPhysicsDebugColliders(ArtCade::Modules::Renderer& renderer,
                               ArtCade::Modules::RuntimeEntityGateway& gateway,
                               ArtCade::Modules::Physics& physics) {
    gateway.forEachActivePhysicsBody(
        [&](ArtCade::EntityId id, uint32_t handle, ArtCade::Transform& transform) {
            ArtCade::PhysicsComponent pc{};
            if (!gateway.getPhysicsComponent(id, pc)) return;
            const ArtCade::Vec2 pos = physics.getPosition(handle);
            const ArtCade::Vec2 vel = physics.getLinearVelocity(handle);
            const ArtCade::Collider& col = pc.collider;
            const float sx = std::abs(transform.scale.x);
            const float sy = std::abs(transform.scale.y);
            const float ox = col.offset.x * sx;
            const float oy = col.offset.y * sy;

            ArtCade::Vec4 color{0.2f, 1.f, 0.35f, 0.55f};
            if (col.isSensor)
                color = {1.f, 1.f, 0.2f, 0.5f};
            else if (pc.bodyType == ArtCade::BodyType::Static)
                color = {0.5f, 0.7f, 1.f, 0.5f};

            if (col.shape == ArtCade::ColliderShape::Circle) {
                const float r = col.size.x * std::max(sx, sy);
                renderer.drawCircle(pos.x + ox, pos.y + oy, r, color);
            } else {
                const float w = col.size.x * sx;
                const float h = col.size.y * sy;
                renderer.drawRect(
                    pos.x + ox - w * 0.5f, pos.y + oy - h * 0.5f, w, h, color);
            }

            const float vlen2 = vel.x * vel.x + vel.y * vel.y;
            if (vlen2 > 4.f) {
                const float inv = 0.05f / std::sqrt(vlen2);
                renderer.drawLine(
                    pos.x, pos.y,
                    pos.x + vel.x * inv, pos.y + vel.y * inv,
                    {0.2f, 1.f, 0.2f, 0.85f});
            }
        });
}

} // namespace

namespace ArtCade {

// drawEditorBackdrop / drawEditorGuides / selection gizmo live in
// render/editor-overlay-renderer.cpp; tilemap rendering lives in
// render/tilemap-renderer.cpp. This translation unit only orchestrates
// the render order and owns the per-project tileset/palette caches.

// ---- Pimpl for module storage -------------------------------------------
struct Application::Modules {
    // Core systems
    std::unique_ptr<ArtCade::Modules::Renderer>      renderer;
    std::unique_ptr<ArtCade::Modules::Physics>       physics;
    std::unique_ptr<ArtCade::Modules::Input>         input;
    std::unique_ptr<ArtCade::Modules::Audio>         audio;
    std::unique_ptr<ArtCade::Modules::LuaHost>       luaHost;
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
    std::unique_ptr<ArtCade::Modules::DialogManager>  dialogManager;
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
    // Editor preview: no disk project at boot — React pushes JSON via editor_load_project.
    (void)argc; (void)argv;
    if (!initUtilities() || !initSubsystems()) {
        std::cerr << "[App] Initialization failed.\n";
        return 1;
    }
    // targetDt_ / physicsMode_ applied on first editor_load_project via applyRuntimeSettings.
    targetDt_ = 1.f / 60.f;
#else
    std::string projectPath = (argc > 1) ? argv[1] : "game.artcade";
    if (!initModules(projectPath)) {
        std::cerr << "[App] Initialization failed.\n";
        return 1;
    }
#endif

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
    ctx_.profiler        = &profiler_;

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
    mod_->assetLoader   = std::make_unique<ArtCade::Modules::AssetLoader>();

    mod_->renderer->setWindowSize(1280, 720, "ArtCade V2");

    if (!mod_->renderer->init()      ||
        !mod_->physics->init()       ||
        !mod_->input->init()         ||
        !mod_->audio->init()         ||
        !mod_->assetLoader->init())
        return false;

    // TextureManager richiede la finestra Raylib già aperta
    mod_->textureManager = std::make_unique<ArtCade::Modules::TextureManager>();
    if (!mod_->textureManager->init()) return false;
    ctx_.textureManager = mod_->textureManager.get();

    mod_->sceneManager = std::make_unique<ArtCade::Modules::SceneManager>();
    if (!mod_->sceneManager->init()) return false;

    mod_->entityGateway = std::make_unique<ArtCade::Modules::RuntimeEntityGateway>(
        *mod_->sceneManager);
    if (!mod_->entityGateway->init()) return false;

    mod_->world = std::make_unique<World>(
        *mod_->entityGateway, *mod_->physics, *mod_->variableManager);
    mod_->entityGateway->setPhysics(mod_->physics.get());
    mod_->world->setRenderer(mod_->renderer.get());

    // Popola EngineContext — GameAPI e LuaHost ne hanno bisogno
    ctx_.renderer      = mod_->renderer.get();
    ctx_.physics       = mod_->physics.get();
    ctx_.input         = mod_->input.get();
    ctx_.audio         = mod_->audio.get();
    ctx_.sceneManager  = mod_->sceneManager.get();
    ctx_.entityGateway = mod_->entityGateway.get();
    ctx_.assetLoader   = mod_->assetLoader.get();
    ctx_.world         = mod_->world.get();

    mod_->renderer->setTextureKeyResolver(
        [loader = mod_->assetLoader.get()](const std::string& ref) {
            return loader ? loader->resolveImagePath(ref) : ref;
        });
    mod_->renderer->setFontKeyResolver(
        [loader = mod_->assetLoader.get()](const std::string& ref) {
            return loader ? loader->resolveFontPath(ref) : ref;
        });
    mod_->audio->setAssetPathResolver(
        [loader = mod_->assetLoader.get()](const std::string& ref) {
            return loader ? loader->resolveAudioPath(ref) : ref;
        });

    mod_->dialogManager = std::make_unique<ArtCade::Modules::DialogManager>();
    if (!mod_->dialogManager->init()) return false;
    mod_->dialogManager->setContext(&ctx_);
    ctx_.dialogManager = mod_->dialogManager.get();

    mod_->gameAPI = std::make_unique<ArtCade::Modules::GameAPI>(ctx_);
    if (!mod_->gameAPI->init()) return false;
    ctx_.gameAPI = mod_->gameAPI.get();

    mod_->luaHost = std::make_unique<ArtCade::Modules::LuaHost>();
    mod_->luaHost->registerBindings([&](sol::state& lua) {
        mod_->gameAPI->registerAll(lua);
    });
    if (!mod_->luaHost->init()) return false;
    ctx_.luaHost = mod_->luaHost.get();

    // Wire EditorAPI to RuntimeEntityGateway (+ Lua, Renderer) so editor
    // commands (editor_load_project, editor_set_transform, …) reach state.
    EditorAPI::wireEngine(mod_->entityGateway.get());
    EditorAPI::wireLua(mod_->luaHost.get());   // hot-reload from Logic Board
    EditorAPI::wireRenderer(mod_->renderer.get()); // tileset image upload (F3)
    EditorAPI::wireDialog(mod_->dialogManager.get());
    EditorAPI::wireSpriteAnimator(mod_->spriteAnimator.get());
    mod_->entityGateway->setSpriteAnimator(mod_->spriteAnimator.get());
    EditorAPI::wireAudio(mod_->audio.get());
    EditorAPI::init("#artcade-canvas");

#ifdef ARTCADE_WASM
    // Replace the previous Application* static (TECHNICAL_DEBT_REVIEW §8) with
    // a callback. editor_load_project invokes this lambda after the gateway
    // is repopulated, so cache cleanup / Lua reset / texture rebind all run
    // in the right order without editor-api needing to depend on app.h.
    EditorAPI::setProjectLoadedHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>&     tilesets,
               const ProjectRuntimeSettings&        settings) {
            applyEditorProjectLoaded(palette, tilesets, settings);
        });
    EditorAPI::setPreviewRestoreHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>&     tilesets,
               const ProjectRuntimeSettings&        settings) {
            applyEditorPreviewRestore(palette, tilesets, settings);
        });
    EditorAPI::setEnterPlayHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>&     tilesets,
               const ProjectRuntimeSettings&        settings) {
            applyEditorEnterPlay(palette, tilesets, settings);
        });
    EditorAPI::setExitPlayHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>&     tilesets,
               const ProjectRuntimeSettings&        settings,
               const std::string&                   luaSource) {
            applyEditorExitPlay(palette, tilesets, settings, luaSource);
        });
#endif

    return true;
}

void Application::applyRuntimeSettings(const ProjectRuntimeSettings& settings,
                                       ViewportPolicy              policy) {
    const float fps = settings.targetFPS;
    const float safeFps =
        (std::isfinite(fps) && fps >= 1.f) ? fps : 60.f;
    targetDt_     = 1.f / safeFps;
    physicsMode_  = settings.physicsMode;

    if (mod_ && mod_->physics) {
        const float g = std::isfinite(settings.gravity) ? settings.gravity : 9.81f;
        mod_->physics->setGravity({0.f, g});
    }
    if (mod_ && mod_->timeManager) {
        const float ts = std::isfinite(settings.timeScale) && settings.timeScale > 0.f
            ? settings.timeScale
            : 1.f;
        mod_->timeManager->setTimeScale(ts, "gameplay");
    }
#ifdef ARTCADE_WASM
    EditorAPI::s_physicsDebugDraw = settings.physicsDebugDraw;
#endif

    if (!mod_ || !mod_->renderer || !mod_->sceneManager) return;

    const SceneDef* sc = mod_->sceneManager->activeScene();
    if (!sc) return;

    if (policy == ViewportPolicy::EditorPreview) {
        if (sc->worldSize.x > 0.f && sc->worldSize.y > 0.f) {
            mod_->renderer->setWindowSize(
                static_cast<uint32_t>(sc->worldSize.x),
                static_cast<uint32_t>(sc->worldSize.y),
                "ArtCade V2");
        }
        mod_->renderer->setSceneViewport(sc->worldSize, sc->worldSize);
        return;
    }

    if (sc->viewportSize.x > 0.f && sc->viewportSize.y > 0.f) {
        mod_->renderer->setWindowSize(
            static_cast<uint32_t>(sc->viewportSize.x),
            static_cast<uint32_t>(sc->viewportSize.y),
            "ArtCade V2");
    }
    mod_->renderer->setSceneViewport(sc->worldSize, sc->viewportSize);
}

#ifdef ARTCADE_WASM

void Application::applyEditorProjectCommon(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>&     tilesets)
{
    tileColors_.clear();
    for (const auto& t : tilePalette)
        tileColors_[t.id] = t.color;

    tilesets_.clear();
    for (const auto& ts : tilesets)
        tilesets_[ts.assetId] = ts;
    mod_->sceneManager->setTilesets(tilesets);

    if (mod_->textureManager)
        mod_->textureManager->unloadAll();
    if (mod_->renderer)
        mod_->renderer->evictCachedAssets();
}

// Both applyEditorProjectLoaded and applyEditorPreviewRestore replace the
// active project / entity pool, so any stateful module that buffered work
// from the previous session (looping music, in-flight tweens, queued
// events, frame-time accumulator, etc.) must be reset before the next
// tick. Previously only the STOP-preview path did this; structural edits
// in EDIT mode skipped the reset and leaked state across loads.
void Application::resetGameplayRuntimeModules() {
    if (mod_->tweenManager)   mod_->tweenManager->cancelAll();
    if (mod_->spriteAnimator) mod_->spriteAnimator->clearInstances();
    if (mod_->audio) {
        mod_->audio->stopAll();
        mod_->audio->evictSoundCache();
    }

    if (mod_->eventBus)         { mod_->eventBus->shutdown();         mod_->eventBus->init(); }
    if (mod_->layerManager)     { mod_->layerManager->shutdown();     mod_->layerManager->init(); }
    if (mod_->saveLoadManager)  { mod_->saveLoadManager->shutdown();  mod_->saveLoadManager->init(); }
    if (mod_->timeManager)      { mod_->timeManager->shutdown();      mod_->timeManager->init(); }
    if (mod_->gameStateManager) { mod_->gameStateManager->shutdown(); mod_->gameStateManager->init(); }
    if (mod_->cameraManager)      mod_->cameraManager->init();

    accumulator_ = 0.f;
}

void Application::applyEditorProjectLoaded(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>&     tilesets,
    const ProjectRuntimeSettings&        settings)
{
    applyEditorProjectCommon(tilePalette, tilesets);
    applyRuntimeSettings(settings, ViewportPolicy::EditorPreview);

    if (mod_->dialogManager && mod_->assetLoader)
        mod_->dialogManager->loadDialogsFromDirectory(mod_->assetLoader->projectRoot());

    resetGameplayRuntimeModules();

    if (mod_->world)
        mod_->world->syncAfterEditorProject(tilePalette);
}

void Application::applyEditorPreviewRestore(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>&     tilesets,
    const ProjectRuntimeSettings&        settings)
{
    applyEditorProjectCommon(tilePalette, tilesets);
    applyRuntimeSettings(settings, ViewportPolicy::EditorPreview);

    resetGameplayRuntimeModules();

    if (mod_->world)
        mod_->world->restoreDesignState(tilePalette);
}

void Application::applyEditorEnterPlay(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>&     tilesets,
    const ProjectRuntimeSettings&        settings)
{
    applyEditorProjectCommon(tilePalette, tilesets);
    applyRuntimeSettings(settings, ViewportPolicy::NativePlay);

    resetGameplayRuntimeModules();

    if (mod_->world)
        mod_->world->syncAfterEditorProject(tilePalette);
}

void Application::applyEditorExitPlay(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>&     tilesets,
    const ProjectRuntimeSettings&        settings,
    const std::string&                   luaSource)
{
    applyEditorProjectCommon(tilePalette, tilesets);
    applyRuntimeSettings(settings, ViewportPolicy::EditorPreview);

    if (mod_->luaHost && !luaSource.empty())
        mod_->luaHost->loadLuaSource(luaSource);

    resetGameplayRuntimeModules();

    if (mod_->world)
        mod_->world->restoreDesignState(tilePalette);
}
#endif

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
    if (mod_->spriteAnimator)
        registerAnimationClipsFromAssets(*mod_->spriteAnimator, doc.imageAssets);
    applyRuntimeSettings(runtimeSettingsFromProjectDoc(doc), ViewportPolicy::NativePlay);

    // Phase D2: cache tile id → render colour for renderActiveScene()
    tileColors_.clear();
    for (const auto& t : doc.tilePalette)
        tileColors_[t.id] = t.color;

    // Phase F3: cache tilesets by id (spritesheet atlas rendering)
    tilesets_.clear();
    for (const auto& ts : doc.tilesets)
        tilesets_[ts.assetId] = ts;
    // Make tilesets live data in SceneManager so the render path also sees
    // tilesets pushed by the editor via editor_load_project (hot-reload).
    mod_->sceneManager->setTilesets(doc.tilesets);

    if (!doc.mainScriptPath.empty()) {
        std::vector<uint8_t> bytecode;
        const bool haveBytecode =
            mod_->assetLoader->loadLuaBytecode(doc.mainScriptPath, bytecode)
            && !bytecode.empty();
        if (!haveBytecode
            || !mod_->luaHost->loadBytecodeBuffer(bytecode.data(), bytecode.size())) {
            std::cerr << "[App] Missing or invalid main script bytecode: "
                      << doc.mainScriptPath;
            const std::string& err = mod_->luaHost->lastError();
            if (!err.empty())
                std::cerr << " (" << err << ")";
            std::cerr << "\n";
            return false;
        }
    }

    licenseTier_ = doc.licenseTier;

    // Show branded splash overlay on FREE tier (watermark requirement)
    if (licenseTier_ == "free")
        splash_ = std::make_unique<ArtCade::Modules::SplashState>("free");

    if (mod_->dialogManager)
        mod_->dialogManager->loadDialogsFromDirectory(mod_->assetLoader->projectRoot());

    std::cout << "[App] Project loaded: " << doc.projectName
              << " (license=" << licenseTier_ << ")\n";
    return true;
}

// ---- Single frame -------------------------------------------------------
// Fixed-step order (gameplay → Lua → physics → sync → sensors): see
// docs/FIXED_STEP_CONTRACT.md — keep new systems aligned with that contract.

void Application::tickFixedStep(float dt) {
    using Clock = std::chrono::steady_clock;
    auto elapsedMs = [](Clock::time_point start) {
        return std::chrono::duration<double, std::milli>(
            Clock::now() - start).count();
    };

    // Clear Lua draw queue BEFORE this tick so that if multiple ticks
    // run in one render frame, only the LAST tick's drawScene() commands
    // survive to endFrame().  Without this, a frame with 2+ ticks
    // accumulates draw lists from every tick: objects destroyed in tick N
    // still appear as ghosts from tick N-1 (the coin-pickup flash).
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
    if (mod_->dialogManager) {
        mod_->dialogManager->tick(dt);
    }
    // camera.shake adds trauma during Lua; offset/decay run once per render frame
    // in loopIteration() so multi-step catch-up does not drain trauma early.
    // Platformer integrates Transform before physics; Solid grounding uses AABB.
    if (!mod_->dialogManager || !mod_->dialogManager->isBlocking()) {
        mod_->world->tickPlatformerControllers(dt);
        mod_->world->tickSimpleMovementIntents(dt);
    }
    const bool runPhysics =
        physicsMode_ == PhysicsMode::On
        || (physicsMode_ == PhysicsMode::Auto && mod_->physics->hasActiveBodies());
    if (runPhysics) {
        const auto start = Clock::now();
        mod_->physics->step(dt);
        profiler_.addPhysicsMs(elapsedMs(start));
    }
    // Lua may have queued destroys this tick. Process them BEFORE syncing
    // physics back to ECS so that doomed entities don't briefly snap to
    // the last simulated body position in the frame they get removed.
    mod_->world->flushEntityQueues();
    if (runPhysics)
        mod_->world->syncPhysicsToEntities();
    mod_->world->tickCameraTargets(dt);
    // Sensor edges now run AFTER physics step + sync, so begin/end events
    // are dispatched in the same frame as the overlap (previously delayed
    // by one fixed step — noticeable for fast bullets).
    if (runPhysics) {
        const auto start = Clock::now();
        mod_->world->refreshSensorEdges();
        const uint32_t events = mod_->gameAPI->dispatchSensorEvents();
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.addLuaEvents(events);
    }

    // Dispatch lifecycle events (Spawned / Destroyed) from EnTT
    // signals to Lua handlers registered via lifecycle.onSpawn /
    // lifecycle.onDestroy. Runs *after* flushEntityQueues so all
    // queued spawn+destroy of this step are visible in order.
    {
        const auto start = Clock::now();
        const uint32_t events = mod_->gameAPI->dispatchLifecycleEvents();
        profiler_.addLuaMs(elapsedMs(start));
        profiler_.addLuaEvents(events);
    }

    // AutoDestroy: World ticks lifespans after physics sync; flush + lifecycle
    // drain so onDestroy handlers see destroys this frame.
    {
        mod_->world->tickAutoDestroy(dt);
        {
            const auto start = Clock::now();
            mod_->world->flushEntityQueues();
            profiler_.addGameplayMs(elapsedMs(start));
        }
        // Drain the lifecycle events queued by the auto-destroy
        // flush so onDestroy handlers see them this frame, not the next.
        {
            const auto start = Clock::now();
            const uint32_t events = mod_->gameAPI->dispatchLifecycleEvents();
            profiler_.addLuaMs(elapsedMs(start));
            profiler_.addLuaEvents(events);
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
    using Clock = std::chrono::steady_clock;
    auto elapsedMs = [](Clock::time_point start) {
        return std::chrono::duration<double, std::milli>(
            Clock::now() - start).count();
    };

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

    if (mod_->renderer) {
        const float dt = mod_->renderer->deltaTime();
        const float fps = (dt > 1e-6f) ? (1.f / dt) : 0.f;
        const auto snap = profiler_.snapshot();
        EditorAPI::publishRuntimeProfile(
            fps, static_cast<float>(snap.luaMs),
            static_cast<float>(snap.physicsMs),
            static_cast<float>(snap.renderMs),
            snap.entityCount, snap.activePhysicsBodies);
        EditorAPI::notifyRuntimeProfile(
            fps, static_cast<float>(snap.luaMs),
            static_cast<float>(snap.physicsMs),
            static_cast<float>(snap.renderMs),
            snap.entityCount, snap.activePhysicsBodies);
    }
}

void Application::loopIteration() {
    using Clock = std::chrono::steady_clock;
    auto elapsedMs = [](Clock::time_point start) {
        return std::chrono::duration<double, std::milli>(
            Clock::now() - start).count();
    };
    profiler_.beginFrame();
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

#ifdef ARTCADE_WASM
    const bool simulating = EditorAPI::s_mode == 1;
#else
    const bool simulating = true;
#endif

    float simDtThisFrame = 0.f;
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
            simDtThisFrame += targetDt_;
        }
    } else {
        // EDIT mode: discard accumulated time so PLAY does not burst-catch-up.
        accumulator_ = 0.f;
    }

    // Shake offset/decay once per render frame (see FIXED_STEP_CONTRACT.md).
    // Use accumulated sim dt when gameplay stepped; otherwise wall-clock dt
    // so edit-mode Logic Board hot reload (_logic_init → camera.shake) still
    // animates before PLAY.
    if (mod_->cameraManager->trauma() > 0.f) {
        const float shakeDt =
            (simDtThisFrame > 0.f) ? simDtThisFrame : frameTime;
        mod_->cameraManager->refreshShakeOffset(shakeDt);
        mod_->cameraManager->decayTrauma(shakeDt);
    }

    tickFrameEnd();
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
    const SceneDef* activeScene = mod_->sceneManager->activeScene();
    const Vec4 clearColor = {0.015f, 0.018f, 0.025f, 1.f};

    // Camera shake — render-only offset (see Renderer::setRenderShakeOffset).
    // Do not use setCameraPosition for shake: clampCameraTarget can zero it out
    // when the world fits the viewport (editor 1:1 preview).
    const Vec2 shake = mod_->cameraManager->shakeOffset();
    mod_->renderer->setRenderShakeOffset(shake);

    // Snapshot the editor flags ONCE per frame. Reading EditorAPI::s_*
    // statics inside the renderers would leak runtime-bridge state into
    // every render layer; keeping it here mirrors RuntimeSyncService on
    // the editor side (one place owns the editor↔runtime contract).
    // Native game.exe has no editor attached: force play-mode chrome
    // (no backdrop grid, no guides, no selection gizmo) regardless of
    // the EditorAPI defaults — those exist only for the WASM preview.
#ifdef ARTCADE_WASM
    const EditorOverlayState overlay{
        /* inEditMode    */ EditorAPI::s_mode == 0,
        /* guidesEnabled */ EditorAPI::s_editorGuidesEnabled,
        /* gridSize      */ EditorAPI::s_editorGridSize,
        /* selectedId    */ EditorAPI::s_selectedEntityId,
    };
#else
    const EditorOverlayState overlay{
        /* inEditMode    */ false,
        /* guidesEnabled */ false,
        /* gridSize      */ 0.f,
        /* selectedId    */ 0u,
    };
#endif

    mod_->renderer->beginFrame(clearColor);

    if (activeScene) {
        EditorOverlayRenderer::drawBackdrop(*mod_->renderer, *activeScene, overlay);

        // World background rect (game layer, always drawn).
        mod_->renderer->drawRectImmediate(
            0.f, 0.f,
            std::max(1.f, activeScene->worldSize.x),
            std::max(1.f, activeScene->worldSize.y),
            activeScene->backgroundColor);

        // Tilemap layer (drawn under entities). Live tilesets come from
        // SceneManager (refreshed on editor hot-reload); tilesets_ /
        // tileColors_ are the startup caches populated by loadProject().
        TilemapRenderer::draw(*mod_->renderer, *activeScene,
                              mod_->sceneManager->tilesets(),
                              tilesets_, tileColors_);

        EditorOverlayRenderer::drawGrid(*mod_->renderer, *activeScene, overlay);
    }

    // Entity sprites. EnTT-backed visitor: one registry pass, typed
    // access to Transform + SpriteComponent, only active-scene entities
    // (SceneActiveTag) are visited.
    const bool inEditMode = overlay.inEditMode;
    mod_->entityGateway->forEachActiveRenderable(
        [renderer = mod_->renderer.get(),
         animator = mod_->spriteAnimator.get(),
         inEditMode, gw = mod_->entityGateway.get(),
         vm = mod_->variableManager.get()]
        (EntityId id, const Transform& t, const SpriteComponent& s) {
            if (!inEditMode && s.alpha <= 0.001f)
                return;
            float alpha = s.alpha;
            const bool placeholderFill = s.spriteAssetId.empty();
            // Prototype fill blocks stay fully opaque in the editor; dimming
            // (0.45) applies only to textured sprites hidden from play.
            if (inEditMode && !placeholderFill && !gw->visibleInGame(id))
                alpha *= 0.45f;
            if (inEditMode && placeholderFill)
                alpha = 1.f;
            TextComponent text{};
            const bool hasText = gw->getText(id, text) &&
                (!text.text.empty() || !text.bindKey.empty());
            // Pure text label (Text + no sprite asset): the placeholder
            // block is an editor-only placement gizmo, hidden in play.
            const bool textOnly = hasText && placeholderFill;

            const auto frame = animator ? animator->currentFrame(id)
                                        : ::ArtCade::Modules::SpriteAnimator::Frame{};
            if (frame.w > 0 && frame.h > 0) {
                renderer->drawSpriteFrame(
                    s.spriteAssetId,
                    static_cast<float>(frame.x),
                    static_cast<float>(frame.y),
                    static_cast<float>(frame.w),
                    static_cast<float>(frame.h),
                    t.position, t.rotation, t.scale,
                    s.tint, alpha, s.pivot);
            } else if (!textOnly || inEditMode) {
                renderer->drawSprite(
                    s.spriteAssetId,
                    t.position, t.rotation, t.scale,
                    s.tint, s.fillColor, alpha, s.shaderEffect, s.pivot);
            }

            // Text label (TextComponent). Queued via drawText, so it
            // renders above sprites; dims with the sprite in edit mode.
            if (hasText) {
                // Auto-bind: show the live variable when running. When the
                // variable is absent (edit mode / not yet set), fall back to
                // the static text as a design-time preview.
                std::string display = text.text;
                if (!text.bindKey.empty() && vm && vm->exists(text.bindKey)) {
                    display = text.prefix +
                              formatTextValue(vm->get(text.bindKey),
                                              text.format, text.digits) +
                              text.suffix;
                } else if (!text.bindKey.empty()) {
                    display = text.prefix + text.text + text.suffix;
                }
                Vec4 c = text.color;
                if (inEditMode && !gw->visibleInGame(id))
                    c.a *= 0.45f;
                const int align = text.align == "center" ? 1
                                : text.align == "right"  ? 2 : 0;
                renderer->drawText(
                    display,
                    t.position.x + text.offsetX,
                    t.position.y + text.offsetY,
                    text.size, c, text.fontPath, align, text.screenSpace);
            }
        });

    // Scene fade (game layer, drawn over entities, under editor chrome).
    const float fade = mod_->entityGateway->sceneFadeAlpha();
    if (fade > 0.f)
        mod_->renderer->drawFadeOverlay(fade);

    // Editor chrome: guides + selection gizmo. Both no-op when not in edit
    // mode or when there is no selection, so the play frame is identical
    // to the published build.
    if (activeScene)
        EditorOverlayRenderer::drawGuides(*mod_->renderer, *activeScene, overlay);

    if (overlay.inEditMode) {
        mod_->entityGateway->forEachActiveHiddenInGame(
            [renderer = mod_->renderer.get(), gw = mod_->entityGateway.get(),
             selectedId = overlay.selectedId]
            (EntityId id, const Transform& t, const PhysicsComponent&) {
                if (id == selectedId) return;
                SpriteComponent sprite{};
                if (!gw->getSprite(id, sprite)) return;
                EditorOverlayRenderer::drawHiddenInGameOutline(*renderer, t, sprite);
            });
    }

    if (overlay.selectedId != 0u) {
        Transform selectedTransform{};
        SpriteComponent selectedSprite{};
        SensorComponent selectedSensor{};
        std::optional<SensorComponent> sensor;
        if (mod_->entityGateway->getSensor(overlay.selectedId, selectedSensor))
            sensor = selectedSensor;
        if (mod_->entityGateway->getTransform(overlay.selectedId, selectedTransform) &&
            mod_->entityGateway->getSprite(overlay.selectedId, selectedSprite)) {
            const bool hiddenInGame =
                !mod_->entityGateway->visibleInGame(overlay.selectedId);
            EditorOverlayRenderer::drawSelection(
                *mod_->renderer, selectedTransform, selectedSprite, sensor,
                overlay, hiddenInGame);
        }
    }

    // FREE-tier splash overlay drawn on top of the game frame.
    if (splash_)
        splash_->render(
            static_cast<int>(mod_->renderer->windowWidth()),
            static_cast<int>(mod_->renderer->windowHeight()));

    if (mod_->dialogManager && mod_->dialogManager->isActive())
        mod_->dialogManager->render();

    if (EditorAPI::s_physicsDebugDraw && !overlay.inEditMode && mod_->physics) {
        drawPhysicsDebugColliders(
            *mod_->renderer, *mod_->entityGateway, *mod_->physics);
    }

    mod_->renderer->endWorldPass();
    mod_->renderer->endScreenPass();   // HUD text (screen-space TextComponent)
    RayTintWidget::draw();
    mod_->renderer->presentScreen();

    mod_->renderer->setRenderShakeOffset({ 0.f, 0.f });
}

// ---- Shutdown (reverse dependency order) --------------------------------

void Application::shutdownModules() {
    // Shutdown in reverse init order
    if (mod_->luaHost)          { mod_->luaHost->shutdown();          mod_->luaHost.reset();          }
    if (mod_->gameAPI)          { mod_->gameAPI->shutdown();          mod_->gameAPI.reset();          }
    if (mod_->dialogManager)    { mod_->dialogManager->shutdown();    mod_->dialogManager.reset();    }
    if (mod_->world)            { mod_->world->shutdown();            mod_->world.reset();            }
    if (mod_->entityGateway)    { mod_->entityGateway->shutdown();    mod_->entityGateway.reset();    }
    if (mod_->sceneManager)     { mod_->sceneManager->shutdown();     mod_->sceneManager.reset();     }
    if (mod_->assetLoader)      { mod_->assetLoader->shutdown();      mod_->assetLoader.reset();      }
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

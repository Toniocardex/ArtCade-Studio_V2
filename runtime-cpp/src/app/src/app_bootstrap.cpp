#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/scene-system/include/scene-mutation-result.h"
#include "../../modules/scene-system/include/scene-patch.h"

#include <memory>
#include <string>
#include <vector>

namespace ArtCade {

bool Application::initModules(const std::string& projectPath) {
    return initUtilities() && initSubsystems() && loadProject(projectPath);
}

bool Application::initUtilities() {
    mod_->eventBus = std::make_unique<ArtCade::Modules::EventBus>();
    mod_->timeManager = std::make_unique<ArtCade::Modules::TimeManager>();
    mod_->variableManager = std::make_unique<ArtCade::Modules::VariableManager>();
    mod_->tweenManager = std::make_unique<ArtCade::Modules::TweenManager>();
    mod_->spriteAnimator = std::make_unique<ArtCade::Modules::SpriteAnimator>();
    mod_->layerManager = std::make_unique<ArtCade::Modules::LayerManager>();
    mod_->cameraManager = std::make_unique<ArtCade::Modules::CameraManager>();
    mod_->saveLoadManager = std::make_unique<ArtCade::Modules::SaveLoadManager>();

    if (!mod_->eventBus->init() || !mod_->timeManager->init()
        || !mod_->variableManager->init() || !mod_->tweenManager->init()
        || !mod_->spriteAnimator->init() || !mod_->layerManager->init()
        || !mod_->cameraManager->init() || !mod_->saveLoadManager->init()) {
        return false;
    }

    ctx_.eventBus = mod_->eventBus.get();
    ctx_.timeManager = mod_->timeManager.get();
    ctx_.variableManager = mod_->variableManager.get();
    ctx_.tweenManager = mod_->tweenManager.get();
    ctx_.spriteAnimator = mod_->spriteAnimator.get();
    ctx_.layerManager = mod_->layerManager.get();
    ctx_.cameraManager = mod_->cameraManager.get();
    ctx_.saveLoadManager = mod_->saveLoadManager.get();
    ctx_.profiler = &profiler_;

    mod_->gameStateManager = std::make_unique<ArtCade::Modules::GameStateManager>();
    mod_->gameStateManager->setEventBus(mod_->eventBus.get());
    if (!mod_->gameStateManager->init()) return false;
    ctx_.gameStateManager = mod_->gameStateManager.get();

    return true;
}

bool Application::initSubsystems() {
    mod_->editorViewport =
        std::make_unique<ArtCade::Presentation::EditorViewportService>();
    mod_->renderer = std::make_unique<ArtCade::Modules::Renderer>();
    mod_->physics = std::make_unique<ArtCade::Modules::Physics>();
    mod_->input = std::make_unique<ArtCade::Modules::Input>();
    mod_->audio = std::make_unique<ArtCade::Modules::Audio>();
    mod_->assetLoader = std::make_unique<ArtCade::Modules::AssetLoader>();

    mod_->renderer->setWindowSize(1280, 720, "ArtCade V2");

    if (!mod_->renderer->init() || !mod_->physics->init() || !mod_->input->init()
        || !mod_->audio->init() || !mod_->assetLoader->init()) {
        return false;
    }

    mod_->textureManager = std::make_unique<ArtCade::Modules::TextureManager>();
    if (!mod_->textureManager->init()) return false;
    ctx_.textureManager = mod_->textureManager.get();

    mod_->sceneManager = std::make_unique<ArtCade::Modules::SceneManager>();
    if (!mod_->sceneManager->init()) return false;

    mod_->sceneMutation = std::make_unique<ArtCade::Modules::SceneMutationService>(
        *mod_->sceneManager);

    mod_->entityGateway = std::make_unique<ArtCade::Modules::RuntimeEntityGateway>(
        *mod_->sceneManager);
    if (!mod_->entityGateway->init()) return false;

    mod_->sceneLifecycle = std::make_unique<ArtCade::Modules::SceneLifecycleService>(
        *mod_->sceneManager,
        *mod_->sceneMutation,
        [gw = mod_->entityGateway.get()]() {
            if (gw) gw->syncSceneActivation();
        });
    mod_->sceneLifecycle->set_transition_handler(
        [this](const ArtCade::Modules::SceneTransitionResult& result) {
            handleSceneTransition(result);
        });
    mod_->entityGateway->set_scene_lifecycle_service(mod_->sceneLifecycle.get());

    mod_->world = std::make_unique<World>(
        *mod_->entityGateway, *mod_->physics, *mod_->variableManager);
    mod_->entityGateway->setPhysics(mod_->physics.get());
    mod_->world->setRenderer(mod_->renderer.get());
    mod_->sceneLifecycle->set_gameplay_reset_handler([this]() {
        if (mod_->world) mod_->world->onSceneActivated();
    });
    mod_->world->setSceneLifecycleService(mod_->sceneLifecycle.get());

    ctx_.renderer = mod_->renderer.get();
    ctx_.physics = mod_->physics.get();
    ctx_.input = mod_->input.get();
    ctx_.audio = mod_->audio.get();
    ctx_.sceneManager = mod_->sceneManager.get();
    ctx_.entityGateway = mod_->entityGateway.get();
    ctx_.assetLoader = mod_->assetLoader.get();
    ctx_.world = mod_->world.get();

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

    EditorAPI::wireEngine(mod_->entityGateway.get());
    EditorAPI::wireLua(mod_->luaHost.get());
    EditorAPI::wireRenderer(mod_->renderer.get());
    EditorAPI::wireEditorViewport(mod_->editorViewport.get());
    EditorAPI::wireDialog(mod_->dialogManager.get());
    EditorAPI::wireSpriteAnimator(mod_->spriteAnimator.get());
    mod_->entityGateway->setSpriteAnimator(mod_->spriteAnimator.get());
    EditorAPI::wireAudio(mod_->audio.get());
    EditorAPI::wireVariables(mod_->variableManager.get());
    EditorAPI::init("#artcade-canvas");

#ifdef ARTCADE_WASM
    EditorAPI::setSceneMutationBridge(
        [this](const SceneId& sceneId,
               const ArtCade::Modules::ScenePatch& patch) {
            return mod_->sceneMutation->apply(sceneId, patch);
        },
        [this](const ArtCade::Modules::SceneMutationResult& result) {
            handleSceneMutation(result);
        });
    EditorAPI::setSceneInvalidationQueueHandler(
        [this](const ArtCade::Modules::SceneInvalidation flags) {
            queueSceneInvalidations(flags);
        });
    EditorAPI::setAuthoringSyncBatchHandlers(
        [this]() { beginAuthoringSyncBatch(); },
        [this]() { endAuthoringSyncBatch(); });
    EditorAPI::setSceneMutationBatchOpenPredicate(
        [this]() {
            return mod_->sceneMutation && mod_->sceneMutation->batch_open();
        });
    EditorAPI::setProjectLoadedHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>& tilesets,
               const std::vector<GameVariableDefinition>& variables,
               const ProjectRuntimeSettings& settings) {
            applyEditorProjectLoaded(palette, tilesets, variables, settings);
        });
    EditorAPI::setPreviewRestoreHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>& tilesets,
               const std::vector<GameVariableDefinition>& variables,
               const ProjectRuntimeSettings& settings) {
            applyEditorPreviewRestore(palette, tilesets, variables, settings);
        });
    EditorAPI::setEnterPlayHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>& tilesets,
               const std::vector<GameVariableDefinition>& variables,
               const ProjectRuntimeSettings& settings) {
            applyEditorEnterPlay(palette, tilesets, variables, settings);
        });
    EditorAPI::setExitPlayHandler(
        [this](const std::vector<TilePaletteEntry>& palette,
               const std::vector<TilesetAsset>& tilesets,
               const std::vector<GameVariableDefinition>& variables,
               const ProjectRuntimeSettings& settings,
               const std::string& luaSource) {
            applyEditorExitPlay(palette, tilesets, variables, settings, luaSource);
        });
#endif

    return true;
}

void Application::shutdownModules() {
    if (!mod_) return;

    if (mod_->luaHost) { mod_->luaHost->shutdown(); mod_->luaHost.reset(); }
    if (mod_->gameAPI) { mod_->gameAPI->shutdown(); mod_->gameAPI.reset(); }
    if (mod_->dialogManager) { mod_->dialogManager->shutdown(); mod_->dialogManager.reset(); }
    if (mod_->world) { mod_->world->shutdown(); mod_->world.reset(); }
    if (mod_->entityGateway) {
        mod_->entityGateway->set_scene_lifecycle_service(nullptr);
        mod_->entityGateway->shutdown();
        mod_->entityGateway.reset();
    }
    if (mod_->sceneLifecycle) {
        mod_->sceneLifecycle->cancel_transition();
        mod_->sceneLifecycle.reset();
    }
    if (mod_->sceneMutation) mod_->sceneMutation.reset();
    if (mod_->sceneManager) { mod_->sceneManager->shutdown(); mod_->sceneManager.reset(); }
    if (mod_->assetLoader) { mod_->assetLoader->shutdown(); mod_->assetLoader.reset(); }
    if (mod_->audio) { mod_->audio->shutdown(); mod_->audio.reset(); }
    if (mod_->input) { mod_->input->shutdown(); mod_->input.reset(); }
    if (mod_->physics) { mod_->physics->shutdown(); mod_->physics.reset(); }
    if (mod_->textureManager) { mod_->textureManager->shutdown(); mod_->textureManager.reset(); }
    if (mod_->renderer) { mod_->renderer->shutdown(); mod_->renderer.reset(); }
    if (mod_->gameStateManager) {
        mod_->gameStateManager->shutdown();
        mod_->gameStateManager.reset();
    }
    if (mod_->saveLoadManager) { mod_->saveLoadManager->shutdown(); mod_->saveLoadManager.reset(); }
    if (mod_->cameraManager) { mod_->cameraManager->shutdown(); mod_->cameraManager.reset(); }
    if (mod_->layerManager) { mod_->layerManager->shutdown(); mod_->layerManager.reset(); }
    if (mod_->spriteAnimator) { mod_->spriteAnimator->shutdown(); mod_->spriteAnimator.reset(); }
    if (mod_->tweenManager) { mod_->tweenManager->shutdown(); mod_->tweenManager.reset(); }
    if (mod_->variableManager) { mod_->variableManager->shutdown(); mod_->variableManager.reset(); }
    if (mod_->timeManager) { mod_->timeManager->shutdown(); mod_->timeManager.reset(); }
    if (mod_->eventBus) { mod_->eventBus->shutdown(); mod_->eventBus.reset(); }
}

} // namespace ArtCade

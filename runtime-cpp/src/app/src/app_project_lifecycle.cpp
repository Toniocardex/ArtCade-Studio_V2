#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"
#include "../../modules/sprite-animator/include/animation-clips-registry.h"

#include <cmath>
#include <cstring>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

namespace ArtCade {

void Application::applyRuntimeSettings(const ProjectRuntimeSettings& settings,
                                       ViewportPolicy policy) {
    const float fps = settings.targetFPS;
    const float safeFps = (std::isfinite(fps) && fps >= 1.f) ? fps : 60.f;
    targetDt_ = 1.f / safeFps;
    physicsMode_ = settings.physicsMode;

    if (mod_ && mod_->physics) {
        const float gravity = std::isfinite(settings.gravity) ? settings.gravity : 9.81f;
        mod_->physics->setGravity({0.f, gravity});
    }
    if (mod_ && mod_->timeManager) {
        const float timeScale =
            std::isfinite(settings.timeScale) && settings.timeScale > 0.f
            ? settings.timeScale
            : 1.f;
        mod_->timeManager->setTimeScale(timeScale, "gameplay");
    }
#ifdef ARTCADE_WASM
    EditorAPI::s_physicsDebugDraw = settings.physicsDebugDraw;
#endif

    if (!mod_ || !mod_->renderer || !mod_->sceneManager) return;
    const SceneDef* scene = mod_->sceneManager->activeScene();
    if (!scene) return;

    if (policy == ViewportPolicy::EditorPreview) {
        if (scene->worldSize.x > 0.f && scene->worldSize.y > 0.f) {
            mod_->renderer->setWindowSize(
                static_cast<uint32_t>(scene->worldSize.x),
                static_cast<uint32_t>(scene->worldSize.y),
                "ArtCade V2");
        }
        mod_->renderer->setSceneViewport(scene->worldSize, scene->worldSize);
        return;
    }

    if (scene->viewportSize.x > 0.f && scene->viewportSize.y > 0.f) {
        mod_->renderer->setWindowSize(
            static_cast<uint32_t>(scene->viewportSize.x),
            static_cast<uint32_t>(scene->viewportSize.y),
            "ArtCade V2");
    }
    mod_->renderer->setSceneViewport(scene->worldSize, scene->viewportSize);
    // Snap the gameplay camera to the scene's authored initial view. Game logic
    // or a follow target may move it afterwards; this is just the starting frame.
    mod_->renderer->setCameraPosition(scene->cameraStart);
}

#ifdef ARTCADE_WASM
void Application::applyEditorProjectCommon(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>& tilesets,
    bool evictAssets) {
    tileColors_.clear();
    for (const auto& tile : tilePalette) tileColors_[tile.id] = tile.color;

    tilesets_.clear();
    for (const auto& tileset : tilesets) tilesets_[tileset.assetId] = tileset;
    mod_->sceneManager->setTilesets(tilesets);

    // Edit↔play transitions reuse the already-uploaded textures: evicting here
    // would blank the sprite for the first frame(s) of play until the editor's
    // async re-upload lands (the "first play shows the placeholder square" bug).
    // Only drop the caches when the project content may actually have changed.
    if (!evictAssets) return;
    if (mod_->textureManager) mod_->textureManager->unloadAll();
    if (mod_->renderer) mod_->renderer->evictCachedAssets();
}

void Application::resetGameplayRuntimeModules() {
    if (mod_->tweenManager) mod_->tweenManager->cancelAll();
    if (mod_->spriteAnimator) mod_->spriteAnimator->clearInstances();
    if (mod_->audio) {
        mod_->audio->stopAll();
        mod_->audio->evictSoundCache();
    }

    if (mod_->eventBus) { mod_->eventBus->shutdown(); mod_->eventBus->init(); }
    if (mod_->layerManager) { mod_->layerManager->shutdown(); mod_->layerManager->init(); }
    if (mod_->saveLoadManager) {
        mod_->saveLoadManager->shutdown();
        mod_->saveLoadManager->init();
    }
    if (mod_->timeManager) { mod_->timeManager->shutdown(); mod_->timeManager->init(); }
    if (mod_->gameStateManager) {
        mod_->gameStateManager->shutdown();
        mod_->gameStateManager->init();
    }
    if (mod_->cameraManager) mod_->cameraManager->init();

    accumulator_ = 0.f;
}

void Application::applyEditorProjectLoaded(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>& tilesets,
    const std::vector<GameVariableDefinition>& variables,
    const ProjectRuntimeSettings& settings) {
    applyEditorProjectCommon(tilePalette, tilesets);
    applyRuntimeSettings(settings, ViewportPolicy::EditorPreview);

    if (mod_->dialogManager && mod_->assetLoader) {
        mod_->dialogManager->loadDialogsFromDirectory(mod_->assetLoader->projectRoot());
    }
    resetGameplayRuntimeModules();
    if (mod_->variableManager) mod_->variableManager->configureGlobals(variables);
    if (mod_->world) mod_->world->syncAfterEditorProject(tilePalette);
}

void Application::applyEditorPreviewRestore(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>& tilesets,
    const std::vector<GameVariableDefinition>& variables,
    const ProjectRuntimeSettings& settings) {
    applyEditorProjectCommon(tilePalette, tilesets);
    applyRuntimeSettings(settings, ViewportPolicy::EditorPreview);
    resetGameplayRuntimeModules();
    if (mod_->variableManager) mod_->variableManager->configureGlobals(variables);
    if (mod_->world) mod_->world->restoreDesignState(tilePalette);
}

void Application::applyEditorEnterPlay(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>& tilesets,
    const std::vector<GameVariableDefinition>& variables,
    const ProjectRuntimeSettings& settings) {
    applyEditorProjectCommon(tilePalette, tilesets, /*evictAssets=*/false);
    applyRuntimeSettings(settings, ViewportPolicy::NativePlay);
    resetGameplayRuntimeModules();
    if (mod_->variableManager) mod_->variableManager->configureGlobals(variables);
    if (mod_->world) mod_->world->syncAfterEditorProject(tilePalette);
    // The reset above wiped the animator instances that replaceProject created
    // for playClipOnSpawn entities — re-arm them now that modules are fresh.
    if (mod_->entityGateway) mod_->entityGateway->replayActiveSpawnClips();
}

void Application::applyEditorExitPlay(
    const std::vector<TilePaletteEntry>& tilePalette,
    const std::vector<TilesetAsset>& tilesets,
    const std::vector<GameVariableDefinition>& variables,
    const ProjectRuntimeSettings& settings,
    const std::string& luaSource) {
    applyEditorProjectCommon(tilePalette, tilesets, /*evictAssets=*/false);
    applyRuntimeSettings(settings, ViewportPolicy::EditorPreview);
    if (mod_->luaHost && !luaSource.empty()) mod_->luaHost->loadLuaSource(luaSource);
    resetGameplayRuntimeModules();
    if (mod_->variableManager) mod_->variableManager->configureGlobals(variables);
    if (mod_->world) mod_->world->restoreDesignState(tilePalette);
}
#endif

bool Application::loadProject(const std::string& projectPath) {
    const auto endsWith = [](const std::string& value, const char* suffix) {
        const std::size_t suffixLength = std::strlen(suffix);
        return value.size() >= suffixLength
            && value.compare(value.size() - suffixLength, suffixLength, suffix) == 0;
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
    if (mod_->spriteAnimator) {
        registerAnimationClipsFromAssets(*mod_->spriteAnimator, doc.imageAssets);
    }
    applyRuntimeSettings(runtimeSettingsFromProjectDoc(doc), ViewportPolicy::NativePlay);

    tileColors_.clear();
    for (const auto& tile : doc.tilePalette) tileColors_[tile.id] = tile.color;

    tilesets_.clear();
    for (const auto& tileset : doc.tilesets) tilesets_[tileset.assetId] = tileset;
    mod_->sceneManager->setTilesets(doc.tilesets);
    mod_->sceneManager->setSceneLayers(doc.layers);

    if (!doc.mainScriptPath.empty()) {
        std::vector<uint8_t> bytecode;
        const bool haveBytecode =
            mod_->assetLoader->loadLuaBytecode(doc.mainScriptPath, bytecode)
            && !bytecode.empty();
        if (!haveBytecode
            || !mod_->luaHost->loadBytecodeBuffer(bytecode.data(), bytecode.size())) {
            std::cerr << "[App] Missing or invalid main script bytecode: "
                      << doc.mainScriptPath;
            const std::string& error = mod_->luaHost->lastError();
            if (!error.empty()) std::cerr << " (" << error << ")";
            std::cerr << "\n";
            return false;
        }
    }

    licenseTier_ = doc.licenseTier;
    if (licenseTier_ == "free") {
        splash_ = std::make_unique<ArtCade::Modules::SplashState>("free");
    }
    if (mod_->dialogManager) {
        mod_->dialogManager->loadDialogsFromDirectory(mod_->assetLoader->projectRoot());
    }

    std::cout << "[App] Project loaded: " << doc.projectName
              << " (license=" << licenseTier_ << ")\n";
    return true;
}

} // namespace ArtCade

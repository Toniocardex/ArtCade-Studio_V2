#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/presentation/include/presentation_types.h"
#include "../../modules/presentation/include/editor_viewport_service.h"
#include "render_pass_id.h"
#include "render_pipeline.h"
#include "view_render_features.h"
#include "../../modules/game-state/include/splash-state.h"

#include "passes/debug_pass.h"
#include "passes/grid_pass.h"
#include "passes/gizmo_pass.h"
#include "passes/scene_background_pass.h"
#include "passes/scene_entities_pass.h"
#include "scene_frame_context.h"

#include <vector>

namespace ArtCade {

namespace RenderPipeline = ArtCade::Modules;

namespace {
RenderPipeline::ViewRenderFeatures build_view_features(
    const EditorOverlayState& overlay) {
    RenderPipeline::ViewRenderFeatures features{};
    features.drawGrid = overlay.inEditMode && overlay.guidesEnabled;
    features.drawGizmos = overlay.inEditMode;
    features.drawSelection = overlay.inEditMode && overlay.selectedId != 0u;
#ifdef ARTCADE_WASM
    features.drawPhysicsDebug =
        EditorAPI::s_physicsDebugDraw && !overlay.inEditMode;
#else
    features.drawPhysicsDebug = false;
#endif
    return features;
}

} // namespace

void Application::commitPresentationFrame() {
    if (!mod_->renderer || !mod_->editorViewport) return;
    mod_->editorViewport->sync_from_renderer(
        mod_->renderer->gatherPresentationInputs(),
        mod_->renderer->windowWidth(),
        mod_->renderer->windowHeight());
    mod_->editorViewport->begin_frame();
}

void Application::renderActiveScene() {
    const SceneDef* activeScene = mod_->sceneManager->activeScene();
    const Vec4 clearColor = {0.015f, 0.018f, 0.025f, 1.f};

    mod_->renderer->setGameCameraModifiers({
        static_cast<double>(mod_->cameraManager->shakeOffset().x),
        static_cast<double>(mod_->cameraManager->shakeOffset().y),
        1.,
        static_cast<double>(mod_->cameraManager->shakeRotationOffset()),
    });

#ifdef ARTCADE_WASM
    const EditorOverlayState overlay{
        EditorAPI::s_mode == 0,
        EditorAPI::s_editorGuidesEnabled,
        EditorAPI::s_editorGridSize,
        EditorAPI::s_selectedEntityId,
    };
    std::vector<EntityId> selectedEntityIds = EditorAPI::s_selectedEntityIds;
    if (selectedEntityIds.empty() && EditorAPI::s_selectedEntityId != 0u)
        selectedEntityIds.push_back(EditorAPI::s_selectedEntityId);
#else
    const EditorOverlayState overlay{false, false, 0.f, 0u};
    std::vector<EntityId> selectedEntityIds;
#endif

    SceneFrameContext frameCtx{};
    frameCtx.renderer = mod_->renderer.get();
    frameCtx.spriteAnimator = mod_->spriteAnimator.get();
    frameCtx.entityGateway = mod_->entityGateway.get();
    frameCtx.variableManager = mod_->variableManager.get();
    frameCtx.sceneManager = mod_->sceneManager.get();
    frameCtx.timeManager = mod_->timeManager.get();
    frameCtx.activeScene = activeScene;
    frameCtx.overlay = overlay;
    frameCtx.selectedEntityIds = &selectedEntityIds;
    frameCtx.tilesets = &tilesets_;
    frameCtx.tileColors = &tileColors_;
    frameCtx.sceneFadeAlpha = mod_->entityGateway
        ? mod_->entityGateway->sceneFadeAlpha()
        : 0.f;

    commitPresentationFrame();
    const auto& presentation = mod_->editorViewport->committed_snapshot();
    mod_->renderer->beginFrame(presentation, clearColor);
    const RenderPipeline::ViewRenderFeatures features = build_view_features(overlay);
    const std::vector<RenderPipeline::RenderPassId> passOrder =
        RenderPipeline::RenderPipelineBuilder::buildPipeline(
            presentation, features, activeScene != nullptr).appPassOrder;

    bool worldPassEnded = false;
    bool dialogRendered = false;
    for (const RenderPipeline::RenderPassId passId : passOrder) {
        switch (passId) {
        case RenderPipeline::RenderPassId::GameView:
            mod_->renderer->beginGameViewPass(clearColor);
            break;
        case RenderPipeline::RenderPassId::SceneBackdrop:
            AppRenderPasses::execute_scene_background_pass(frameCtx);
            break;
        case RenderPipeline::RenderPassId::Grid:
            AppRenderPasses::execute_grid_pass(frameCtx);
            break;
        case RenderPipeline::RenderPassId::SceneEntities:
            AppRenderPasses::execute_scene_entities_pass(frameCtx);
            break;
        case RenderPipeline::RenderPassId::Gizmo:
            AppRenderPasses::execute_gizmo_pass(frameCtx);
            break;
        case RenderPipeline::RenderPassId::Debug:
            if (mod_->world)
                AppRenderPasses::execute_debug_pass(*mod_->renderer, *mod_->world);
            break;
        case RenderPipeline::RenderPassId::Blit:
            if (mod_->dialogManager && mod_->dialogManager->isActive()) {
                mod_->dialogManager->render();
                dialogRendered = true;
            }
            mod_->renderer->endWorldPass();
            mod_->renderer->blitGameViewToBackbuffer();
            worldPassEnded = true;
            break;
        }
    }

    if (!dialogRendered && mod_->dialogManager && mod_->dialogManager->isActive())
        mod_->dialogManager->render();

    if (!worldPassEnded)
        mod_->renderer->endWorldPass();
    mod_->renderer->endScreenPass();
    if (splash_) {
        splash_->render(
            static_cast<int>(mod_->renderer->windowWidth()),
            static_cast<int>(mod_->renderer->windowHeight()));
    }
    mod_->renderer->presentScreen();
    mod_->renderer->setGameCameraModifiers({});
}

} // namespace ArtCade

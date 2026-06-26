#include "scene_background_pass.h"

#include "../editor-overlay-renderer.h"
#include "../parallax-renderer.h"
#include "../tilemap-renderer.h"

#include "../../../modules/renderer/include/renderer.h"
#include "../../../modules/scene-system/include/scene-manager.h"
#include "../../../modules/time/include/time-manager.h"

namespace ArtCade::AppRenderPasses {

void execute_scene_background_pass(SceneFrameContext& ctx) {
    if (!ctx.activeScene || !ctx.sceneManager || !ctx.renderer)
        return;

    EditorOverlayRenderer::drawBackdrop(
        *ctx.renderer, *ctx.activeScene, ctx.overlay);
    ctx.renderer->drawRectImmediate(
        0.f, 0.f,
        std::max(1.f, ctx.activeScene->worldSize.x),
        std::max(1.f, ctx.activeScene->worldSize.y),
        ctx.activeScene->backgroundColor);
    ParallaxRenderer::draw(
        *ctx.renderer,
        ctx.sceneManager->sceneLayers(),
        ctx.activeScene->layerSettings,
        ctx.renderer->getCameraPosition(),
        ctx.renderer->visibleWorldSize(),
        ctx.timeManager ? ctx.timeManager->now() : 0.f);
    if (ctx.tilesets && ctx.tileColors) {
        TilemapRenderer::draw(
            *ctx.renderer,
            *ctx.activeScene,
            ctx.sceneManager->sceneLayers(),
            ctx.sceneManager->tilesets(),
            *ctx.tilesets,
            *ctx.tileColors);
    }
}

} // namespace ArtCade::AppRenderPasses

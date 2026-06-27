#include "scene_background_pass.h"

#include "../scene_frame_snapshot.h"

#include "../editor-overlay-renderer.h"
#include "../parallax-renderer.h"
#include "../tilemap-renderer.h"

#include "../../../modules/renderer/include/renderer.h"
#include "../../../modules/scene-system/include/scene-manager.h"
#include "../../../modules/time/include/time-manager.h"

namespace ArtCade::AppRenderPasses {

void execute_scene_background_pass(SceneFrameContext& ctx) {
    if (!ctx.frameSnapshot || !ctx.sceneManager || !ctx.renderer)
        return;

    const SceneFrameSnapshot& frame = *ctx.frameSnapshot;

    EditorOverlayRenderer::drawBackdrop(
        *ctx.renderer, frame.backgroundColor, frame.overlay);
    ctx.renderer->drawRectImmediate(
        0.f, 0.f,
        std::max(1.f, frame.worldSize.x),
        std::max(1.f, frame.worldSize.y),
        frame.backgroundColor);
    ParallaxRenderer::draw(
        *ctx.renderer,
        ctx.sceneManager->sceneLayers(),
        frame.layerSettings,
        ctx.renderer->getCameraPosition(),
        ctx.renderer->visibleWorldSize(),
        ctx.timeManager ? ctx.timeManager->now() : 0.f);
    if (ctx.tilesets && ctx.tileColors) {
        TilemapRenderer::draw(
            *ctx.renderer,
            frame.tilemap,
            frame.tilemapLayers,
            frame.layerSettings,
            ctx.sceneManager->sceneLayers(),
            ctx.sceneManager->tilesets(),
            *ctx.tilesets,
            *ctx.tileColors);
    }
}

} // namespace ArtCade::AppRenderPasses

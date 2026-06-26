#include "grid_pass.h"

#include "../editor-overlay-renderer.h"

namespace ArtCade::AppRenderPasses {

void execute_grid_pass(const SceneFrameContext& ctx) {
    if (!ctx.activeScene || !ctx.renderer)
        return;
    EditorOverlayRenderer::drawGrid(
        *ctx.renderer, *ctx.activeScene, ctx.overlay);
}

} // namespace ArtCade::AppRenderPasses

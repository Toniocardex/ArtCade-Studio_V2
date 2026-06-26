#include "../include/render_pipeline.h"

namespace ArtCade::Modules {

std::vector<RenderPassId> RenderPipelineBuilder::build_pass_order(
    const ArtCade::Presentation::PresentationSnapshot&,
    const ViewRenderFeatures& features,
    bool hasActiveScene) {
    std::vector<RenderPassId> order;
    if (!hasActiveScene)
        return order;

    order.push_back(RenderPassId::SceneBackdrop);
    if (features.drawGrid)
        order.push_back(RenderPassId::Grid);
    order.push_back(RenderPassId::SceneEntities);
    if (features.drawGizmos || features.drawSelection)
        order.push_back(RenderPassId::Gizmo);
    if (features.drawPhysicsDebug)
        order.push_back(RenderPassId::Debug);
    return order;
}

} // namespace ArtCade::Modules

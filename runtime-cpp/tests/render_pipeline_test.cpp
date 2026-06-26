#include "../src/modules/presentation/include/presentation_snapshot.h"
#include "../src/modules/renderer/include/render_pipeline.h"
#include "../src/modules/renderer/include/view_render_features.h"

#include <cassert>
#include <vector>

using ArtCade::Modules::RenderPassId;
using ArtCade::Modules::RenderPipelineBuilder;
using ArtCade::Modules::ViewRenderFeatures;
using ArtCade::Presentation::PresentationSnapshot;

static bool contains(const std::vector<RenderPassId>& order, RenderPassId id) {
    for (RenderPassId entry : order) {
        if (entry == id)
            return true;
    }
    return false;
}

int main() {
    PresentationSnapshot snapshot{};
    ViewRenderFeatures allOn{};
    allOn.drawGrid = true;
    allOn.drawGizmos = true;
    allOn.drawSelection = true;
    allOn.drawPhysicsDebug = true;

    const auto order = RenderPipelineBuilder::build_pass_order(snapshot, allOn, true);
    assert(contains(order, RenderPassId::SceneBackdrop));
    assert(contains(order, RenderPassId::Grid));
    assert(contains(order, RenderPassId::SceneEntities));
    assert(contains(order, RenderPassId::Gizmo));
    assert(contains(order, RenderPassId::Debug));

    ViewRenderFeatures minimal{};
    const auto sparse = RenderPipelineBuilder::build_pass_order(snapshot, minimal, true);
    assert(contains(sparse, RenderPassId::SceneBackdrop));
    assert(contains(sparse, RenderPassId::SceneEntities));
    assert(!contains(sparse, RenderPassId::Grid));
    assert(!contains(sparse, RenderPassId::Debug));

    const auto empty = RenderPipelineBuilder::build_pass_order(snapshot, allOn, false);
    assert(empty.empty());
    return 0;
}

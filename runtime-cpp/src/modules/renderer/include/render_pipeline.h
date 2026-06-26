#pragma once

#include "render_pass_id.h"
#include "view_render_features.h"
#include "../../presentation/include/presentation_snapshot.h"

#include <vector>

namespace ArtCade::Modules {

/**
 * Builds the ordered pass list for a frame from presentation + features.
 * GameView RT capture and Blit run inside Renderer frame lifecycle.
 */
class RenderPipelineBuilder {
public:
    static std::vector<RenderPassId> build_pass_order(
        const ArtCade::Presentation::PresentationSnapshot& presentation,
        const ViewRenderFeatures& features,
        bool hasActiveScene);
};

} // namespace ArtCade::Modules

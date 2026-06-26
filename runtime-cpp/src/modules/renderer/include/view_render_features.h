#pragma once

namespace ArtCade::Modules {

/**
 * Optional overlay passes for a single frame (ADR Phase 7).
 * Scene + GameView capture are always scheduled when a scene is active.
 */
struct ViewRenderFeatures {
    bool drawGrid          = false;
    bool drawGizmos        = false;
    bool drawSelection     = false;
    bool drawPhysicsDebug  = false;
};

} // namespace ArtCade::Modules

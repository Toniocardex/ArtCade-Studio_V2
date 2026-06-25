#pragma once

#include "presentation_mode.h"
#include "presentation_types.h"

namespace ArtCade::Presentation {

/**
 * Immutable presentation result committed once per frame.
 * Does not contain render-pass instructions.
 */
struct PresentationSnapshot {
    uint64_t revision = 0;
    PresentationMode effectiveMode = PresentationMode::SceneEdit;
    SurfaceMetrics surface;
    double logicalWidth = 1.;
    double logicalHeight = 1.;
    OutputPlacement placement{};
    bool useIdentityPlacement = false;
    ViewCamera2D pickingCamera{};
    double presentationScale = 1.;
    bool letterboxActive = false;

    /**
     * Maps framebuffer coordinates to world using this snapshot's placement
     * and picking camera (committed for the frame).
     */
    WorldPoint surface_to_world(SurfacePoint surface) const;

    /** Inverse of surface_to_world. */
    SurfacePoint world_to_surface(WorldPoint world) const;
};

} // namespace ArtCade::Presentation

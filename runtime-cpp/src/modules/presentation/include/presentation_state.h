#pragma once

#include "presentation_mode.h"
#include "presentation_types.h"

namespace ArtCade::Presentation {

/** Mutable inputs to the presentation solver (not thread-safe). */
struct PresentationState {
    PresentationMode mode = PresentationMode::SceneEdit;
    OutputPolicy outputPolicy = OutputPolicy::Fit;
    SurfaceMetrics surface;
    double logicalWidth = 1.;
    double logicalHeight = 1.;
    bool gameViewCompositorEnabled = false;
    EditorCamera editorCamera{};
    GameCameraState gameCamera{};
    CameraModifiers gameModifiers{};
    OutputPlacement placement{};
    /** When true, picking maps surface 1:1 (editor direct framebuffer). */
    bool useIdentityPlacement = false;
    ViewCamera2D pickingCamera{};
};

} // namespace ArtCade::Presentation

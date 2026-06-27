#pragma once

#include "../src/modules/renderer/include/renderer.h"
#include "../src/modules/presentation/include/editor_viewport_service.h"

inline void commit_presentation_frame(
    ArtCade::Modules::Renderer& renderer,
    ArtCade::Presentation::EditorViewportService& viewport) {
    viewport.sync_from_renderer(
        renderer.gatherPresentationInputs(),
        renderer.windowWidth(),
        renderer.windowHeight());
    viewport.begin_frame();
    renderer.applyFramePresentation(viewport.committed_snapshot());
}

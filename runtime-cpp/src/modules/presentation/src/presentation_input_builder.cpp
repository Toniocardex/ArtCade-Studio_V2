#include "../include/presentation_input_builder.h"

#include <algorithm>

namespace ArtCade::Presentation {

PresentationStateInputs presentation_build_inputs(
    const SceneDef* scene,
    const PresentationSimulationInputs& sim) {
    PresentationStateInputs inputs{};
    inputs.outputPolicy = sim.outputPolicy;
    inputs.gameViewCompositorEnabled = sim.gameViewCompositorEnabled;
    inputs.gameCamera = sim.gameCamera;
    inputs.gameModifiers = sim.gameModifiers;

    if (scene) {
        inputs.logicalWidth = static_cast<double>(
            std::max(1.f, scene->viewportSize.x));
        inputs.logicalHeight = static_cast<double>(
            std::max(1.f, scene->viewportSize.y));
        inputs.worldWidth = static_cast<double>(
            std::max(1.f, scene->worldSize.x));
        inputs.worldHeight = static_cast<double>(
            std::max(1.f, scene->worldSize.y));
    } else {
        inputs.logicalWidth = sim.fallbackLogicalWidth > 0.
            ? sim.fallbackLogicalWidth
            : 1.;
        inputs.logicalHeight = sim.fallbackLogicalHeight > 0.
            ? sim.fallbackLogicalHeight
            : 1.;
        inputs.worldWidth = sim.fallbackWorldWidth > 0.
            ? sim.fallbackWorldWidth
            : 1.;
        inputs.worldHeight = sim.fallbackWorldHeight > 0.
            ? sim.fallbackWorldHeight
            : 1.;
    }
    return inputs;
}

} // namespace ArtCade::Presentation

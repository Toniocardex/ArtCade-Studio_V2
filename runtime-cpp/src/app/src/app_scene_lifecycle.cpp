#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/scene-system/include/scene-invalidation.h"

namespace ArtCade {

void Application::handleSceneTransition(
    const ArtCade::Modules::SceneTransitionResult& result)
{
    if (!result.changed || !mod_) return;
    pendingSceneInvalidations_ |= result.invalidations;
    if (ArtCade::Modules::scene_invalidation_has(
            result.invalidations,
            ArtCade::Modules::SceneInvalidation::SceneActivation)) {
        resetCameraOnNextFrame_ = true;
    }
}

} // namespace ArtCade

#include "../include/app.h"

#include "app_modules.h"

namespace ArtCade {

void Application::handleSceneTransition(
    const ArtCade::Modules::SceneTransitionResult& result)
{
    if (!result.changed || !mod_) return;
    pendingSceneInvalidations_ |= result.invalidations;
}

} // namespace ArtCade

#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/scene-system/include/scene-invalidation.h"

namespace ArtCade {

void Application::refreshPresentationPending() {
    if (!mod_ || !mod_->renderer || !mod_->editorViewport || !mod_->sceneManager)
        return;
    mod_->editorViewport->sync_from_scene(
        mod_->sceneManager->activeScene(),
        mod_->renderer->gatherSimulationPresentationInputs(),
        mod_->renderer->windowWidth(),
        mod_->renderer->windowHeight());
    mod_->editorViewport->refresh_pending_snapshot();
}

void Application::applyPendingSceneInvalidations() {
    if (!mod_) return;

    const ArtCade::Modules::SceneInvalidation flags = pendingSceneInvalidations_;
    pendingSceneInvalidations_ = ArtCade::Modules::SceneInvalidation::None;
    if (flags == ArtCade::Modules::SceneInvalidation::None) return;

    // Deterministic rebuild order (PR3). Scene activation sync runs in
    // SceneLifecycleService::commit_load; frame boundary applies dependent rebuilds.
    if (ArtCade::Modules::scene_invalidation_has(
            flags, ArtCade::Modules::SceneInvalidation::SceneActivation)) {
        // Entity activation already committed; collision/geometry follow below.
    }

    if (ArtCade::Modules::scene_invalidation_has(
            flags, ArtCade::Modules::SceneInvalidation::EntityProjection)) {
        // PR4+: entity projection caches refresh when introduced.
    }

    if (ArtCade::Modules::scene_invalidation_needs_collision_rebuild(flags)
        && mod_->world) {
        mod_->world->rebuildCollisionWorld();
    }

    const bool geometryDirty = ArtCade::Modules::scene_invalidation_has(
        flags, ArtCade::Modules::SceneInvalidation::Geometry);
    if (geometryDirty) {
        refreshPresentationPending();
    } else if (ArtCade::Modules::scene_invalidation_has(
                   flags, ArtCade::Modules::SceneInvalidation::Presentation)) {
        refreshPresentationPending();
    }

    if (ArtCade::Modules::scene_invalidation_has(
            flags, ArtCade::Modules::SceneInvalidation::Metadata)
        || ArtCade::Modules::scene_invalidation_has(
            flags, ArtCade::Modules::SceneInvalidation::RenderData)) {
        // SceneDef committed; render passes read SceneFrameSnapshot each frame.
    }
}

} // namespace ArtCade

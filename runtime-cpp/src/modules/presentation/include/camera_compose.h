#pragma once

#include "presentation_types.h"

namespace ArtCade::Presentation {

/**
 * Composes shake / trauma modifiers onto the authoritative game camera.
 */
EffectiveGameCamera compose_effective_game_camera(
    const GameCameraState& base,
    const CameraModifiers& modifiers);

/** Converts an effective game camera to view-space picking parameters. */
ViewCamera2D view_camera_from_effective(const EffectiveGameCamera& camera,
                                        double offsetX = 0.,
                                        double offsetY = 0.);

/** Converts an editor camera to view-space picking parameters. */
ViewCamera2D view_camera_from_editor(const EditorCamera& camera);

} // namespace ArtCade::Presentation

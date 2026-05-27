#pragma once
// =============================================================================
// RayTint — screen-space RGB picker for sprite placeholder fill (no texture).
// Drawn with Raylib after EndMode2D; input handled before scene pick/drag.
// =============================================================================

#include "../../core/types.h"

namespace ArtCade {
namespace Modules { class RuntimeEntityGateway; }

namespace RayTintWidget {

bool isActive();

/** Open picker for entity; returns false if entity missing or has a texture. */
bool open(Modules::RuntimeEntityGateway* gateway, EntityId entityId);

/** apply=true commits to React via EditorAPI; false restores snapshot. */
void close(bool apply);

/** Screen coords (framebuffer pixels). Returns true if event consumed. */
bool onMouseDown(float screenX, float screenY);
bool onMouseMove(float screenX, float screenY);
bool onMouseUp(float screenX, float screenY);

/** Draw panel in screen space (call after EndMode2D). */
void draw();

} // namespace RayTintWidget
} // namespace ArtCade

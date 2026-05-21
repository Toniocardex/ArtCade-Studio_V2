#pragma once
// =============================================================================
// editor-overlay-renderer  —  editor-only viewport chrome
// =============================================================================
//
// Extracted from app.cpp::renderActiveScene() during the post-phase-6 split.
// Owns every pixel the *editor* draws on top of the game scene:
//
//   • drawBackdrop      — viewport-coloured rect behind the world (so the
//                         camera shows the scene colour, not raylib's clear
//                         clearColor, when the world is smaller than the
//                         viewport).
//   • drawGuides        — world bounds + viewport bounds + editor grid.
//   • drawSelection     — selection box + sensor preview for the picked
//                         entity.
//
// House rule: the renderer never reads `EditorAPI::s_*` statics. It receives
// an `EditorOverlayState` explicitly. This mirrors what RuntimeSyncService
// does on the TypeScript side and keeps Application as the single owner of
// editor↔runtime state mapping.
// =============================================================================

#include "../../core/types.h"

namespace ArtCade {

struct EntityDef;
namespace Modules { class Renderer; }

struct EditorOverlayState {
    bool     inEditMode    = false; // false → all overlay calls are no-ops
    bool     guidesEnabled = false; // ignored when inEditMode is false
    float    gridSize      = 32.f;
    EntityId selectedId    = 0u;    // 0 → no selection gizmo
};

namespace EditorOverlayRenderer {

/** Solid scene background filling the visible viewport. Edit-mode only. */
void drawBackdrop(Modules::Renderer& renderer,
                  const SceneDef& scene,
                  const EditorOverlayState& state);

/**
 * World bounds (cyan) + camera viewport (amber) + grid (cyan, low alpha).
 * Skipped entirely when overlay is off or guides are disabled.
 */
void drawGuides(Modules::Renderer& renderer,
                const SceneDef& scene,
                const EditorOverlayState& state);

/**
 * Selection box + optional sensor preview for the currently picked entity.
 * The selection box uses the collider size when available; otherwise it
 * falls back to a 40px square scaled by transform.scale.
 *
 * `selected` may be null even if `state.selectedId != 0` (entity was
 * destroyed between pick and render); in that case the call is a no-op.
 */
void drawSelection(Modules::Renderer& renderer,
                   const EntityDef* selected,
                   const Transform& transform,
                   const PhysicsComponent& physics,
                   const EditorOverlayState& state);

} // namespace EditorOverlayRenderer
} // namespace ArtCade

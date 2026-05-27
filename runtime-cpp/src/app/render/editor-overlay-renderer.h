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
//   • drawGrid          — editor alignment grid (under entities).
//   • drawGuides        — camera viewport bounds outline (over entities).
//   • drawSelection     — selection box + sensor preview for the picked
//                         entity.
//
// House rule: the renderer never reads `EditorAPI::s_*` statics. It receives
// an `EditorOverlayState` explicitly. This mirrors what RuntimeSyncService
// does on the TypeScript side and keeps Application as the single owner of
// editor↔runtime state mapping.
// =============================================================================

#include "../../core/types.h"

#include <optional>

namespace ArtCade {

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
 * Alignment grid (ivory, low alpha). Drawn under entity sprites so solid
 * placeholder fills are not crossed by guide lines.
 */
void drawGrid(Modules::Renderer& renderer,
              const SceneDef& scene,
              const EditorOverlayState& state);

/**
 * Camera viewport bounds outline (sage green). Skipped when overlay is off
 * or guides are disabled.
 */
void drawGuides(Modules::Renderer& renderer,
                const SceneDef& scene,
                const EditorOverlayState& state);

/**
 * Selection box + optional sensor preview for the currently picked entity.
 * Uses amber when `hiddenInGame` (visible in editor, hidden in play).
 */
void drawSelection(Modules::Renderer& renderer,
                   const Transform& transform,
                   const PhysicsComponent& physics,
                   const std::optional<SensorComponent>& sensor,
                   const EditorOverlayState& state,
                   bool hiddenInGame = false);

/**
 * Amber outline for hidden-in-game entities that are not selected (edit-mode).
 */
void drawHiddenInGameOutline(Modules::Renderer& renderer,
                             const Transform& transform,
                             const PhysicsComponent& physics);

} // namespace EditorOverlayRenderer
} // namespace ArtCade

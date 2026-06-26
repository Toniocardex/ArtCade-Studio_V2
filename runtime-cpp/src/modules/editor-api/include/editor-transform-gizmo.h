#pragma once
// =============================================================================
// editor-transform-gizmo — selection outline corners + resize math (edit mode)
// =============================================================================

#include "../../../core/types.h"

#include <optional>

namespace ArtCade {

namespace Modules { class Renderer; }

enum class ResizeHandle {
    None,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
};

enum class ManipulationMode {
    None,
    Move,
    Resize,
};

/** Axis-aligned sprite visual bounds (pivot-anchored, matches selection outline). */
struct EntityVisualBounds {
    float x = 0.f;
    float y = 0.f;
    float w = 0.f;
    float h = 0.f;
};

namespace EditorTransformGizmo {

/**
 * Visual bounds for the selection box. When @p visualSize is set it matches
 * the resolved animation frame; otherwise uses renderer destination size.
 */
EntityVisualBounds entity_visual_bounds(
    Modules::Renderer& renderer,
    const Transform& transform,
    const SpriteComponent& sprite,
    const std::optional<Vec2>& visualSize = std::nullopt);

/** Convert a constant screen-pixel handle size to world units at editor zoom. */
float resize_handle_world_size(Modules::Renderer& renderer, float screenPx = 8.f);

void draw_resize_handles(
    Modules::Renderer& renderer,
    const EntityVisualBounds& bounds,
    float handleSizeWorld);

/**
 * Hit-test corner handles on the selection bounds.
 * @returns the top-most handle when overlaps exist (corners checked in Z-order).
 */
ResizeHandle hit_test_resize_handle(
    float worldX,
    float worldY,
    const EntityVisualBounds& bounds,
    float handleSizeWorld);

/**
 * Compute new scale from a corner drag. Opposite corner stays fixed in world
 * space; position is unchanged (resize around pivot — v1).
 */
Vec2 calculate_scale_from_handle(
    ResizeHandle handle,
    float worldX,
    float worldY,
    const Transform& dragStartTransform,
    const EntityVisualBounds& dragStartBounds);

} // namespace EditorTransformGizmo
} // namespace ArtCade

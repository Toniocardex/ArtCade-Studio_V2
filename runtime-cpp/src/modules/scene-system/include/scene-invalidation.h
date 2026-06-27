#pragma once

#include <cstdint>

namespace ArtCade::Modules {

/** Declarative invalidation flags produced by scene mutations and lifecycle. */
enum class SceneInvalidation : uint32_t {
    None             = 0,
    Metadata         = 1u << 0,
    Geometry         = 1u << 1,
    Presentation     = 1u << 2,
    EntityProjection = 1u << 3,
    TilemapGeometry  = 1u << 4,
    TilemapData      = 1u << 5,
    Collision        = 1u << 6,
    RenderData       = 1u << 7,
    SceneActivation  = 1u << 8,
};

constexpr SceneInvalidation operator|(
    SceneInvalidation a, SceneInvalidation b) noexcept {
    return static_cast<SceneInvalidation>(
        static_cast<uint32_t>(a) | static_cast<uint32_t>(b));
}

constexpr SceneInvalidation operator&(
    SceneInvalidation a, SceneInvalidation b) noexcept {
    return static_cast<SceneInvalidation>(
        static_cast<uint32_t>(a) & static_cast<uint32_t>(b));
}

constexpr SceneInvalidation& operator|=(
    SceneInvalidation& a, SceneInvalidation b) noexcept {
    a = a | b;
    return a;
}

/** @return true when @p flags contains every bit set in @p bit. */
constexpr bool scene_invalidation_has(
    SceneInvalidation flags, SceneInvalidation bit) noexcept {
    return (flags & bit) != SceneInvalidation::None;
}

/** Flags that require a collision-world rebuild (single pass per frame). */
constexpr SceneInvalidation scene_invalidation_collision_mask() noexcept {
    return SceneInvalidation::Collision
        | SceneInvalidation::TilemapGeometry
        | SceneInvalidation::TilemapData;
}

constexpr bool scene_invalidation_needs_collision_rebuild(
    SceneInvalidation flags) noexcept {
    return scene_invalidation_has(flags, SceneInvalidation::Collision)
        || scene_invalidation_has(flags, SceneInvalidation::TilemapGeometry)
        || scene_invalidation_has(flags, SceneInvalidation::TilemapData);
}

} // namespace ArtCade::Modules

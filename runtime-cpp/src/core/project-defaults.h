#pragma once

namespace ArtCade::ProjectDefaults {

/**
 * Default scene world / viewport sizes for JSON fallbacks and struct init.
 * Keep in sync with editor/src/constants/editor-viewport.ts
 * (DEFAULT_SCENE_SIZE, DEFAULT_VIEWPORT_SIZE).
 */
inline constexpr float kSceneWorldWidth       = 1280.f;
inline constexpr float kSceneWorldHeight      = 640.f;
inline constexpr float kSceneViewportWidth    = 512.f;
inline constexpr float kSceneViewportHeight   = 320.f;

} // namespace ArtCade::ProjectDefaults

#pragma once

#include <cstdint>

namespace ArtCade::Modules {

/** Explicit render passes (ADR Phase 7). */
enum class RenderPassId : uint8_t {
  SceneBackdrop = 0,
  Grid,
  SceneEntities,
  Gizmo,
  Debug,
  /** GameView RT capture — executed inside Renderer::beginFrame. */
  GameView,
  /** GameView RT → backbuffer — executed inside Renderer::endWorldPass. */
  Blit,
};

} // namespace ArtCade::Modules

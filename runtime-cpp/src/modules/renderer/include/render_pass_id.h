#pragma once

#include <cstdint>

namespace ArtCade::Modules {

/** Explicit render passes executed per frame (ADR Phase 7). */
enum class RenderPassId : uint8_t {
  SceneBackdrop = 0,
  Grid,
  SceneEntities,
  Gizmo,
  Debug,
};

} // namespace ArtCade::Modules

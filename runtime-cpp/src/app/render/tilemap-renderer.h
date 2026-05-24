#pragma once
// =============================================================================
// tilemap-renderer  —  scene tilemap rendering (atlas + palette fallback)
// =============================================================================
//
// Extracted from app.cpp::renderActiveScene() during the post-phase-6 split.
// Walks `SceneDef::tilemap` and emits draw calls in this order of preference:
//
//   1. If the layer references a tileset and the tileset is found in the
//      live SceneManager list (or the startup fallback cache), draw the
//      tile as a spritesheet region via Renderer::drawSpriteRegion.
//   2. Otherwise, draw a solid rect using the per-id colour from the
//      project's tile palette.
//   3. Otherwise, a neutral grey rect (so missing/invalid tile ids are
//      still visible in the editor instead of silently disappearing).
//
// Ownership: the renderer owns no caches. `Application` keeps the
// `tileColors_` / `tilesets_` maps that `loadProject()` populates and
// passes them by reference each frame. This keeps the renderer
// stateless and trivially relocatable.
// =============================================================================

#include "../../core/types.h"

#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade {

namespace Modules { class Renderer; }

namespace TilemapRenderer {

/**
 * Draw the tilemap layer of `scene` into the active renderer frame.
 *
 * No-op when the layer has no cells. Skips id == 0 cells (empty).
 *
 * @param liveTilesets  Authoritative list from SceneManager (refreshed on
 *                      editor hot-reload).
 * @param startupCache  Fallback map populated at loadProject() time; used
 *                      only if `liveTilesets` does not contain the id.
 * @param palette       Map from tile id to the fallback solid colour.
 */
void draw(Modules::Renderer& renderer,
          const SceneDef& scene,
          const std::vector<TilesetAsset>& liveTilesets,
          const std::unordered_map<std::string, TilesetAsset>& startupCache,
          const std::unordered_map<int, Vec4>& palette);

} // namespace TilemapRenderer
} // namespace ArtCade

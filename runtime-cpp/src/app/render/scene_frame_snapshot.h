#pragma once

#include "../../core/types.h"
#include "../../modules/presentation/include/presentation_snapshot.h"
#include "editor-overlay-renderer.h"

#include <unordered_map>

namespace ArtCade {

/**
 * Immutable per-frame scene + presentation truth for render passes and overlays.
 *
 * Contract (single-threaded, synchronous frame loop):
 *   mutation + entity flush → scene_frame_build() → render passes → end frame
 *
 * While render passes run, the active SceneDef (including tilemap storage)
 * must not be mutated by scene patch, project replace, tilemap resize, or
 * scene load. Scalars and layerSettings are copied at build time; tilemap
 * pointers alias SceneDef until the pass scope ends.
 * Entity transforms are read from the registry post-flush, not snapshotted.
 */
struct SceneFrameSnapshot {
    uint64_t frameNumber = 0;
    uint64_t sceneRevision = 0;
    uint64_t presentationRevision = 0;

    SceneId sceneId;

    Vec2 worldSize{};
    Vec2 logicalViewport{};
    Vec4 backgroundColor{};
    std::unordered_map<std::string, SceneLayerSettings> layerSettings;

    ArtCade::Presentation::PresentationSnapshot presentation;
    EditorOverlayState overlay;

    float sceneFadeAlpha = 0.f;

    /** Merged grid for physics / legacy single-layer projects (aliases SceneDef). */
    const TilemapData* tilemap = nullptr;
    /** Per-layer paint grids keyed by layer id (aliases SceneDef). */
    const std::unordered_map<std::string, TilemapData>* tilemapLayers = nullptr;
};

struct SceneFrameBuildInput {
    uint64_t frameNumber = 0;
    uint64_t sceneRevision = 0;
    const SceneDef* activeScene = nullptr;
    ArtCade::Presentation::PresentationSnapshot presentation;
    EditorOverlayState overlay{};
    float sceneFadeAlpha = 0.f;
};

/**
 * Captures authoritative frame geometry and presentation at the frame boundary.
 * @param input active scene and committed presentation (must not mutate after build)
 */
SceneFrameSnapshot scene_frame_build(const SceneFrameBuildInput& input);

} // namespace ArtCade

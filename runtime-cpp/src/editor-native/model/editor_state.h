#pragma once

#include "core/types.h"
#include "editor-native/model/selection_state.h"

#include <algorithm>
#include <string>
#include <unordered_map>

namespace ArtCade::EditorNative {

namespace SceneViewLimits {
constexpr float kZoomMin = 0.1f;
constexpr float kZoomMax = 8.0f;
} // namespace SceneViewLimits

/** Per-scene editor camera. Stored by SceneId, not the gameplay camera. */
struct EditorSceneViewState {
    Vec2  pan{};
    float zoom = 1.0f;
    // True once the one-time auto-fit has run for this scene. Lives here (not an
    // app-side registry) so it shares the single sceneViews lifecycle: cleared by
    // replaceProject, pruned with a deleted scene, reset for a fresh scene.
    bool  initialized = false;
};

enum class EditorTool {
    Select,
    Pan,
};

// Shared workspace state. This is not saved into the project file.
struct EditorState {
    // Workspace focus only. This is NOT the gameplay start scene.
    SceneId activeSceneId;
    SelectionState selection;
    EditorTool activeTool = EditorTool::Select;
    std::unordered_map<SceneId, EditorSceneViewState> sceneViews;

};

inline float clampZoom(float v) {
    return std::clamp(v, SceneViewLimits::kZoomMin, SceneViewLimits::kZoomMax);
}

} // namespace ArtCade::EditorNative

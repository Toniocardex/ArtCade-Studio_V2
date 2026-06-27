#pragma once

#include "core/types.h"

#include <string>

namespace ArtCade::EditorNative {

// =============================================================================
// EditorIntent — changes only the workspace/editor state, never the project,
// never the undo stack (prompt §4). Plain value structs; the coordinator has a
// typed apply() overload for each.
// =============================================================================

struct SelectEntityIntent {
    EntityId entityId = INVALID_ENTITY;
};

struct SelectSceneIntent {
    SceneId sceneId;
};

struct SetViewportZoomIntent {
    SceneId sceneId;
    float   zoom = 1.0f;
};

struct PanViewportIntent {
    SceneId sceneId;
    Vec2    delta;
};

struct SetHierarchyFilterIntent {
    std::string filter;
};

struct ResizePanelIntent {
    enum class Panel { Left, Right, Console };
    Panel panel = Panel::Left;
    float size  = 0.0f;
};

} // namespace ArtCade::EditorNative

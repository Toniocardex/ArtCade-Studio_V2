#pragma once

#include "editor-native/model/editor_ui_state.h"
#include "editor-native/model/selection_state.h"

namespace ArtCade::EditorNative {

class ProjectDocument;

// The viewport's pixel rectangle inside the window (prompt §13). RmlUi knows
// only this rect; it never touches the renderer.
struct ViewportRect {
    int x = 0;
    int y = 0;
    int width = 0;
    int height = 0;

    bool valid() const { return width > 0 && height > 0; }
    bool contains(int px, int py) const {
        return px >= x && px < x + width && py >= y && py < y + height;
    }
};

// =============================================================================
// SceneView — draws the active SceneDef of the document into a viewport rect
// with the per-scene pan/zoom, clipped by scissor. Reads the document; never
// owns it (prompt §13/§24.10). Uses raylib directly (no engine pipeline) so the
// spike target stays lean.
// =============================================================================
class SceneView {
public:
    void render(const ProjectDocument& document,
                const EditorSceneViewState& view,
                const SelectionState& selection,
                const ViewportRect& rect) const;
};

} // namespace ArtCade::EditorNative

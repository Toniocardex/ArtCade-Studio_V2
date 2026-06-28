#pragma once

#include "editor-native/model/editor_state.h"
#include "editor-native/model/scene_frame_snapshot.h"

namespace ArtCade::EditorNative {

class TextureCache;

// The viewport's pixel rectangle inside the window. RmlUi knows only this rect;
// it never touches the renderer.
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

// SceneView draws an immutable scene frame projection into a viewport rect.
// It never reads ProjectDocument or editor panels during draw; GPU resources are
// queried through TextureCache, a derived rendering cache.
class SceneView {
public:
    void render(const SceneFrameSnapshot& frame,
                const EditorSceneViewState& view,
                const ViewportRect& rect,
                const TextureCache& textures) const;
};

} // namespace ArtCade::EditorNative

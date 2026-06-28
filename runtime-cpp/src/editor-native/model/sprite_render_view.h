#pragma once

#include "core/types.h"

namespace ArtCade::EditorNative {

// =============================================================================
// SpriteRenderView — the immutable per-instance sprite descriptor the viewport
// consumes, so the renderer never searches the document for components during
// draw (prompt §13). Pure projection of the authoring instance; no ownership.
// =============================================================================
struct SpriteRenderView {
    bool    present = false;   // does the instance have a sprite renderer?
    bool    visible = false;   // ...and is it visible?
    AssetId assetId;           // referenced image asset ("" = none)
};

inline SpriteRenderView spriteRenderViewOf(const SceneInstanceDef& instance) {
    if (!instance.spriteRenderer.has_value()) return SpriteRenderView{};
    return SpriteRenderView{true,
                            instance.spriteRenderer->visible,
                            instance.spriteRenderer->imageAssetId};
}

} // namespace ArtCade::EditorNative

#include "editor-native/model/sprite_render_view.h"

#include "editor-native/model/project_document.h"

namespace ArtCade::EditorNative {

SpriteRenderView resolveSpriteRenderer(const ProjectDocument& document,
                                       const SceneId& sceneId, EntityId entityId) {
    const SceneInstanceDef* instance = document.findInstanceInScene(sceneId, entityId);
    if (!instance) return SpriteRenderView{};

    // 1. An instance override always wins.
    if (instance->spriteRenderer.has_value()) {
        return spriteRenderViewOf(*instance);
    }

    // 2. Otherwise inherit from the object type when it carries a sprite image.
    const auto& types = document.data().objectTypes;
    const auto it = types.find(instance->objectTypeId);
    if (it != types.end() && !it->second.sprite.spriteAssetId.empty()) {
        return SpriteRenderView{true,
                                it->second.visible,
                                it->second.sprite.spriteAssetId,
                                ComponentOrigin::EntityDefinition};
    }

    // 3. Neither: the entity has no sprite renderer.
    return SpriteRenderView{};
}

} // namespace ArtCade::EditorNative

#include "editor-native/model/box_collider_view.h"

#include "editor-native/model/project_document.h"

namespace ArtCade::EditorNative {

std::vector<SceneFrameCollider> collectBoxColliderBounds(const ProjectDocument& document,
                                                         const SceneId& sceneId,
                                                         EntityId selectedEntity) {
    std::vector<SceneFrameCollider> out;
    const SceneDef* scene = document.findScene(sceneId);
    if (!scene) return out;

    const auto& types = document.data().objectTypes;
    for (const SceneInstanceDef& instance : scene->instances) {
        const auto typeIt = types.find(instance.objectTypeId);
        if (typeIt == types.end() || !typeIt->second.boxCollider2D) continue;
        const BoxCollider2DComponent& collider = *typeIt->second.boxCollider2D;
        if (!collider.enabled) continue;
        const Vec2 center{
            instance.transform.position.x + collider.offset.x,
            instance.transform.position.y + collider.offset.y,
        };
        out.push_back(SceneFrameCollider{
            instance.id,
            WorldRect{
                center.x - collider.size.x * 0.5f,
                center.y - collider.size.y * 0.5f,
                collider.size.x,
                collider.size.y,
            },
            true,
            collider.isTrigger,
            instance.id == selectedEntity,
        });
    }
    return out;
}

} // namespace ArtCade::EditorNative

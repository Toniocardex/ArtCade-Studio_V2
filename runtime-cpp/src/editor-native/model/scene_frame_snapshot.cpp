#include "editor-native/model/scene_frame_snapshot.h"

#include "editor-native/model/project_document.h"
#include "editor-native/model/sprite_render_view.h"

namespace ArtCade::EditorNative {

namespace {

constexpr float kDefaultSpriteExtent = 48.f;

const Vec3* fillFor(const ProjectDocument& document, const std::string& typeId) {
    const auto& types = document.data().objectTypes;
    const auto it = types.find(typeId);
    return it == types.end() ? nullptr : &it->second.sprite.fillColor;
}

SceneFrameRect instanceBounds(const SceneInstanceDef& inst) {
    const Vec2 pos = inst.transform.position;
    const Vec2 scl = inst.transform.scale;
    const float width = kDefaultSpriteExtent * (scl.x == 0.f ? 1.f : scl.x);
    const float height = kDefaultSpriteExtent * (scl.y == 0.f ? 1.f : scl.y);
    return SceneFrameRect{pos.x - width * 0.5f, pos.y - height * 0.5f, width, height};
}

} // namespace

SceneFrameSnapshot collectSceneFrameSnapshot(const ProjectDocument& document,
                                             const SceneId& sceneId,
                                             EntityId selectedEntity) {
    SceneFrameSnapshot snapshot;
    snapshot.sceneId = sceneId;

    const SceneDef* scene = document.findScene(sceneId);
    if (!scene) return snapshot;

    snapshot.hasScene = true;
    snapshot.sceneName = scene->name;
    snapshot.worldSize = scene->worldSize;
    snapshot.backgroundColor = scene->backgroundColor;
    snapshot.colliders = collectBoxColliderBounds(document, sceneId, selectedEntity);

    for (const SceneInstanceDef& inst : scene->instances) {
        const SceneFrameRect bounds = instanceBounds(inst);
        const Vec3* fill = fillFor(document, inst.objectTypeId);
        const bool selected = inst.id == selectedEntity;
        snapshot.entities.push_back(SceneFrameEntity{
            inst.id,
            inst.instanceName,
            fill ? *fill : Vec3{0.47f, 0.49f, 0.52f},
            bounds,
            selected,
        });

        const SpriteRenderView sprite = resolveSpriteRenderer(document, sceneId, inst.id);
        if (sprite.present && !sprite.assetId.empty()) {
            snapshot.sprites.push_back(SceneFrameSprite{
                inst.id,
                sprite.assetId,
                bounds,
                Vec2{bounds.width * 0.5f, bounds.height * 0.5f},
                sprite.visible,
                selected,
            });
        }
    }

    return snapshot;
}

} // namespace ArtCade::EditorNative

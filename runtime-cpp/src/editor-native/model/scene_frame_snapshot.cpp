#include "editor-native/model/scene_frame_snapshot.h"

#include "editor-native/model/play_session.h"
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
    const Transform& transform = inst.transform;
    const Vec2 pos = transform.position;
    const Vec2 scl = transform.scale;
    const float width = kDefaultSpriteExtent * (scl.x == 0.f ? 1.f : scl.x);
    const float height = kDefaultSpriteExtent * (scl.y == 0.f ? 1.f : scl.y);
    return SceneFrameRect{pos.x - width * 0.5f, pos.y - height * 0.5f, width, height};
}

SceneFrameRect transformBounds(const Transform& transform) {
    const Vec2 pos = transform.position;
    const Vec2 scl = transform.scale;
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

SceneFrameSnapshot collectSceneFrameSnapshot(const PlaySession& session) {
    SceneFrameSnapshot snapshot;
    const RuntimeScene& scene = session.scene();
    snapshot.sceneId = scene.sourceSceneId;
    snapshot.hasScene = true;
    snapshot.sceneName = scene.name;
    snapshot.worldSize = scene.worldSize;
    snapshot.backgroundColor = scene.backgroundColor;

    for (const RuntimeEntity& entity : scene.entities) {
        const SceneFrameRect bounds = transformBounds(entity.transform);
        snapshot.entities.push_back(SceneFrameEntity{
            entity.id,
            entity.name,
            entity.fillColor,
            bounds,
            false,
        });

        if (entity.sprite.has_value() && !entity.sprite->assetId.empty()) {
            snapshot.sprites.push_back(SceneFrameSprite{
                entity.id,
                entity.sprite->assetId,
                bounds,
                Vec2{bounds.width * 0.5f, bounds.height * 0.5f},
                entity.sprite->visible,
                false,
            });
        }
    }

    return snapshot;
}

namespace {

bool rectContains(const SceneFrameRect& r, Vec2 p) {
    return p.x >= r.x && p.x <= r.x + r.width
        && p.y >= r.y && p.y <= r.y + r.height;
}

} // namespace

EntityId pickEntityAt(const SceneFrameSnapshot& frame, Vec2 worldPoint) {
    // Placeholders draw first, then sprites; the last drawn item that contains
    // the point is on top, so let later hits override earlier ones.
    EntityId hit = INVALID_ENTITY;
    for (const SceneFrameEntity& entity : frame.entities)
        if (rectContains(entity.bounds, worldPoint)) hit = entity.entityId;
    for (const SceneFrameSprite& sprite : frame.sprites)
        if (sprite.visible && rectContains(sprite.destination, worldPoint)) hit = sprite.entityId;
    return hit;
}

} // namespace ArtCade::EditorNative

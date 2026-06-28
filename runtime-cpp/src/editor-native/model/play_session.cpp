#include "editor-native/model/play_session.h"

#include "editor-native/model/project_document.h"
#include "editor-native/model/sprite_render_view.h"

#include <cmath>
#include <utility>

namespace ArtCade::EditorNative {

namespace {

const ImageAssetDef* findImageAsset(const ProjectDocument& document, const AssetId& id) {
    for (const ImageAssetDef& asset : document.data().imageAssets) {
        if (asset.assetId == id) return &asset;
    }
    return nullptr;
}

const Vec3* fillFor(const ProjectDocument& document, const std::string& typeId) {
    const auto& types = document.data().objectTypes;
    const auto it = types.find(typeId);
    return it == types.end() ? nullptr : &it->second.sprite.fillColor;
}

bool finite(Vec2 value) {
    return std::isfinite(value.x) && std::isfinite(value.y);
}

} // namespace

std::optional<PlaySession> PlaySession::materialize(const ProjectDocument& document,
                                                    const SceneId& sceneId,
                                                    std::string* error) {
    const SceneDef* scene = document.findScene(sceneId);
    if (!scene) {
        if (error) *error = "Cannot start Play: scene does not exist";
        return std::nullopt;
    }

    PlaySession session;
    session.scene().sourceSceneId = scene->id;
    session.scene().name = scene->name;
    session.scene().worldSize = scene->worldSize;
    session.scene().backgroundColor = scene->backgroundColor;

    for (const SceneInstanceDef& instance : scene->instances) {
        RuntimeEntity entity;
        entity.id = instance.id;
        entity.name = instance.instanceName;
        entity.transform = instance.transform;
        if (const Vec3* fill = fillFor(document, instance.objectTypeId)) {
            entity.fillColor = *fill;
        }

        const SpriteRenderView sprite =
            resolveSpriteRenderer(document, sceneId, instance.id);
        if (sprite.present && !sprite.assetId.empty()) {
            const ImageAssetDef* asset = findImageAsset(document, sprite.assetId);
            if (!asset) {
                if (error) {
                    *error = "Cannot start Play: sprite references missing image asset "
                           + sprite.assetId;
                }
                return std::nullopt;
            }
            entity.sprite = RuntimeSpriteComponent{sprite.assetId, sprite.visible};
            session.assets_.imageAssets.emplace(
                asset->assetId, RuntimeImageAsset{asset->assetId, asset->sourcePath});
        }

        session.scene().entities.push_back(std::move(entity));
    }

    return session;
}

std::optional<PlaySession> PlaySession::startProject(const ProjectDocument& document,
                                                     std::string* error) {
    return materialize(document, document.startSceneId(), error);
}

std::optional<PlaySession> PlaySession::startActiveScene(const ProjectDocument& document,
                                                        const SceneId& sceneId,
                                                        std::string* error) {
    return materialize(document, sceneId, error);
}

RuntimeEntity* PlaySession::findEntity(EntityId id) {
    for (RuntimeEntity& entity : scene_.entities) {
        if (entity.id == id) return &entity;
    }
    return nullptr;
}

const RuntimeEntity* PlaySession::findEntity(EntityId id) const {
    for (const RuntimeEntity& entity : scene_.entities) {
        if (entity.id == id) return &entity;
    }
    return nullptr;
}

bool PlaySession::translateEntity(EntityId id, Vec2 delta) {
    if (!finite(delta)) return false;
    RuntimeEntity* entity = findEntity(id);
    if (!entity) return false;
    entity->transform.position.x += delta.x;
    entity->transform.position.y += delta.y;
    return true;
}

} // namespace ArtCade::EditorNative

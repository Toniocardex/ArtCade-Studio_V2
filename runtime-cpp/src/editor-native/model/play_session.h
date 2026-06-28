#pragma once

#include "core/types.h"

#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::EditorNative {

class ProjectDocument;

struct RuntimeSpriteComponent {
    AssetId assetId;
    bool visible = true;
};

struct RuntimeEntity {
    EntityId id = INVALID_ENTITY;
    std::string name;
    Transform transform;
    Vec2 velocity{};   // world units/second, resolved from authoring at materialize
    Vec3 fillColor{0.47f, 0.49f, 0.52f};
    std::optional<RuntimeSpriteComponent> sprite;
};

struct RuntimeScene {
    SceneId sourceSceneId;
    std::string name;
    Vec2 worldSize;
    Vec4 backgroundColor;
    std::vector<RuntimeEntity> entities;
};

struct RuntimeImageAsset {
    AssetId id;
    std::string sourcePath;
};

struct PlayAssetCatalogSnapshot {
    std::unordered_map<AssetId, RuntimeImageAsset> imageAssets;
};

// Runtime side of Play/Stop. It is built once from ProjectDocument at Start
// Play, then draw/tick read this session and never the authoring document.
class PlaySession {
public:
    static std::optional<PlaySession> startProject(const ProjectDocument& document,
                                                   std::string* error = nullptr);

    static std::optional<PlaySession> startActiveScene(const ProjectDocument& document,
                                                       const SceneId& sceneId,
                                                       std::string* error = nullptr);

    const SceneId& sceneId() const { return scene_.sourceSceneId; }
    const RuntimeScene& scene() const { return scene_; }
    RuntimeScene& scene() { return scene_; }
    const PlayAssetCatalogSnapshot& assets() const { return assets_; }

    std::vector<RuntimeEntity>& entities() { return scene_.entities; }
    const std::vector<RuntimeEntity>& entities() const { return scene_.entities; }
    RuntimeEntity* findEntity(EntityId id);
    const RuntimeEntity* findEntity(EntityId id) const;
    bool translateEntity(EntityId id, Vec2 delta);

    // Runtime simulation step: integrates each entity's authored velocity into
    // its transform. Pure runtime mutation — never touches ProjectDocument.
    void advance(float dt);

private:
    static std::optional<PlaySession> materialize(const ProjectDocument& document,
                                                  const SceneId& sceneId,
                                                  std::string* error);

    RuntimeScene scene_;
    PlayAssetCatalogSnapshot assets_;
};

} // namespace ArtCade::EditorNative

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

// Input-driven top-down movement at a constant speed (the canonical maxSpeed).
struct RuntimeTopDownController {
    float speed = 0.f;
};

// Runtime copy of BoxCollider2D, materialized from the object type at Start Play.
struct RuntimeBoxCollider {
    Vec2 offset{};
    Vec2 size{32.f, 32.f};
    bool enabled = true;
    bool isTrigger = false;
};

struct RuntimeEntity {
    EntityId id = INVALID_ENTITY;
    std::string name;
    Transform transform;
    Vec2 velocity{};   // world units/second, resolved from authoring at materialize
    Vec3 fillColor{0.47f, 0.49f, 0.52f};
    std::optional<RuntimeSpriteComponent> sprite;
    std::optional<RuntimeTopDownController> topDownController;
    std::optional<RuntimeBoxCollider> collider;
};

// World-space axis-aligned bounding box (min/max corners).
struct Aabb {
    float minX = 0.f, minY = 0.f, maxX = 0.f, maxY = 0.f;
};

// The single authoritative runtime collider AABB: center = position + offset,
// extents = size/2. Mirrors the editor's collider draw convention so physics and
// the overlay agree. Caller guarantees the entity has a collider.
Aabb runtimeColliderBounds(const RuntimeEntity& entity);

// Per-frame gameplay input, built by the application from the platform and fed to
// the session. PlaySession stays free of Raylib/RmlUi.
struct RuntimeInputSnapshot {
    bool moveLeft = false;
    bool moveRight = false;
    bool moveUp = false;
    bool moveDown = false;
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
    const RuntimeEntity* findEntity(EntityId id) const;

    // Runtime simulation step: integrates each entity's authored velocity into
    // its transform. Pure runtime mutation — never touches ProjectDocument.
    void advance(float dt);

    // Input-driven step: moves each TopDownController entity by the (diagonal-
    // normalized) input direction at its speed. Pure runtime mutation; opposite
    // inputs cancel; non-finite or non-positive dt is a no-op.
    void update(const RuntimeInputSnapshot& input, float dt);

private:
    static std::optional<PlaySession> materialize(const ProjectDocument& document,
                                                  const SceneId& sceneId,
                                                  std::string* error);

    // The one internal entry point for runtime movement: both LinearMover
    // (advance) and TopDownController (update) route a desired delta through here.
    // It resolves the kinematic mover against the static solids with a per-axis
    // swept clamp (resolve X, then Y using the new X) so movement slides along
    // walls and never tunnels through thin ones at high speed. A mover with no
    // active solid collider moves freely. Returns the delta actually applied.
    Vec2 moveKinematicEntity(RuntimeEntity& entity, Vec2 desiredDelta);

    RuntimeScene scene_;
    PlayAssetCatalogSnapshot assets_;
    // Obstacle AABBs frozen at materialize: entities with an enabled, non-trigger
    // collider that are NOT kinematic movers (mover-vs-mover is out of scope).
    std::vector<Aabb> staticSolids_;
};

} // namespace ArtCade::EditorNative

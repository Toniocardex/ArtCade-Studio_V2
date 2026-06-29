#include "editor-native/model/play_session.h"

#include "editor-native/model/project_document.h"
#include "editor-native/model/sprite_render_view.h"

#include <algorithm>
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

// Mirrors the canonical runtime (World::tickLinearMovers): velocity is the
// normalized authored direction scaled by a non-negative speed.
Vec2 normalizeOrZero(Vec2 v) {
    const float len = std::sqrt(v.x * v.x + v.y * v.y);
    if (len <= 0.f) return Vec2{0.f, 0.f};
    return Vec2{v.x / len, v.y / len};
}

const LinearMoverComponent* moverFor(const ProjectDocument& document,
                                     const std::string& typeId) {
    const auto& types = document.data().objectTypes;
    const auto it = types.find(typeId);
    if (it == types.end() || !it->second.linearMover) return nullptr;
    return &*it->second.linearMover;
}

const TopDownControllerComponent* controllerFor(const ProjectDocument& document,
                                                const std::string& typeId) {
    const auto& types = document.data().objectTypes;
    const auto it = types.find(typeId);
    if (it == types.end() || !it->second.topDownController) return nullptr;
    return &*it->second.topDownController;
}

const BoxCollider2DComponent* colliderFor(const ProjectDocument& document,
                                          const std::string& typeId) {
    const auto& types = document.data().objectTypes;
    const auto it = types.find(typeId);
    if (it == types.end() || !it->second.boxCollider2D) return nullptr;
    return &*it->second.boxCollider2D;
}

// True when the mover's collider can be blocked / can block: present, enabled and
// not a trigger. Disabled or trigger colliders never participate in resolution.
bool isSolid(const std::optional<RuntimeBoxCollider>& collider) {
    return collider && collider->enabled && !collider->isTrigger;
}

// Largest fraction of `move` allowed along one axis before the mover box [lo,hi]
// would penetrate a solid box [sLo,sHi], given the boxes already overlap on the
// cross axis. Only solids genuinely ahead constrain the move, so an already-
// penetrated box never yanks the mover back (no auto-depenetration).
float clampAxis(float move, float lo, float hi, float sLo, float sHi) {
    if (move > 0.f) {
        const float gap = sLo - hi;            // distance to the solid ahead
        if (gap >= 0.f && gap < move) return gap;
    } else if (move < 0.f) {
        const float gap = sHi - lo;            // negative distance to the solid behind
        if (gap <= 0.f && gap > move) return gap;
    }
    return move;
}

} // namespace

Aabb runtimeColliderBounds(const RuntimeEntity& entity) {
    const RuntimeBoxCollider& c = *entity.collider;
    const float cx = entity.transform.position.x + c.offset.x;
    const float cy = entity.transform.position.y + c.offset.y;
    const float hx = c.size.x * 0.5f;
    const float hy = c.size.y * 0.5f;
    return Aabb{cx - hx, cy - hy, cx + hx, cy + hy};
}

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
        const LinearMoverComponent* mover = moverFor(document, instance.objectTypeId);
        if (mover && !mover->_paused) {
            const Vec2 dir = normalizeOrZero(Vec2{mover->directionX, mover->directionY});
            const float speed = std::max(0.f, mover->speed);
            entity.velocity = Vec2{dir.x * speed, dir.y * speed};
        }
        const TopDownControllerComponent* controller =
            controllerFor(document, instance.objectTypeId);
        if (controller) {
            entity.topDownController = RuntimeTopDownController{std::max(0.f, controller->maxSpeed)};
        }
        if (const BoxCollider2DComponent* box = colliderFor(document, instance.objectTypeId)) {
            entity.collider = RuntimeBoxCollider{box->offset, box->size, box->enabled, box->isTrigger};
        }
        // A static solid is an obstacle: an active solid collider on an entity that
        // is not itself a kinematic mover (mover-vs-mover is out of scope).
        const bool isMover = (mover != nullptr) || (controller != nullptr);
        if (!isMover && isSolid(entity.collider)) {
            session.staticSolids_.push_back(runtimeColliderBounds(entity));
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

const RuntimeEntity* PlaySession::findEntity(EntityId id) const {
    for (const RuntimeEntity& entity : scene_.entities) {
        if (entity.id == id) return &entity;
    }
    return nullptr;
}

Vec2 PlaySession::moveKinematicEntity(RuntimeEntity& entity, Vec2 desiredDelta) {
    // A mover without an active solid collider is unconstrained.
    if (!isSolid(entity.collider)) {
        entity.transform.position.x += desiredDelta.x;
        entity.transform.position.y += desiredDelta.y;
        return desiredDelta;
    }

    Vec2 applied{0.f, 0.f};

    // -- X axis: clamp against every solid the mover overlaps on Y -------------
    {
        const Aabb m = runtimeColliderBounds(entity);
        float dx = desiredDelta.x;
        for (const Aabb& s : staticSolids_) {
            if (m.minY < s.maxY && s.minY < m.maxY)        // strict: touching != overlapping
                dx = clampAxis(dx, m.minX, m.maxX, s.minX, s.maxX);
        }
        entity.transform.position.x += dx;
        applied.x = dx;
    }

    // -- Y axis: re-evaluate with the updated X so corners slide ---------------
    {
        const Aabb m = runtimeColliderBounds(entity);
        float dy = desiredDelta.y;
        for (const Aabb& s : staticSolids_) {
            if (m.minX < s.maxX && s.minX < m.maxX)
                dy = clampAxis(dy, m.minY, m.maxY, s.minY, s.maxY);
        }
        entity.transform.position.y += dy;
        applied.y = dy;
    }

    return applied;
}

void PlaySession::advance(float dt) {
    if (dt <= 0.f) return;
    // Authored velocity (LinearMover) routed through the one resolver.
    for (RuntimeEntity& entity : scene_.entities) {
        moveKinematicEntity(entity, Vec2{entity.velocity.x * dt, entity.velocity.y * dt});
    }
}

void PlaySession::update(const RuntimeInputSnapshot& input, float dt) {
    if (!std::isfinite(dt) || dt <= 0.f) return;

    // Opposite inputs cancel; the diagonal is normalized so it is never faster.
    const Vec2 direction = normalizeOrZero(Vec2{
        static_cast<float>(input.moveRight) - static_cast<float>(input.moveLeft),
        static_cast<float>(input.moveDown) - static_cast<float>(input.moveUp),
    });
    if (direction.x == 0.f && direction.y == 0.f) return;

    // Input-driven movement (TopDownController) routed through the one resolver.
    for (RuntimeEntity& entity : scene_.entities) {
        if (!entity.topDownController) continue;
        const float speed = entity.topDownController->speed;
        moveKinematicEntity(entity, Vec2{direction.x * speed * dt, direction.y * speed * dt});
    }
}

} // namespace ArtCade::EditorNative

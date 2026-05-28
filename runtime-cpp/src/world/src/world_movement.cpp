#include "world_internal.h"
#include "world_grounding.h"
#include "world_platformer_controller.h"
#include "world_topdown_controller.h"

#include <algorithm>

namespace ArtCade {

WorldInternal::GroundingContext World::groundingContext() const {
    const bool hasTilemap =
        activeTilemap_.cols > 0 && activeTilemap_.rows > 0;
    return WorldInternal::GroundingContext{
        entityGateway_,
        physics_,
        hasTilemap ? &activeTilemap_ : nullptr,
        &tileMeta_,
    };
}

bool World::isPlatformerGrounded(EntityId id) const {
    PlatformerControllerComponent pc{};
    if (!entityGateway_.getPlatformerController(id, pc)) return false;
    return WorldInternal::isGrounded(groundingContext(), id, pc.groundClass);
}

bool World::isGroundedOnSolidAabb(EntityId id, const std::string& groundClass) const {
    return WorldInternal::isGroundedOnSolidAabb(
        groundingContext(), id, groundClass);
}

bool World::isGrounded(EntityId id, const std::string& groundClass) const {
    return WorldInternal::isGrounded(groundingContext(), id, groundClass);
}

void World::tickPlatformerControllers(float dt) {
    entityGateway_.forEachActivePlatformer(
        [this, dt](EntityId id, const PlatformerControllerComponent& pc) {
            WorldInternal::stepPlatformerController(*this, id, pc, dt);
        });
}

void World::tickTopDownControllers(float dt) {
    entityGateway_.forEachActiveTopDown(
        [this, dt](EntityId id, const TopDownControllerComponent& tc) {
            WorldInternal::stepTopDownController(*this, id, tc, dt);
        });
}

void World::tickLinearMovers(float dt) {
    entityGateway_.forEachActiveLinearMover(
        [this, dt](EntityId id, const LinearMoverComponent& lm) {
            if (lm._paused) return;
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;
            TopDownControllerComponent topDown{};
            if (entityGateway_.getTopDownController(id, topDown))
                return;

            const Vec2 direction = WorldInternal::normalizeOrZero({
                lm.directionX, lm.directionY });
            const Vec2 velocity = {
                direction.x * std::max(0.f, lm.speed),
                direction.y * std::max(0.f, lm.speed),
            };

            WorldInternal::applySteeringVelocity(
                physics_, entityGateway_, id, velocity, dt);
        });
}

void World::setMovementIntent(EntityId id, float directionX, float directionY) {
    if (id == INVALID_ENTITY) return;
    auto& intent = controlIntents_[id];
    intent.movement = {
        std::clamp(directionX, -1.f, 1.f),
        std::clamp(directionY, -1.f, 1.f)
    };
    intent.hasMovement = true;
}

void World::clearMovementIntent(EntityId id) {
    if (id == INVALID_ENTITY) return;
    auto it = controlIntents_.find(id);
    if (it == controlIntents_.end()) return;
    it->second.hasMovement = false;
    it->second.movement = {};
}

void World::requestJump(EntityId id) {
    if (id == INVALID_ENTITY) return;
    controlIntents_[id].jumpRequested = true;
}

void World::tickSimpleMovementIntents(float dt) {
    constexpr float kDefaultSpeed = 240.f;
    for (const auto& [id, intent] : controlIntents_) {
        if (!intent.hasMovement) continue;
        PlatformerControllerComponent platformer{};
        if (entityGateway_.getPlatformerController(id, platformer)) continue;
        TopDownControllerComponent topDown{};
        if (entityGateway_.getTopDownController(id, topDown)) continue;

        const float ax = std::clamp(intent.movement.x, -1.f, 1.f);
        const float ay = std::clamp(intent.movement.y, -1.f, 1.f);
        if (ax == 0.f && ay == 0.f) continue;

        Transform transform{};
        if (!entityGateway_.getTransform(id, transform)) continue;
        transform.position.x += ax * kDefaultSpeed * dt;
        transform.position.y += ay * kDefaultSpeed * dt;
        entityGateway_.setTransform(id, transform);
    }
}

} // namespace ArtCade

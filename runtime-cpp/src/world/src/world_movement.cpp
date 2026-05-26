#include "world_internal.h"

#include <algorithm>

namespace ArtCade {

bool World::isPlatformerGrounded(EntityId id) const {
    PlatformerControllerComponent pc{};
    if (!entityGateway_.getPlatformerController(id, pc)) return false;
    return isGrounded(id, pc.groundClass);
}

bool World::isGrounded(EntityId id, const std::string& groundClass) const {
    const uint32_t selfHandle = entityGateway_.physicsHandle(id);
    if (selfHandle == 0) return false;

    bool grounded = false;
    entityGateway_.forEachActiveSolid(
        [this, id, selfHandle, &groundClass, &grounded]
        (EntityId otherId, const SolidComponent& solid) {
            if (grounded || otherId == id) return;
            if (solid.groundClass != groundClass) return;
            const uint32_t otherHandle = entityGateway_.physicsHandle(otherId);
            if (otherHandle == 0) return;
            if (physics_.areOverlapping(selfHandle, otherHandle))
                grounded = true;
        });
    if (grounded) return true;

    for (EntityId otherId : entityGateway_.poolByClass(groundClass)) {
        if (otherId == id) continue;
        const uint32_t otherHandle = entityGateway_.physicsHandle(otherId);
        if (otherHandle == 0) continue;
        if (physics_.areOverlapping(selfHandle, otherHandle))
            return true;
    }
    return false;
}

void World::tickPlatformerControllers(float dt) {
    entityGateway_.forEachActivePlatformer(
        [this, dt](EntityId id, const PlatformerControllerComponent& pc) {
            auto& rt = platformerRt_[id];

            const bool grounded = isGrounded(id, pc.groundClass);
            if (grounded)
                rt.coyoteTimer = pc.coyoteTime;
            else
                rt.coyoteTimer = std::max(0.f, rt.coyoteTimer - dt);

            auto intentIt = controlIntents_.find(id);
            ControlIntent* intent = intentIt != controlIntents_.end()
                ? &intentIt->second
                : nullptr;

            if (intent && intent->jumpRequested)
                rt.jumpBufferTimer = pc.jumpBuffer;
            else
                rt.jumpBufferTimer = std::max(0.f, rt.jumpBufferTimer - dt);

            const uint32_t handle = entityGateway_.physicsHandle(id);

            float vx = 0.f;
            float vy = handle != 0
                ? physics_.getLinearVelocity(handle).y
                : rt.velocity.y;

            if (intent && intent->hasMovement) {
                const float axis = std::clamp(intent->movement.x, -1.f, 1.f);
                vx = axis * pc.maxSpeed;
            }

            if (rt.jumpBufferTimer > 0.f && rt.coyoteTimer > 0.f) {
                vy = -pc.jumpForce;
                rt.coyoteTimer     = 0.f;
                rt.jumpBufferTimer = 0.f;
            } else if (!grounded) {
                vy += pc.customGravity * dt;
            } else if (handle == 0) {
                vy = 0.f;
            }

            if (handle != 0) {
                physics_.setLinearVelocity(handle, { vx, vy });
            } else {
                rt.velocity = { vx, vy };
                Transform transform{};
                if (!entityGateway_.getTransform(id, transform)) return;
                transform.velocity = rt.velocity;
                transform.position.x += rt.velocity.x * dt;
                transform.position.y += rt.velocity.y * dt;
                entityGateway_.setTransform(id, transform);
            }

            if (intent)
                intent->jumpRequested = false;
        });
}

void World::tickTopDownControllers(float dt) {
    entityGateway_.forEachActiveTopDown(
        [this, dt](EntityId id, const TopDownControllerComponent& tc) {
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;

            auto& rt = topDownRt_[id];
            auto intentIt = controlIntents_.find(id);
            ControlIntent* intent = intentIt != controlIntents_.end()
                ? &intentIt->second
                : nullptr;

            Vec2 targetVelocity{};
            if (intent && intent->hasMovement) {
                const Vec2 direction = WorldInternal::constrainTopDownDirection(
                    intent->movement, tc.fourDirections);
                targetVelocity = {
                    direction.x * tc.maxSpeed,
                    direction.y * tc.maxSpeed,
                };
                rt.velocity = WorldInternal::approach(
                    rt.velocity, targetVelocity, std::max(0.f, tc.acceleration) * dt);
            } else {
                rt.velocity = WorldInternal::approach(
                    rt.velocity, {}, std::max(0.f, tc.friction) * dt);
            }

            const uint32_t handle = entityGateway_.physicsHandle(id);
            if (handle != 0) {
                physics_.setLinearVelocity(handle, rt.velocity);
                return;
            }

            Transform transform{};
            if (!entityGateway_.getTransform(id, transform)) return;
            transform.velocity = rt.velocity;
            transform.position.x += rt.velocity.x * dt;
            transform.position.y += rt.velocity.y * dt;
            entityGateway_.setTransform(id, transform);
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

} // namespace ArtCade

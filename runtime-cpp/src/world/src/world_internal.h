#pragma once

#include "../include/world.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <algorithm>
#include <cmath>

namespace ArtCade::WorldInternal {

inline float lengthSq(Vec2 v) {
    return v.x * v.x + v.y * v.y;
}

inline Vec2 normalizeOrZero(Vec2 v) {
    const float len2 = lengthSq(v);
    if (len2 <= 0.000001f) return {};
    const float inv = 1.f / std::sqrt(len2);
    return { v.x * inv, v.y * inv };
}

inline Vec2 approach(Vec2 current, Vec2 target, float maxDelta) {
    const Vec2 delta{ target.x - current.x, target.y - current.y };
    const float dist2 = lengthSq(delta);
    if (dist2 <= maxDelta * maxDelta || dist2 <= 0.000001f)
        return target;
    const float inv = 1.f / std::sqrt(dist2);
    return {
        current.x + delta.x * inv * maxDelta,
        current.y + delta.y * inv * maxDelta,
    };
}

inline Vec2 constrainTopDownDirection(Vec2 direction, bool fourDirections) {
    direction.x = std::clamp(direction.x, -1.f, 1.f);
    direction.y = std::clamp(direction.y, -1.f, 1.f);
    if (fourDirections && direction.x != 0.f && direction.y != 0.f) {
        if (std::abs(direction.x) >= std::abs(direction.y))
            direction.y = 0.f;
        else
            direction.x = 0.f;
    }
    return normalizeOrZero(direction);
}

inline void applySteeringVelocity(Modules::Physics& physics,
                                  Modules::RuntimeEntityGateway& gateway,
                                  EntityId id,
                                  const Vec2& velocity,
                                  float dt)
{
    // NOTE: do NOT early-return on SolidComponent. "Solid" is a collision
    // flag (this entity blocks others), NOT an immobility marker. Static
    // bodies are correctly skipped below via bodyType==Static. The earlier
    // Solid-as-immobile check froze every horde enemy that had collision.
    const uint32_t handle = gateway.physicsHandle(id);
    if (handle != 0) {
        PhysicsComponent physicsComp{};
        if (gateway.getPhysicsComponent(id, physicsComp) &&
            physicsComp.bodyType != BodyType::Static)
        {
            physics.setLinearVelocity(handle, velocity);
            return;
        }
        // Static body: refuse to move it via steering.
        if (gateway.getPhysicsComponent(id, physicsComp) &&
            physicsComp.bodyType == BodyType::Static)
            return;
    }

    Transform transform{};
    if (!gateway.getTransform(id, transform)) return;
    transform.velocity = velocity;
    transform.position.x += velocity.x * dt;
    transform.position.y += velocity.y * dt;
    gateway.setTransform(id, transform);
}

} // namespace ArtCade::WorldInternal

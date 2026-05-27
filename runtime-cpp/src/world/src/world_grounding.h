#pragma once

#include "../../core/types.h"
#include <string>

namespace ArtCade::Modules {
class RuntimeEntityGateway;
class Physics;
}

namespace ArtCade::WorldInternal {

struct GroundingContext {
    const Modules::RuntimeEntityGateway& gateway;
    Modules::Physics&                    physics;
};

/** Result of probing Solid surfaces for a kinematic platformer (Y-down). */
struct PlatformerSolidContact {
    bool  onGround     = false;
    float surfaceTopY  = 0.f;   // ground.minY of supporting Solid
};

/**
 * Native platformer ground: horizontal overlap with Solid + feet near surface top.
 * Full solids use height-scaled bands; oneWay uses a narrow top-edge band + vy >= 0.
 */
PlatformerSolidContact probePlatformerSolidContact(
    const GroundingContext& ctx,
    EntityId id,
    const std::string& groundClass,
    float verticalVelocity);

/** Place entity transform so AABB feet (maxY) sit on surfaceTopY. */
void snapTransformFeetToSurface(Transform& transform,
                                const GroundingContext& ctx,
                                EntityId id,
                                float surfaceTopY);

/** Solid surface faces (bottom + sides); top via probe + floor snap. One-way: probe only. */
void resolvePlatformerSolidSurfaces(Transform& transform,
                                    const GroundingContext& ctx,
                                    EntityId id,
                                    const std::string& groundClass,
                                    const Transform& transformBeforeMove,
                                    float& horizontalVelocity,
                                    float& verticalVelocity);

/** Solid-component ground (platformer path). */
bool isGroundedOnSolidAabb(const GroundingContext& ctx,
                           EntityId id,
                           const std::string& groundClass);

/** Grounded check: Solid probe for platformers; Box2D overlap for others. */
bool isGrounded(const GroundingContext& ctx,
                EntityId id,
                const std::string& groundClass);

} // namespace ArtCade::WorldInternal

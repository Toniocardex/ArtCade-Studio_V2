#pragma once

#include "../../core/types.h"
#include <functional>
#include <string>
#include <unordered_map>

namespace ArtCade::Modules {
class RuntimeEntityGateway;
class Physics;
}

namespace ArtCade::WorldInternal {

struct GroundingContext {
    const Modules::RuntimeEntityGateway& gateway;
    Modules::Physics&                    physics;
    const TilemapData*                   tilemap  = nullptr;
    const std::unordered_map<int, TileSurfaceMeta>* tileMeta = nullptr;
};

/** Result of probing surfaces for a kinematic platformer (Y-down). */
struct PlatformerSolidContact {
    bool  onGround     = false;
    float surfaceTopY  = 0.f;   // supporting surface minY
};

/**
 * Native platformer ground: Solid entities + solid tile cells (same AABB rules).
 */
PlatformerSolidContact probePlatformerSolidContact(
    const GroundingContext& ctx,
    EntityId id,
    const std::string& groundClass,
    float verticalVelocity);

/** Solid + tile surface faces (bottom + sides); top via probe + floor snap. */
void resolvePlatformerSolidSurfaces(Transform& transform,
                                    const GroundingContext& ctx,
                                    EntityId id,
                                    const std::string& groundClass,
                                    const Transform& transformBeforeMove,
                                    float& horizontalVelocity,
                                    float& verticalVelocity);

void snapTransformFeetToSurface(Transform& transform,
                                const GroundingContext& ctx,
                                EntityId id,
                                float surfaceTopY);

bool isGroundedOnSolidAabb(const GroundingContext& ctx,
                           EntityId id,
                           const std::string& groundClass);

bool isGrounded(const GroundingContext& ctx,
                EntityId id,
                const std::string& groundClass);

} // namespace ArtCade::WorldInternal

#include "world_grounding.h"
#include "world_internal.h"

#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace ArtCade::WorldInternal {

namespace {

constexpr float kMinCoyoteAbovePx = 4.f;

float aabbHalfHeight(const WorldAabb& box) {
    return std::max(1.f, (box.maxY - box.minY) * 0.5f);
}

bool horizontalOverlap(const WorldAabb& a, const WorldAabb& b) {
    return !(a.maxX < b.minX || a.minX > b.maxX);
}

} // namespace

PlatformerSolidContact probePlatformerSolidContact(
    const GroundingContext& ctx,
    EntityId id,
    const std::string& groundClass)
{
    PlatformerSolidContact best{};
    const WorldAabb player = worldAabb(ctx.gateway, id);
    const float feetY      = player.maxY;
    const float halfH      = aabbHalfHeight(player);
    const float coyoteAbove =
        std::max(kMinCoyoteAbovePx, halfH * 0.2f);
    const float maxBelow =
        halfH + 2.f;

    float bestDy = std::numeric_limits<float>::max();

    ctx.gateway.forEachActiveSolid(
        [&](EntityId otherId, const SolidComponent& solid) {
            if (otherId == id) return;
            if (solid.groundClass != groundClass) return;

            const WorldAabb ground = worldAabb(ctx.gateway, otherId);
            if (!horizontalOverlap(player, ground)) return;

            const float topY = ground.minY;
            const float dy   = feetY - topY;
            if (dy < -coyoteAbove || dy > maxBelow) return;
            if (dy >= bestDy) return;

            bestDy          = dy;
            best.onGround   = true;
            best.surfaceTopY = topY;
        });

    return best;
}

void snapTransformFeetToSurface(Transform& transform,
                                const GroundingContext& ctx,
                                EntityId id,
                                float surfaceTopY)
{
    const WorldAabb box = worldAabb(ctx.gateway, id);
    const float halfH   = aabbHalfHeight(box);
    transform.position.y = surfaceTopY - halfH;
}

bool isGroundedOnSolidAabb(const GroundingContext& ctx,
                           EntityId id,
                           const std::string& groundClass)
{
    return probePlatformerSolidContact(ctx, id, groundClass).onGround;
}

bool isGroundedViaPhysicsOverlap(const GroundingContext& ctx,
                                 EntityId id,
                                 const std::string& groundClass)
{
    const uint32_t selfHandle = ctx.gateway.physicsHandle(id);
    if (selfHandle == 0) return false;

    bool grounded = false;
    ctx.gateway.forEachActiveSolid(
        [&ctx, id, selfHandle, &groundClass, &grounded]
        (EntityId otherId, const SolidComponent& solid) {
            if (grounded || otherId == id) return;
            if (solid.groundClass != groundClass) return;
            const uint32_t otherHandle = ctx.gateway.physicsHandle(otherId);
            if (otherHandle == 0) return;
            if (ctx.physics.areOverlapping(selfHandle, otherHandle))
                grounded = true;
        });

    if (grounded) return true;

    for (EntityId otherId : ctx.gateway.poolByClass(groundClass)) {
        if (otherId == id) continue;
        const uint32_t otherHandle = ctx.gateway.physicsHandle(otherId);
        if (otherHandle == 0) continue;
        if (ctx.physics.areOverlapping(selfHandle, otherHandle))
            return true;
    }
    return false;
}

bool isGrounded(const GroundingContext& ctx,
                EntityId id,
                const std::string& groundClass)
{
    PlatformerControllerComponent pc{};
    if (ctx.gateway.getPlatformerController(id, pc)) {
        return probePlatformerSolidContact(ctx, id, groundClass).onGround;
    }

    if (isGroundedOnSolidAabb(ctx, id, groundClass))
        return true;

    return isGroundedViaPhysicsOverlap(ctx, id, groundClass);
}

} // namespace ArtCade::WorldInternal

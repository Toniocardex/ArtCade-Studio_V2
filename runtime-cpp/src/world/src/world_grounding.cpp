#include "world_grounding.h"
#include "world_internal.h"

#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"

namespace ArtCade::WorldInternal {

bool isGroundedOnSolidAabb(const GroundingContext& ctx,
                           EntityId id,
                           const std::string& groundClass)
{
    const WorldAabb player = worldAabb(ctx.gateway, id);
    const float feetY = player.maxY;

    // Y-down: ground top = minY, player feet = maxY. Allow standing slightly
    // above (coyote) and modest penetration (gravity integration per frame).
    const float snapAbovePx    = 8.f;
    const float maxPenetrationPx = 32.f;

    bool grounded = false;
    ctx.gateway.forEachActiveSolid(
        [&ctx, id, feetY, player, snapAbovePx, maxPenetrationPx, &groundClass, &grounded]
        (EntityId otherId, const SolidComponent& solid) {
            if (grounded || otherId == id) return;
            if (solid.groundClass != groundClass) return;

            const WorldAabb ground = worldAabb(ctx.gateway, otherId);
            const float topY = ground.minY;

            const float dy = feetY - topY;
            if (dy < -snapAbovePx || dy > maxPenetrationPx)
                return;
            if (player.maxX < ground.minX || player.minX > ground.maxX)
                return;
            grounded = true;
        });
    return grounded;
}

bool isGrounded(const GroundingContext& ctx,
                EntityId id,
                const std::string& groundClass)
{
    // Solid surfaces use explicit AABB against SolidComponent — reliable for
    // kinematic platformers even when a Physics collider exists on the player.
    if (isGroundedOnSolidAabb(ctx, id, groundClass))
        return true;

    const uint32_t selfHandle = ctx.gateway.physicsHandle(id);
    if (selfHandle != 0) {
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
    }

    return false;
}

} // namespace ArtCade::WorldInternal

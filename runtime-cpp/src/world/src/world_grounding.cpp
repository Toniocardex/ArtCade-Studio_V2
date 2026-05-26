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

    const float snapDownPx = 6.f;
    const float snapUpPx   = 2.f;

    bool grounded = false;
    ctx.gateway.forEachActiveSolid(
        [&ctx, id, feetY, player, snapDownPx, snapUpPx, &groundClass, &grounded]
        (EntityId otherId, const SolidComponent& solid) {
            if (grounded || otherId == id) return;
            if (solid.groundClass != groundClass) return;

            const WorldAabb ground = worldAabb(ctx.gateway, otherId);
            const float topY = ground.minY;

            if (feetY < topY - snapDownPx || feetY > topY + snapUpPx)
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

    return isGroundedOnSolidAabb(ctx, id, groundClass);
}

} // namespace ArtCade::WorldInternal

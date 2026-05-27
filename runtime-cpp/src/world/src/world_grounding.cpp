#include "world_grounding.h"
#include "world_internal.h"

#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace ArtCade::WorldInternal {

namespace {

constexpr float kMinCoyoteAbovePx   = 4.f;
/** One-way: feet must be near surface top only (not deep inside thick platforms). */
constexpr float kOneWayLandBelowPx = 8.f;

float aabbHalfHeight(const WorldAabb& box) {
    return std::max(1.f, (box.maxY - box.minY) * 0.5f);
}

bool horizontalOverlap(const WorldAabb& a, const WorldAabb& b) {
    return !(a.maxX < b.minX || a.minX > b.maxX);
}

bool aabbOverlap(const WorldAabb& a, const WorldAabb& b) {
    return horizontalOverlap(a, b)
        && a.maxY > b.minY
        && a.minY < b.maxY;
}

bool verticalOverlap(const WorldAabb& a, const WorldAabb& b) {
    return a.maxY > b.minY && a.minY < b.maxY;
}

constexpr float kSurfaceSepEpsilon = 0.5f;

bool playerFullyBelow(const WorldAabb& player, const WorldAabb& ground) {
    return player.minY >= ground.maxY - kSurfaceSepEpsilon;
}

bool playerFullyAbove(const WorldAabb& player, const WorldAabb& ground) {
    return player.maxY <= ground.minY + kSurfaceSepEpsilon;
}

constexpr int kSolidResolvePasses = 4;
constexpr float kMinPen = 0.001f;

bool isOneWaySurface(const SolidComponent& solid) {
    return solid.surfaceKind == "oneWay"
        || solid.surfaceKind == "OneWay"
        || solid.surfaceKind == "one-way"
        || solid.surfaceKind == "One-Way";
}

} // namespace

PlatformerSolidContact probePlatformerSolidContact(
    const GroundingContext& ctx,
    EntityId id,
    const std::string& groundClass,
    float verticalVelocity)
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
            if (isOneWaySurface(solid) && verticalVelocity < 0.f) return;

            const WorldAabb ground = worldAabb(ctx.gateway, otherId);
            if (!horizontalOverlap(player, ground)) return;

            const float topY = ground.minY;
            const float dy   = feetY - topY;
            const float landBelow = isOneWaySurface(solid)
                ? kOneWayLandBelowPx
                : maxBelow;
            if (dy < -coyoteAbove || dy > landBelow) return;
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

void resolvePlatformerSolidSurfaces(Transform& transform,
                                    const GroundingContext& ctx,
                                    EntityId id,
                                    const std::string& groundClass,
                                    const Transform& transformBeforeMove,
                                    float& horizontalVelocity,
                                    float& verticalVelocity)
{
    const Vec2 size = worldColliderSize(ctx.gateway, id);
    const float halfW = size.x * 0.5f;
    const float halfH = size.y * 0.5f;

    for (int pass = 0; pass < kSolidResolvePasses; ++pass) {
        bool resolvedAny = false;
        WorldAabb player = worldAabbAt(ctx.gateway, id, transform);
        const WorldAabb prev =
            worldAabbAt(ctx.gateway, id, transformBeforeMove);

        ctx.gateway.forEachActiveSolid(
            [&](EntityId otherId, const SolidComponent& solid) {
                if (otherId == id) return;
                if (solid.groundClass != groundClass) return;
                if (isOneWaySurface(solid)) return;

                const WorldAabb ground = worldAabb(ctx.gateway, otherId);

                if (playerFullyBelow(player, ground) || playerFullyAbove(player, ground))
                    return;

                const bool vertWithPrev = verticalOverlap(prev, ground);
                const bool vertWithPlayer = verticalOverlap(player, ground);

                if (!aabbOverlap(player, ground)) {
                    if (vertWithPrev || vertWithPlayer) {
                        if (prev.maxX <= ground.maxX && player.maxX > ground.maxX) {
                            transform.position.x = ground.maxX - halfW;
                            if (horizontalVelocity > 0.f) horizontalVelocity = 0.f;
                            transform.velocity.x = horizontalVelocity;
                            player = worldAabbAt(ctx.gateway, id, transform);
                            resolvedAny = true;
                        } else if (prev.minX >= ground.minX
                                   && player.maxX < ground.minX) {
                            transform.position.x = ground.minX + halfW;
                            if (horizontalVelocity < 0.f) horizontalVelocity = 0.f;
                            transform.velocity.x = horizontalVelocity;
                            player = worldAabbAt(ctx.gateway, id, transform);
                            resolvedAny = true;
                        }
                    }
                    if (horizontalOverlap(prev, ground)
                        && prev.maxY <= ground.minY && player.minY > ground.maxY) {
                        transform.position.y = ground.maxY + halfH;
                        if (verticalVelocity < 0.f) verticalVelocity = 0.f;
                        transform.velocity.y = verticalVelocity;
                        player = worldAabbAt(ctx.gateway, id, transform);
                        resolvedAny = true;
                    } else if (horizontalOverlap(prev, ground)
                               && prev.minY >= ground.maxY
                               && player.maxY < ground.minY) {
                        transform.position.y = ground.minY - halfH;
                        if (verticalVelocity > 0.f) verticalVelocity = 0.f;
                        transform.velocity.y = verticalVelocity;
                        player = worldAabbAt(ctx.gateway, id, transform);
                        resolvedAny = true;
                    }
                    return;
                }

                if (!vertWithPlayer) return;

                const float penL = player.maxX - ground.minX;
                const float penR = ground.maxX - player.minX;
                const float penUp = player.maxY - ground.minY;
                const float penDown = ground.maxY - player.minY;

                // Bottom face (ceiling for rising player): block jump through solid underside.
                if (verticalVelocity < 0.f && penDown > kMinPen
                    && penDown <= penUp) {
                    transform.position.y += penDown;
                    verticalVelocity = 0.f;
                    transform.velocity.y = verticalVelocity;
                    player = worldAabbAt(ctx.gateway, id, transform);
                    resolvedAny = true;
                    return;
                }

                // Side faces: only when horizontal penetration is shallower than feet-on-top.
                if (penL > kMinPen && penL < penR && penL < penUp) {
                    transform.position.x -= penL;
                    if (horizontalVelocity > 0.f) horizontalVelocity = 0.f;
                    transform.velocity.x = horizontalVelocity;
                    player = worldAabbAt(ctx.gateway, id, transform);
                    resolvedAny = true;
                    return;
                }
                if (penR > kMinPen && penR <= penL && penR < penUp) {
                    transform.position.x += penR;
                    if (horizontalVelocity < 0.f) horizontalVelocity = 0.f;
                    transform.velocity.x = horizontalVelocity;
                    player = worldAabbAt(ctx.gateway, id, transform);
                    resolvedAny = true;
                }
            });

        if (!resolvedAny) break;
    }
}

bool isGroundedOnSolidAabb(const GroundingContext& ctx,
                           EntityId id,
                           const std::string& groundClass)
{
    Transform transform{};
    float vy = 0.f;
    if (ctx.gateway.getTransform(id, transform))
        vy = transform.velocity.y;
    return probePlatformerSolidContact(ctx, id, groundClass, vy).onGround;
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
        Transform transform{};
        float vy = 0.f;
        if (ctx.gateway.getTransform(id, transform))
            vy = transform.velocity.y;
        return probePlatformerSolidContact(ctx, id, groundClass, vy).onGround;
    }

    if (isGroundedOnSolidAabb(ctx, id, groundClass))
        return true;

    return isGroundedViaPhysicsOverlap(ctx, id, groundClass);
}

} // namespace ArtCade::WorldInternal

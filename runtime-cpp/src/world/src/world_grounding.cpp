#include "world_grounding.h"
#include "world_internal.h"

#include <collision_math.h>

#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"

#include <algorithm>
#include <cmath>
#include <limits>

namespace ArtCade::WorldInternal {

namespace {

constexpr float kMinCoyoteAbovePx   = 4.f;
constexpr float kOneWayLandBelowPx  = 8.f;
constexpr float kGroundRayProbePx   = 8.f;
constexpr int   kSolidResolvePasses = 4;
constexpr float kMinPen             = 0.001f;
constexpr float kSurfaceSepEpsilon  = 0.5f;

struct PlatformerSurface {
    WorldAabb           aabb;
    bool                oneWay = false;
    const std::string*  groundClass = nullptr;
};

float aabbHalfHeight(const WorldAabb& box) {
    return std::max(1.f, (box.maxY - box.minY) * 0.5f);
}

using PhysicsMath::aabbOverlapPlatformer;
using PhysicsMath::horizontalOverlap;
using PhysicsMath::RaycastHit;
using PhysicsMath::raycastSegmentVsAabb;
using PhysicsMath::verticalOverlap;

bool playerFullyBelow(const WorldAabb& player, const WorldAabb& ground) {
    return player.minY >= ground.maxY - kSurfaceSepEpsilon;
}

bool playerFullyAbove(const WorldAabb& player, const WorldAabb& ground) {
    return player.maxY <= ground.minY + kSurfaceSepEpsilon;
}

bool isOneWaySurfaceKind(const std::string& kind) {
    return kind == "oneWay"
        || kind == "OneWay"
        || kind == "one-way"
        || kind == "One-Way";
}

bool isOneWaySurface(const SolidComponent& solid) {
    return isOneWaySurfaceKind(solid.surfaceKind);
}

WorldAabb tileCellAabb(int col, int row, float tileSize) {
    const float x0 = col * tileSize;
    const float y0 = row * tileSize;
    return { x0, y0, x0 + tileSize, y0 + tileSize };
}

bool tryProbeFeetRaycast(const WorldAabb& player,
                         float feetY,
                         float coyoteAbove,
                         float maxBelow,
                         const PlatformerSurface& surface,
                         const std::string& groundClass,
                         float verticalVelocity,
                         float& bestDy,
                         PlatformerSolidContact& best)
{
    if (!surface.groundClass || *surface.groundClass != groundClass)
        return false;
    if (surface.oneWay && verticalVelocity < 0.f)
        return false;

    const float cx = (player.minX + player.maxX) * 0.5f;
    const Vec2 from{ cx, feetY };
    const Vec2 to{ cx, feetY + std::max(kGroundRayProbePx, maxBelow) };
    const RaycastHit hit = raycastSegmentVsAabb(from, to, surface.aabb);
    if (!hit.hit)
        return false;

    const float topY = surface.aabb.minY;
    const float dy   = feetY - topY;
    const float landBelow = surface.oneWay ? kOneWayLandBelowPx : maxBelow;
    if (dy < -coyoteAbove || dy > landBelow)
        return false;
    if (dy >= bestDy)
        return false;

    bestDy           = dy;
    best.onGround    = true;
    best.surfaceTopY = topY;
    return true;
}

bool tryProbeFeetOnSurface(const WorldAabb& player,
                           float feetY,
                           float halfH,
                           float coyoteAbove,
                           float maxBelow,
                           const PlatformerSurface& surface,
                           const std::string& groundClass,
                           float verticalVelocity,
                           float& bestDy,
                           PlatformerSolidContact& best)
{
    if (!surface.groundClass || *surface.groundClass != groundClass)
        return false;
    if (surface.oneWay && verticalVelocity < 0.f)
        return false;
    if (!horizontalOverlap(player, surface.aabb))
        return false;

    const float topY = surface.aabb.minY;
    const float dy   = feetY - topY;
    const float landBelow = surface.oneWay ? kOneWayLandBelowPx : maxBelow;
    if (dy < -coyoteAbove || dy > landBelow)
        return false;
    if (dy >= bestDy)
        return false;

    bestDy           = dy;
    best.onGround    = true;
    best.surfaceTopY = topY;
    return true;
}

void forEachOverlappingTileSurfaces(
    const TilemapData& tm,
    const std::unordered_map<int, TileSurfaceMeta>& tileMeta,
    const WorldAabb& query,
    const std::function<void(const PlatformerSurface&)>& fn)
{
    if (tm.cols <= 0 || tm.rows <= 0 || tm.tileSize <= 0.f)
        return;

    const float ts = tm.tileSize;
    const int c0 = static_cast<int>(std::floor(query.minX / ts));
    const int r0 = static_cast<int>(std::floor(query.minY / ts));
    const int c1 = static_cast<int>(std::floor(query.maxX / ts));
    const int r1 = static_cast<int>(std::floor(query.maxY / ts));

    const int n = static_cast<int>(tm.data.size());
    for (int r = r0; r <= r1; ++r) {
        for (int c = c0; c <= c1; ++c) {
            if (c < 0 || r < 0 || c >= tm.cols || r >= tm.rows)
                continue;
            const int idx = r * tm.cols + c;
            if (idx >= n)
                continue;
            const int id = tm.data[idx];
            if (id <= 0)
                continue;
            auto it = tileMeta.find(id);
            if (it == tileMeta.end() || !it->second.blocks)
                continue;

            PlatformerSurface surface;
            surface.aabb        = tileCellAabb(c, r, ts);
            surface.oneWay        = it->second.oneWay;
            surface.groundClass   = &it->second.groundClass;
            fn(surface);
        }
    }
}

bool tryResolveAgainstSurface(const PlatformerSurface& surface,
                              const std::string& groundClass,
                              WorldAabb& player,
                              const WorldAabb& prev,
                              Transform& transform,
                              EntityId id,
                              const GroundingContext& ctx,
                              float halfW,
                              float halfH,
                              float& horizontalVelocity,
                              float& verticalVelocity,
                              bool& resolvedAny)
{
    if (!surface.groundClass || *surface.groundClass != groundClass)
        return false;
    if (surface.oneWay)
        return false;

    const WorldAabb& ground = surface.aabb;

    if (playerFullyBelow(player, ground) || playerFullyAbove(player, ground))
        return false;

    const bool vertWithPrev     = verticalOverlap(prev, ground);
    const bool vertWithPlayer   = verticalOverlap(player, ground);

    if (!aabbOverlapPlatformer(player, ground)) {
        if (vertWithPrev || vertWithPlayer) {
            if (prev.maxX <= ground.maxX && player.maxX > ground.maxX) {
                transform.position.x = ground.maxX - halfW;
                if (horizontalVelocity > 0.f) horizontalVelocity = 0.f;
                transform.velocity.x = horizontalVelocity;
                player = worldAabbAt(ctx.gateway, id, transform);
                resolvedAny = true;
            } else if (prev.minX >= ground.minX && player.maxX < ground.minX) {
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
        return resolvedAny;
    }

    if (!vertWithPlayer)
        return false;

    const float penL = player.maxX - ground.minX;
    const float penR = ground.maxX - player.minX;
    const float penUp = player.maxY - ground.minY;
    const float penDown = ground.maxY - player.minY;

    if (verticalVelocity < 0.f && penDown > kMinPen && penDown <= penUp) {
        transform.position.y += penDown;
        verticalVelocity = 0.f;
        transform.velocity.y = verticalVelocity;
        player = worldAabbAt(ctx.gateway, id, transform);
        resolvedAny = true;
        return true;
    }

    if (penL > kMinPen && penL < penR && penL < penUp) {
        transform.position.x -= penL;
        if (horizontalVelocity > 0.f) horizontalVelocity = 0.f;
        transform.velocity.x = horizontalVelocity;
        player = worldAabbAt(ctx.gateway, id, transform);
        resolvedAny = true;
        return true;
    }
    if (penR > kMinPen && penR <= penL && penR < penUp) {
        transform.position.x += penR;
        if (horizontalVelocity < 0.f) horizontalVelocity = 0.f;
        transform.velocity.x = horizontalVelocity;
        player = worldAabbAt(ctx.gateway, id, transform);
        resolvedAny = true;
        return true;
    }
    return false;
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
    const float maxBelow = halfH + 2.f;

    float bestDy = std::numeric_limits<float>::max();

    ctx.gateway.forEachActiveSolid(
        [&](EntityId otherId, const SolidComponent& solid) {
            if (otherId == id) return;
            PlatformerSurface surface;
            surface.aabb        = worldAabb(ctx.gateway, otherId);
            surface.oneWay        = isOneWaySurface(solid);
            surface.groundClass   = &solid.groundClass;
            tryProbeFeetRaycast(
                player, feetY, coyoteAbove, maxBelow,
                surface, groundClass, verticalVelocity, bestDy, best);
            tryProbeFeetOnSurface(
                player, feetY, halfH, coyoteAbove, maxBelow,
                surface, groundClass, verticalVelocity, bestDy, best);
        });

    if (ctx.tilemap && ctx.tileMeta) {
        forEachOverlappingTileSurfaces(
            *ctx.tilemap, *ctx.tileMeta, player,
            [&](const PlatformerSurface& surface) {
                tryProbeFeetRaycast(
                    player, feetY, coyoteAbove, maxBelow,
                    surface, groundClass, verticalVelocity, bestDy, best);
                tryProbeFeetOnSurface(
                    player, feetY, halfH, coyoteAbove, maxBelow,
                    surface, groundClass, verticalVelocity, bestDy, best);
            });
    }

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
                PlatformerSurface surface;
                surface.aabb        = worldAabb(ctx.gateway, otherId);
                surface.oneWay        = isOneWaySurface(solid);
                surface.groundClass   = &solid.groundClass;
                tryResolveAgainstSurface(
                    surface, groundClass, player, prev, transform, id, ctx,
                    halfW, halfH, horizontalVelocity, verticalVelocity,
                    resolvedAny);
            });

        if (ctx.tilemap && ctx.tileMeta) {
            forEachOverlappingTileSurfaces(
                *ctx.tilemap, *ctx.tileMeta, player,
                [&](const PlatformerSurface& surface) {
                    tryResolveAgainstSurface(
                        surface, groundClass, player, prev, transform, id, ctx,
                        halfW, halfH, horizontalVelocity, verticalVelocity,
                        resolvedAny);
                });
        }

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

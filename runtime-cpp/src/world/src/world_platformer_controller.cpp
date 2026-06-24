#include "world_platformer_controller.h"
#include "world_grounding.h"
#include "../include/world.h"

#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/collision/include/entity_collision_query.h"

#include <algorithm>
#include <cmath>

namespace ArtCade::WorldInternal {

namespace {

constexpr int kStableGroundedFrames = 2;

PhysicsMath::ShapeInstance ladderShape(const LadderComponent& lad,
                                       const Transform& tf)
{
    PhysicsMath::ShapeInstance s;
    s.position = tf.position;
    if (lad.shape == "Circle") {
        s.shape = ColliderShape::Circle;
        s.size  = { lad.radius, lad.radius };
    } else {
        s.shape = ColliderShape::Rectangle;
        s.size  = { lad.width, lad.height };
    }
    return s;
}

} // namespace

void stepPlatformerController(World& world,
                              EntityId id,
                              const PlatformerControllerComponent& pc,
                              float dt)
{
    auto& rt = world.platformerRt_[id];

    float vy = rt.velocity.y;

    CollisionBodyComponent authoredCollision{};
    const bool usesCollisionBody =
        world.entityGateway_.getCollisionBody(id, authoredCollision);
    const GroundingContext grounding = world.groundingContext();
    world.rebuildCollisionWorld();
    const bool rawGrounded = usesCollisionBody
        ? world.collisionGrounded(id)
        : probePlatformerSolidContact(grounding, id, pc.groundClass, vy).onGround;

    if (rawGrounded) {
        rt.groundedFrames = std::min(rt.groundedFrames + 1, kStableGroundedFrames + 4);
        rt.airborneFrames = 0;
    } else {
        rt.airborneFrames = std::min(rt.airborneFrames + 1, 10000);
        rt.groundedFrames = 0;
    }
    const bool stableGrounded = rt.groundedFrames >= kStableGroundedFrames;

    if (stableGrounded)
        rt.coyoteTimer = pc.coyoteTime;
    else if (rt.airborneFrames > 0)
        rt.coyoteTimer = std::max(0.f, rt.coyoteTimer - dt);

    auto intentIt = world.controlIntents_.find(id);
    World::ControlIntent* intent = intentIt != world.controlIntents_.end()
        ? &intentIt->second
        : nullptr;

    const bool jumpPending = intent && intent->jumpRequested;
    if (intent)
        intent->jumpRequested = false;
    const bool jumpEdge = jumpPending && !rt.jumpPendingPrev;
    rt.jumpPendingPrev = jumpPending;
    if (jumpEdge)
        rt.jumpBufferTimer = pc.jumpBuffer;
    else
        rt.jumpBufferTimer = std::max(0.f, rt.jumpBufferTimer - dt);

    float vx = 0.f;
    float inputX = 0.f;
    float inputY = 0.f;

    if (intent && intent->hasMovement) {
        inputX = std::clamp(intent->movement.x, -1.f, 1.f);
        inputY = std::clamp(intent->movement.y, -1.f, 1.f);
        vx = inputX * pc.maxSpeed;
    }

    // Resolve the climb zone. A dedicated LadderComponent (explicit bbox + axis)
    // takes precedence; we fall back to the v1 className overlap only when no
    // ladder component matches, so existing projects keep working.
    // Resolve the climb zone. forEachActiveLadder is O(ladders) (EnTT view) and
    // firstOverlappingInClass is indexed by class, so both probes are free when
    // the scene has no climbable geometry — no per-frame gate needed.
    bool  ladderHorizontal = false;
    float climbSpeed       = pc.climbSpeed;
    bool onLadder = false;
    if (usesCollisionBody) {
        CollisionWorld::Filter ladderFilter;
        ladderFilter.role = "interaction";
        ladderFilter.response = "sensor";
        onLadder = world.firstCollisionTouching(id, ladderFilter) != INVALID_ENTITY;
    } else {
        const auto selfShape =
            CollisionQuery::shapeFromEntity(world.entityGateway_, id);
        world.entityGateway_.forEachActiveLadder(
            [&](EntityId lid, const LadderComponent& lad) {
                if (onLadder || lid == id) return;
                Transform lt{};
                if (!world.entityGateway_.getTransform(lid, lt)) return;
                if (!PhysicsMath::shapesOverlap(selfShape, ladderShape(lad, lt)))
                    return;
                onLadder         = true;
                ladderHorizontal = (lad.axis == "horizontal");
                climbSpeed       = (lad.climbSpeed > 0.f) ? lad.climbSpeed : pc.climbSpeed;
            });
        if (!onLadder && !pc.climbClass.empty()
            && CollisionQuery::firstOverlappingInClass(
                   world.entityGateway_, id, pc.climbClass) != INVALID_ENTITY) {
            onLadder = true;
        }
    }

    // Engage on input along the ladder's axis (vertical by default); this keeps
    // a body walking past a vertical ladder from auto-grabbing it.
    const float climbAxis = ladderHorizontal ? inputX : inputY;
    if (!onLadder)
        rt.climbing = false;
    else if (std::abs(climbAxis) > 0.f)
        rt.climbing = true;

    const bool canJump = rawGrounded || rt.coyoteTimer > 0.f;
    if (rt.jumpBufferTimer > 0.f && (canJump || rt.climbing)) {
        vy = -pc.jumpForce;
        rt.climbing        = false;   // jumping detaches from the ladder
        rt.coyoteTimer     = 0.f;
        rt.jumpBufferTimer = 0.f;
        rt.airborneFrames  = 1;
        rt.groundedFrames  = 0;
    } else if (rt.climbing) {
        // Vertical ladder: drive vy by input. Horizontal rope: suspend gravity
        // and let the normal vx (above) carry traversal.
        vy = ladderHorizontal ? 0.f : (climbAxis * climbSpeed);
    } else if (!stableGrounded) {
        vy += pc.customGravity * dt;
    } else if (vy > 0.f) {
        vy = 0.f;
    }

    rt.velocity = { vx, vy };
    Transform transform{};
    if (!world.entityGateway_.getTransform(id, transform)) return;
    const Transform beforeMove = transform;
    transform.velocity = rt.velocity;
    transform.position.x += rt.velocity.x * dt;
    transform.position.y += rt.velocity.y * dt;

    if (usesCollisionBody) {
        world.resolveKinematicCollisionBody(id, transform, beforeMove, vx, vy);
    } else {
        resolvePlatformerSolidSurfaces(
            transform, grounding, id, pc.groundClass, beforeMove, vx, vy);
    }
    rt.velocity.x = vx;
    rt.velocity.y = vy;
    transform.velocity = rt.velocity;

    // Floor snap: after integration, land on the nearest Solid surface below
    // the feet (native kinematic platformer — no penetration tolerance hack).
    // Skipped while climbing so the body is not yanked to ground mid-ladder.
    if (vy >= 0.f && !rt.climbing) {
        bool groundedAfter = false;
        if (usesCollisionBody) {
            world.entityGateway_.setTransform(id, transform);
            world.rebuildCollisionWorld();
            groundedAfter = world.collisionGrounded(id);
        } else {
            const PlatformerSolidContact groundAfter =
                probePlatformerSolidContact(grounding, id, pc.groundClass, vy);
            groundedAfter = groundAfter.onGround;
            if (groundedAfter)
                snapTransformFeetToSurface(transform, grounding, id, groundAfter.surfaceTopY);
        }
        if (groundedAfter) {
            vy = 0.f;
            rt.velocity.y = 0.f;
            transform.velocity.y = 0.f;
        }
    }

    world.entityGateway_.setTransform(id, transform);

    const uint32_t handle = world.entityGateway_.physicsHandle(id);
    if (handle != 0) {
        world.physics_.setPosition(handle, transform.position);
        world.physics_.setLinearVelocity(handle, transform.velocity);
    }
}

} // namespace ArtCade::WorldInternal

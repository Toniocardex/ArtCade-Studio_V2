#include "world_platformer_controller.h"
#include "world_grounding.h"
#include "../include/world.h"

#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"

#include <algorithm>

namespace ArtCade::WorldInternal {

namespace {

constexpr int kStableGroundedFrames = 2;

} // namespace

void stepPlatformerController(World& world,
                              EntityId id,
                              const PlatformerControllerComponent& pc,
                              float dt)
{
    auto& rt = world.platformerRt_[id];

    const GroundingContext grounding{
        world.entityGateway_,
        world.physics_,
    };

    float vy = rt.velocity.y;

    const PlatformerSolidContact groundBefore =
        probePlatformerSolidContact(grounding, id, pc.groundClass, vy);
    const bool rawGrounded = groundBefore.onGround;

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

    if (intent && intent->hasMovement) {
        const float axis = std::clamp(intent->movement.x, -1.f, 1.f);
        vx = axis * pc.maxSpeed;
    }

    const bool canJump = rawGrounded || rt.coyoteTimer > 0.f;
    if (rt.jumpBufferTimer > 0.f && canJump) {
        vy = -pc.jumpForce;
        rt.coyoteTimer     = 0.f;
        rt.jumpBufferTimer = 0.f;
        rt.airborneFrames  = 1;
        rt.groundedFrames  = 0;
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

    resolvePlatformerSolidVolume(
        transform, grounding, id, pc.groundClass, beforeMove, vx, vy);
    rt.velocity.x = vx;
    rt.velocity.y = vy;
    transform.velocity = rt.velocity;

    // Floor snap: after integration, land on the nearest Solid surface below
    // the feet (native kinematic platformer — no penetration tolerance hack).
    if (vy >= 0.f) {
        const PlatformerSolidContact groundAfter =
            probePlatformerSolidContact(grounding, id, pc.groundClass, vy);
        if (groundAfter.onGround) {
            snapTransformFeetToSurface(transform, grounding, id, groundAfter.surfaceTopY);
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

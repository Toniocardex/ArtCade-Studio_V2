#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <vector>

namespace ArtCade::Modules {

/**
 * Physics — public interface for Rapier2D integration.
 *
 * Other modules see only this header.
 * Rapier C bindings, body pool, and query cache stay in src/ (private).
 */
class Physics final : public IModule {
public:
    Physics() = default;

    bool init() override;
    void shutdown() override;

    void setGravity(const Vec2& gravity);

    // Fixed-timestep simulation step
    void step(float dt, uint32_t substeps = 2);

    // Body lifecycle
    uint32_t createBody(EntityId entityId, const PhysicsComponent& comp);
    void     destroyBody(uint32_t handle);

    // Velocity / position setters
    void setLinearVelocity(uint32_t handle, const Vec2& vel);
    Vec2 getLinearVelocity(uint32_t handle) const;
    void setPosition(uint32_t handle, const Vec2& pos);
    Vec2 getPosition(uint32_t handle) const;

    // Collision queries
    bool areOverlapping(uint32_t handle1, uint32_t handle2) const;

    struct RaycastResult {
        bool     hit      = false;
        uint32_t handle   = 0;
        Vec2     point;
        float    distance = 0.f;
    };
    RaycastResult raycast(const Vec2& from, const Vec2& to) const;

    std::vector<uint32_t> getContactingBodies(const Vec2& point) const;

private:
    void*    world_          = nullptr;   // Opaque Rapier world
    uint32_t nextHandle_     = 1;

    std::unordered_map<uint32_t, EntityId> handleToEntity_;
};

} // namespace ArtCade::Modules

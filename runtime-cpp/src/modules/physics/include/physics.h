#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <memory>
#include <vector>

namespace ArtCade::Modules {

/**
 * Physics — wraps Box2D 2.4 (Fase 12).
 *
 * Tutte le strutture Box2D restano in src/physics.cpp via Pimpl.
 * I moduli esterni vedono solo Vec2 / PhysicsComponent / handle uint32_t.
 *
 * Coordinate: screen-space Y-down.
 * Gravità di default: {0, +10} → i corpi cadono verso Y crescente.
 */
class Physics final : public IModule {
public:
    Physics();
    ~Physics();          // definito in .cpp dove Impl è completo

    bool init()     override;
    void shutdown() override;

    // ---- World config -------------------------------------------------------
    void setGravity(const Vec2& gravity);

    // Fixed-timestep simulation step (substeps interni per stabilità)
    void step(float dt, uint32_t substeps = 2);

    // ---- Body lifecycle -----------------------------------------------------
    uint32_t createBody(EntityId entityId, const PhysicsComponent& comp);
    void     destroyBody(uint32_t handle);
    /** Second fixture on an existing body (sensor / trigger volume). */
    bool     addSensorFixture(uint32_t bodyHandle, const SensorComponent& sensor);
    void     setBodyActive(uint32_t handle, bool active);

    // ---- Velocity / position ------------------------------------------------
    void setLinearVelocity(uint32_t handle, const Vec2& vel);
    Vec2 getLinearVelocity(uint32_t handle) const;
    void setPosition(uint32_t handle, const Vec2& pos);
    Vec2 getPosition(uint32_t handle) const;

    // ---- Collision queries --------------------------------------------------
    bool areOverlapping(uint32_t handle1, uint32_t handle2) const;

    struct RaycastResult {
        bool     hit      = false;
        uint32_t handle   = 0;
        EntityId entityId = 0;
        Vec2     point;
        float    distance = 0.f;
    };
    RaycastResult         raycast(const Vec2& from, const Vec2& to) const;
    std::vector<uint32_t> getContactingBodies(const Vec2& point)    const;

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace ArtCade::Modules

#pragma once

#include "types.h"
#include <glm/glm.hpp>
#include <vector>

namespace ArtCade {

/**
 * Physics: Rapier2D physics engine wrapper
 *
 * Manages rigid bodies, collisions, and physics simulation.
 * Deterministic, fixed timestep.
 */
class Physics {
public:
    Physics();
    ~Physics();

    void init(const glm::vec2& gravity = {0.0f, -9.81f});
    void shutdown();

    // Step the physics simulation
    void step(float deltaTime, uint32_t substeps = 1);

    // Body management
    uint32_t createBody(EntityId entityId, const PhysicsComponent& physicsComponent);
    void destroyBody(uint32_t bodyHandle);

    void setLinearVelocity(uint32_t bodyHandle, const glm::vec2& velocity);
    glm::vec2 getLinearVelocity(uint32_t bodyHandle) const;

    void setPosition(uint32_t bodyHandle, const glm::vec2& position);
    glm::vec2 getPosition(uint32_t bodyHandle) const;

    // Collision queries
    bool areOverlapping(uint32_t handle1, uint32_t handle2) const;

    struct RaycastHit {
        bool hit = false;
        uint32_t bodyHandle = 0;
        glm::vec2 position = {0.0f, 0.0f};
        float distance = 0.0f;
    };
    RaycastHit raycast(const glm::vec2& from, const glm::vec2& to) const;

    // Get all entities touching a specific point
    std::vector<uint32_t> getContactingBodies(const glm::vec2& point) const;

private:
    void* rapierWorld_ = nullptr;   // Opaque Rapier2D world
    std::unordered_map<uint32_t, EntityId> bodyHandleToEntity_;
    uint32_t nextBodyHandle_ = 1;
};

} // namespace ArtCade

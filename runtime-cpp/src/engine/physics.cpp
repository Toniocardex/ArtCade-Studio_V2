#include "physics.h"
#include "../utils/logger.h"

namespace ArtCade {

Physics::Physics() = default;

Physics::~Physics() {
    shutdown();
}

void Physics::init(const glm::vec2& gravity) {
    // TODO: Initialize Rapier2D world
    // - Create RapierWorld with gravity
    // - Setup broad-phase, narrow-phase, etc.
    Logger::log("Physics initialized");
}

void Physics::shutdown() {
    // TODO: Cleanup Rapier2D world
    Logger::log("Physics shutdown");
}

void Physics::step(float deltaTime, uint32_t substeps) {
    // TODO: Step Rapier2D physics
    // rapierWorld->step(deltaTime / substeps, substeps)
}

uint32_t Physics::createBody(EntityId entityId, const PhysicsComponent& physicsComponent) {
    // TODO: Create Rapier2D body from PhysicsComponent
    uint32_t handle = nextBodyHandle_++;
    bodyHandleToEntity_[handle] = entityId;
    return handle;
}

void Physics::destroyBody(uint32_t bodyHandle) {
    // TODO: Remove Rapier2D body
    bodyHandleToEntity_.erase(bodyHandle);
}

void Physics::setLinearVelocity(uint32_t bodyHandle, const glm::vec2& velocity) {
    // TODO: Set body velocity in Rapier2D
}

glm::vec2 Physics::getLinearVelocity(uint32_t bodyHandle) const {
    // TODO: Get body velocity from Rapier2D
    return {0.0f, 0.0f};
}

void Physics::setPosition(uint32_t bodyHandle, const glm::vec2& position) {
    // TODO: Set body position in Rapier2D
}

glm::vec2 Physics::getPosition(uint32_t bodyHandle) const {
    // TODO: Get body position from Rapier2D
    return {0.0f, 0.0f};
}

bool Physics::areOverlapping(uint32_t handle1, uint32_t handle2) const {
    // TODO: Query Rapier2D collision
    return false;
}

Physics::RaycastHit Physics::raycast(const glm::vec2& from, const glm::vec2& to) const {
    // TODO: Raycast in Rapier2D
    return RaycastHit{};
}

std::vector<uint32_t> Physics::getContactingBodies(const glm::vec2& point) const {
    // TODO: Point query in Rapier2D
    return {};
}

} // namespace ArtCade

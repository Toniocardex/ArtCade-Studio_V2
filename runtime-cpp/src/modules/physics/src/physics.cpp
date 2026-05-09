// physics.cpp — stub (Phase 12 implements Rapier2D integration)
#include "../include/physics.h"
#include <unordered_map>

namespace ArtCade::Modules {

bool Physics::init()     { return true; }
void Physics::shutdown() {}

void Physics::setGravity(const Vec2&)                         {}
void Physics::step(float, uint32_t)                           {}

uint32_t Physics::createBody(EntityId, const PhysicsComponent&) { return 0; }
void     Physics::destroyBody(uint32_t)                         {}

void Physics::setLinearVelocity(uint32_t, const Vec2&) {}
Vec2 Physics::getLinearVelocity(uint32_t)        const { return {}; }
void Physics::setPosition(uint32_t, const Vec2&)       {}
Vec2 Physics::getPosition(uint32_t)              const { return {}; }

bool Physics::areOverlapping(uint32_t, uint32_t) const { return false; }

Physics::RaycastResult Physics::raycast(const Vec2&, const Vec2&) const {
    return {};
}

std::vector<uint32_t> Physics::getContactingBodies(const Vec2&) const {
    return {};
}

} // namespace ArtCade::Modules

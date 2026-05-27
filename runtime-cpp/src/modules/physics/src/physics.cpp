// physics.cpp — Custom iterative physics (Facade: physics.h unchanged).
#include "../include/physics.h"
#include "collision_math.h"

#define RAYMATH_STATIC_INLINE
#include "raymath.h"

#include <unordered_map>
#include <vector>
#include <cmath>

namespace ArtCade::Modules {

namespace {

using namespace PhysicsMath;

inline Vector2 toRay(const Vec2& v) { return { v.x, v.y }; }
inline Vec2    fromRay(Vector2 v)  { return { v.x, v.y }; }

} // namespace

struct Physics::Impl {
    Vec2 worldGravity{ 0.f, 10.f };

    struct BodyEntry {
        EntityId        entityId   = INVALID_ENTITY;
        BodyType        bodyType   = BodyType::Dynamic;
        Collider        collider;
        Vec2            position;
        Vec2            velocity;
        float           gravityScale = 1.f;
        bool            active       = true;
        bool            hasSensor    = false;
        SensorComponent sensor;
    };

    std::unordered_map<uint32_t, BodyEntry> bodies;
    uint32_t nextHandle = 1;

    static ShapeInstance mainShape(const BodyEntry& body) {
        ShapeInstance s;
        s.shape    = body.collider.shape;
        s.position = body.position;
        s.offset   = body.collider.offset;
        s.size     = body.collider.size;
        return s;
    }

    static ShapeInstance sensorShape(const BodyEntry& body) {
        ShapeInstance s;
        s.position = body.position;
        if (body.sensor.shape == "Rectangle") {
            s.shape = ColliderShape::Rectangle;
            s.size  = { body.sensor.width, body.sensor.height };
        } else {
            s.shape = ColliderShape::Circle;
            s.size  = { body.sensor.radius, body.sensor.radius };
        }
        return s;
    }

    static bool shapesOverlapAny(const BodyEntry& a, const BodyEntry& b) {
        if (shapesOverlap(mainShape(a), mainShape(b)))
            return true;
        if (a.hasSensor && shapesOverlap(sensorShape(a), mainShape(b)))
            return true;
        if (b.hasSensor && shapesOverlap(mainShape(a), sensorShape(b)))
            return true;
        if (a.hasSensor && b.hasSensor && shapesOverlap(sensorShape(a), sensorShape(b)))
            return true;
        return false;
    }

    static bool shouldResolvePair(const BodyEntry& a, const BodyEntry& b) {
        if (a.collider.isSensor || b.collider.isSensor)
            return false;
        return a.bodyType == BodyType::Dynamic || b.bodyType == BodyType::Dynamic;
    }

    static void resolvePair(BodyEntry& a, BodyEntry& b) {
        Aabb boxA = shapeWorldAabb(mainShape(a));
        Aabb boxB = shapeWorldAabb(mainShape(b));
        if (!aabbOverlap(boxA, boxB))
            return;

        Vec2 correction{};
        if (!resolveAabbSeparation(boxA, boxB, correction))
            return;

        const bool aDyn = a.bodyType == BodyType::Dynamic;
        const bool bDyn = b.bodyType == BodyType::Dynamic;

        if (aDyn && bDyn) {
            const Vec2 half = { correction.x * 0.5f, correction.y * 0.5f };
            a.position.x -= half.x;
            a.position.y -= half.y;
            b.position.x += half.x;
            b.position.y += half.y;
        } else if (aDyn) {
            a.position.x -= correction.x;
            a.position.y -= correction.y;
        } else if (bDyn) {
            b.position.x += correction.x;
            b.position.y += correction.y;
        }
    }

    void resolveCollisionsLinear() {
        std::vector<uint32_t> handles;
        handles.reserve(bodies.size());
        for (const auto& [handle, body] : bodies) {
            if (body.active)
                handles.push_back(handle);
        }

        for (size_t i = 0; i < handles.size(); ++i) {
            for (size_t j = i + 1; j < handles.size(); ++j) {
                auto itA = bodies.find(handles[i]);
                auto itB = bodies.find(handles[j]);
                if (itA == bodies.end() || itB == bodies.end())
                    continue;
                if (!shouldResolvePair(itA->second, itB->second))
                    continue;
                resolvePair(itA->second, itB->second);
            }
        }
    }
};

// ============================================================================
// Lifecycle
// ============================================================================

Physics::Physics()  : impl_(std::make_unique<Impl>()) {}
Physics::~Physics() = default;

bool Physics::init()     { return true; }

void Physics::shutdown() {
    destroyAllBodies();
}

void Physics::destroyAllBodies() {
    impl_->bodies.clear();
    impl_->nextHandle = 1;
}

// ============================================================================
// World config
// ============================================================================

void Physics::setGravity(const Vec2& gravity) {
    impl_->worldGravity = gravity;
}

void Physics::step(float dt, uint32_t substeps) {
    if (impl_->bodies.empty())
        return;

    const uint32_t steps = substeps > 0 ? substeps : 1;
    const float    subDt = dt / static_cast<float>(steps);

    for (uint32_t s = 0; s < steps; ++s) {
        for (auto& [handle, body] : impl_->bodies) {
            (void)handle;
            if (!body.active || body.bodyType != BodyType::Dynamic)
                continue;

            Vector2 vel = toRay(body.velocity);
            const Vector2 gravityStep = Vector2Scale(
                toRay(impl_->worldGravity),
                body.gravityScale * subDt);
            vel = Vector2Add(vel, gravityStep);
            body.velocity = fromRay(vel);

            body.position.x += body.velocity.x * subDt;
            body.position.y += body.velocity.y * subDt;
        }

        impl_->resolveCollisionsLinear();
    }
}

bool Physics::hasActiveBodies() const {
    return !impl_->bodies.empty();
}

// ============================================================================
// Body lifecycle
// ============================================================================

uint32_t Physics::createBody(EntityId entityId, const PhysicsComponent& comp) {
    Impl::BodyEntry entry;
    entry.entityId     = entityId;
    entry.bodyType     = comp.bodyType;
    entry.collider     = comp.collider;
    entry.position     = {};
    entry.velocity     = {};
    entry.gravityScale = 1.f;
    entry.active       = true;

    const uint32_t handle = impl_->nextHandle++;
    impl_->bodies[handle] = entry;
    return handle;
}

void Physics::destroyBody(uint32_t handle) {
    impl_->bodies.erase(handle);
}

void Physics::clearSensorFixture(uint32_t bodyHandle) {
    auto it = impl_->bodies.find(bodyHandle);
    if (it == impl_->bodies.end()) return;
    it->second.hasSensor = false;
}

bool Physics::setSensorFixture(uint32_t bodyHandle, const SensorComponent& sensor) {
    auto it = impl_->bodies.find(bodyHandle);
    if (it == impl_->bodies.end()) return false;
    it->second.sensor    = sensor;
    it->second.hasSensor = true;
    return true;
}

bool Physics::addSensorFixture(uint32_t bodyHandle, const SensorComponent& sensor) {
    return setSensorFixture(bodyHandle, sensor);
}

void Physics::setBodyActive(uint32_t handle, bool active) {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return;
    it->second.active = active;
}

// ============================================================================
// Velocity / Position
// ============================================================================

void Physics::setLinearVelocity(uint32_t handle, const Vec2& vel) {
    auto it = impl_->bodies.find(handle);
    if (it != impl_->bodies.end())
        it->second.velocity = vel;
}

void Physics::setGravityScale(uint32_t handle, float scale) {
    auto it = impl_->bodies.find(handle);
    if (it != impl_->bodies.end())
        it->second.gravityScale = scale;
}

Vec2 Physics::getLinearVelocity(uint32_t handle) const {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return {};
    return it->second.velocity;
}

void Physics::setPosition(uint32_t handle, const Vec2& pos) {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return;
    it->second.position = pos;
}

Vec2 Physics::getPosition(uint32_t handle) const {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return {};
    return it->second.position;
}

// ============================================================================
// Collision queries
// ============================================================================

bool Physics::areOverlapping(uint32_t h1, uint32_t h2) const {
    auto it1 = impl_->bodies.find(h1);
    auto it2 = impl_->bodies.find(h2);
    if (it1 == impl_->bodies.end() || it2 == impl_->bodies.end()) return false;
    if (!it1->second.active || !it2->second.active) return false;
    return Impl::shapesOverlapAny(it1->second, it2->second);
}

Physics::RaycastResult Physics::raycast(const Vec2& from, const Vec2& to) const {
    RaycastResult result;
    RaycastHit    best;

    for (const auto& [handle, body] : impl_->bodies) {
        if (!body.active || body.collider.isSensor)
            continue;

        const RaycastHit hit = raycastSegmentVsShape(from, to, Impl::mainShape(body));
        if (!hit.hit || hit.fraction >= best.fraction)
            continue;

        best = hit;
        result.hit      = true;
        result.handle   = handle;
        result.entityId = body.entityId;
        result.point    = hit.point;
    }

    if (!result.hit)
        return result;

    const float dx = result.point.x - from.x;
    const float dy = result.point.y - from.y;
    result.distance = std::sqrt(dx * dx + dy * dy);
    return result;
}

std::vector<uint32_t> Physics::getContactingBodies(const Vec2& point) const {
    std::vector<uint32_t> result;
    for (const auto& [handle, body] : impl_->bodies) {
        if (!body.active) continue;
        if (pointInsideShape(point, Impl::mainShape(body))
            || (body.hasSensor && pointInsideShape(point, Impl::sensorShape(body))))
            result.push_back(handle);
    }
    return result;
}

} // namespace ArtCade::Modules

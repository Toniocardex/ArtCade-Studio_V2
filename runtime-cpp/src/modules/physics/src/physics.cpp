// physics.cpp — Fase 12: Box2D 2.4 backend
#include "../include/physics.h"
#include <box2d/box2d.h>
#include <unordered_map>
#include <vector>
#include <cmath>

namespace ArtCade::Modules {

// ============================================================================
// Helpers (coordinate conversion)
// ============================================================================

static inline b2Vec2 toB2(const Vec2& v)     { return { v.x, v.y }; }
static inline Vec2   toVec2(const b2Vec2& v) { return { v.x, v.y }; }

// ============================================================================
// Raycast callback (closest hit)
// ============================================================================

class ClosestRayCastCB : public b2RayCastCallback {
public:
    bool       hit      = false;
    float      fraction = 1.f;
    b2Vec2     point;
    b2Fixture* fixture  = nullptr;

    float ReportFixture(b2Fixture* f, const b2Vec2& p,
                        const b2Vec2& /*normal*/, float frac) override {
        if (frac < fraction) {
            hit      = true;
            point    = p;
            fraction = frac;
            fixture  = f;
        }
        return frac;  // mantieni la distanza minima corrente come limite
    }
};

// ============================================================================
// AABB query callback
// ============================================================================

class PointQueryCB : public b2QueryCallback {
public:
    std::vector<b2Body*> found;
    bool ReportFixture(b2Fixture* f) override {
        found.push_back(f->GetBody());
        return true;  // continua
    }
};

// ============================================================================
// Private implementation
// ============================================================================

struct Physics::Impl {
    // Gravità Y-down (screen space): i corpi cadono verso Y positivo
    b2World world{ b2Vec2{ 0.f, 10.f } };

    struct BodyEntry {
        b2Body*    body;
        EntityId   entityId;
        b2Fixture* sensorFixture = nullptr;
    };

    std::unordered_map<uint32_t, BodyEntry> bodies;
    std::unordered_map<b2Body*, uint32_t>   bodyToHandle;
    uint32_t nextHandle = 1;
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
    for (auto& [handle, entry] : impl_->bodies)
        impl_->world.DestroyBody(entry.body);
    impl_->bodies.clear();
    impl_->bodyToHandle.clear();
    impl_->nextHandle = 1;
}

// ============================================================================
// World config
// ============================================================================

void Physics::setGravity(const Vec2& gravity) {
    impl_->world.SetGravity(toB2(gravity));
}

void Physics::step(float dt, uint32_t substeps) {
    constexpr int kVelocityIterations = 6;
    constexpr int kPositionIterations = 2;
    float subDt = dt / static_cast<float>(substeps > 0 ? substeps : 1);
    for (uint32_t i = 0; i < substeps; ++i)
        impl_->world.Step(subDt, kVelocityIterations, kPositionIterations);
}

bool Physics::hasActiveBodies() const {
    return !impl_->bodies.empty();
}

// ============================================================================
// Body lifecycle
// ============================================================================

uint32_t Physics::createBody(EntityId entityId, const PhysicsComponent& comp) {
    // --- Body definition ---
    b2BodyDef def;
    def.linearDamping  = 0.f;
    def.angularDamping = 0.f;

    switch (comp.bodyType) {
        case BodyType::Dynamic:   def.type = b2_dynamicBody;   break;
        case BodyType::Static:    def.type = b2_staticBody;    break;
        case BodyType::Kinematic: def.type = b2_kinematicBody; break;
    }

    b2Body* body = impl_->world.CreateBody(&def);

    // --- Fixture ---
    const Collider& col = comp.collider;

    b2FixtureDef fixDef;
    fixDef.density  = col.density;
    fixDef.friction = col.friction;
    fixDef.isSensor = col.isSensor;

    b2PolygonShape polyShape;
    b2CircleShape  circleShape;

    if (col.shape == ColliderShape::Rectangle) {
        // Box2D SetAsBox prende half-extents + offset + angolo
        polyShape.SetAsBox(col.size.x * 0.5f, col.size.y * 0.5f,
                           toB2(col.offset), 0.f);
        fixDef.shape = &polyShape;
    } else {
        circleShape.m_p      = toB2(col.offset);
        circleShape.m_radius = col.size.x;   // raggio in .x (convenzione ArtCade)
        fixDef.shape = &circleShape;
    }

    body->CreateFixture(&fixDef);

    uint32_t handle = impl_->nextHandle++;
    impl_->bodies[handle]       = { body, entityId };
    impl_->bodyToHandle[body]   = handle;
    return handle;
}

void Physics::destroyBody(uint32_t handle) {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return;
    impl_->bodyToHandle.erase(it->second.body);
    impl_->world.DestroyBody(it->second.body);
    impl_->bodies.erase(it);
}

void Physics::clearSensorFixture(uint32_t bodyHandle) {
    auto it = impl_->bodies.find(bodyHandle);
    if (it == impl_->bodies.end()) return;
    if (it->second.sensorFixture) {
        it->second.body->DestroyFixture(it->second.sensorFixture);
        it->second.sensorFixture = nullptr;
    }
}

bool Physics::setSensorFixture(uint32_t bodyHandle, const SensorComponent& sensor) {
    auto it = impl_->bodies.find(bodyHandle);
    if (it == impl_->bodies.end()) return false;
    clearSensorFixture(bodyHandle);

    b2Body* body = it->second.body;
    b2FixtureDef fixDef;
    fixDef.isSensor = true;
    fixDef.density  = 0.f;
    fixDef.friction = 0.f;

    b2PolygonShape polyShape;
    b2CircleShape  circleShape;

    if (sensor.shape == "Rectangle") {
        polyShape.SetAsBox(sensor.width * 0.5f, sensor.height * 0.5f);
        fixDef.shape = &polyShape;
    } else {
        circleShape.m_radius = sensor.radius;
        fixDef.shape = &circleShape;
    }

    it->second.sensorFixture = body->CreateFixture(&fixDef);
    return it->second.sensorFixture != nullptr;
}

bool Physics::addSensorFixture(uint32_t bodyHandle, const SensorComponent& sensor) {
    return setSensorFixture(bodyHandle, sensor);
}

void Physics::setBodyActive(uint32_t handle, bool active) {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return;
    it->second.body->SetEnabled(active);
}

// ============================================================================
// Velocity / Position
// ============================================================================

void Physics::setLinearVelocity(uint32_t handle, const Vec2& vel) {
    auto it = impl_->bodies.find(handle);
    if (it != impl_->bodies.end())
        it->second.body->SetLinearVelocity(toB2(vel));
}

Vec2 Physics::getLinearVelocity(uint32_t handle) const {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return {};
    return toVec2(it->second.body->GetLinearVelocity());
}

void Physics::setPosition(uint32_t handle, const Vec2& pos) {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return;
    // Preserva l'angolo corrente
    it->second.body->SetTransform(toB2(pos), it->second.body->GetAngle());
    it->second.body->SetAwake(true);
}

Vec2 Physics::getPosition(uint32_t handle) const {
    auto it = impl_->bodies.find(handle);
    if (it == impl_->bodies.end()) return {};
    return toVec2(it->second.body->GetPosition());
}

// ============================================================================
// Collision queries
// ============================================================================

bool Physics::areOverlapping(uint32_t h1, uint32_t h2) const {
    auto it1 = impl_->bodies.find(h1);
    auto it2 = impl_->bodies.find(h2);
    if (it1 == impl_->bodies.end() || it2 == impl_->bodies.end()) return false;

    b2Body* b1 = it1->second.body;
    b2Body* b2 = it2->second.body;

    b2Fixture* f1 = b1->GetFixtureList();
    b2Fixture* f2 = b2->GetFixtureList();
    if (!f1 || !f2) return false;

    // Test shape overlap con trasformazioni correnti
    return b2TestOverlap(f1->GetShape(), 0, f2->GetShape(), 0,
                         b1->GetTransform(), b2->GetTransform());
}

Physics::RaycastResult Physics::raycast(const Vec2& from, const Vec2& to) const {
    ClosestRayCastCB cb;
    impl_->world.RayCast(&cb, toB2(from), toB2(to));

    RaycastResult result;
    if (!cb.hit) return result;

    result.hit   = true;
    result.point = toVec2(cb.point);

    float dx = result.point.x - from.x;
    float dy = result.point.y - from.y;
    result.distance = std::sqrt(dx * dx + dy * dy);

    b2Body* hitBody = cb.fixture->GetBody();
    auto it = impl_->bodyToHandle.find(hitBody);
    if (it != impl_->bodyToHandle.end()) {
        result.handle   = it->second;
        auto eit = impl_->bodies.find(result.handle);
        if (eit != impl_->bodies.end())
            result.entityId = eit->second.entityId;
    }

    return result;
}

std::vector<uint32_t> Physics::getContactingBodies(const Vec2& point) const {
    constexpr float kEps = 0.5f;
    b2AABB aabb;
    aabb.lowerBound = { point.x - kEps, point.y - kEps };
    aabb.upperBound = { point.x + kEps, point.y + kEps };

    PointQueryCB cb;
    impl_->world.QueryAABB(&cb, aabb);

    std::vector<uint32_t> result;
    result.reserve(cb.found.size());
    for (b2Body* body : cb.found) {
        auto it = impl_->bodyToHandle.find(body);
        if (it != impl_->bodyToHandle.end())
            result.push_back(it->second);
    }
    return result;
}

} // namespace ArtCade::Modules

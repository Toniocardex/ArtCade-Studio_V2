// physics-body-rules-test.cpp — stateless policy for Box2D body setup.

#include "modules/runtime-entity-gateway/include/physics-body-rules.h"

#include <cmath>
#include <cstdlib>
#include <iostream>

using ArtCade::BodyType;
using ArtCade::Modules::EntityPhysicsFlags;
using ArtCade::Modules::PhysicsBodyRules;
using ArtCade::Modules::applyPhysicsBodyRules;
using ArtCade::Modules::resolvePhysicsBodyRules;
using ArtCade::PhysicsComponent;
using ArtCade::SensorComponent;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

int main() {
    PhysicsComponent comp{};

    {
        EntityPhysicsFlags flags{};
        flags.hasExplicitCollider = true;
        flags.hasPlatformer = true;
        const PhysicsBodyRules rules = resolvePhysicsBodyRules(comp, flags);
        CHECK(rules.bodyType == BodyType::Kinematic);
        CHECK(std::abs(rules.gravityScale) < 0.001f);
    }

    {
        EntityPhysicsFlags flags{};
        flags.hasExplicitCollider = true;
        flags.hasTopDown = true;
        const PhysicsBodyRules rules = resolvePhysicsBodyRules(comp, flags);
        CHECK(rules.bodyType == BodyType::Dynamic);
        CHECK(std::abs(rules.gravityScale) < 0.001f);
    }

    {
        EntityPhysicsFlags flags{};
        flags.hasExplicitCollider = true;
        flags.hasSolid = true;
        flags.hasTopDown = true;
        const PhysicsBodyRules rules = resolvePhysicsBodyRules(comp, flags);
        CHECK(rules.bodyType == BodyType::Static);
        CHECK(std::abs(rules.gravityScale) < 0.001f);
    }

    {
        EntityPhysicsFlags flags{};
        flags.hasSensor = true;
        const PhysicsBodyRules rules = resolvePhysicsBodyRules(comp, flags);
        CHECK(rules.bodyType == BodyType::Static);
        CHECK(rules.deriveColliderFromSensor);

        SensorComponent sensor;
        sensor.shape = "Rectangle";
        sensor.width = 64.f;
        sensor.height = 32.f;
        PhysicsComponent out{};
        applyPhysicsBodyRules(out, rules, &sensor);
        CHECK(out.collider.isSensor);
        CHECK(std::abs(out.collider.size.x - 64.f) < 0.001f);
    }

    if (g_failed == 0) {
        std::cout << "physics-body-rules-test: " << g_passed << " passed\n";
        return 0;
    }
    std::cerr << "physics-body-rules-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return 1;
}

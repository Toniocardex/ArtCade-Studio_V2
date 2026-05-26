#pragma once

#include "../../../core/types.h"

namespace ArtCade::Modules {

struct EntityPhysicsFlags {
    bool hasExplicitCollider = false;
    bool hasPlatformer       = false;
    bool hasTopDown          = false;
    bool hasSolid            = false;
    bool hasSensor           = false;
};

struct PhysicsBodyRules {
    BodyType bodyType               = BodyType::Dynamic;
    float    gravityScale           = 1.f;
    bool     deriveColliderFromSensor = false;
};

/** Pure policy: body type + gravity + whether collider comes from SensorComponent. */
PhysicsBodyRules resolvePhysicsBodyRules(const PhysicsComponent& compIn,
                                         const EntityPhysicsFlags& flags);

/** Mutates comp to match rules; optional sensor when deriveColliderFromSensor. */
void applyPhysicsBodyRules(PhysicsComponent& comp,
                           const PhysicsBodyRules& rules,
                           const SensorComponent* sensor);

} // namespace ArtCade::Modules

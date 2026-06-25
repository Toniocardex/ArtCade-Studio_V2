#include "../include/physics-body-rules.h"

namespace ArtCade::Modules {

PhysicsBodyRules resolvePhysicsBodyRules(const PhysicsComponent& compIn,
                                         const EntityPhysicsFlags& flags)
{
    PhysicsBodyRules rules{};
    rules.bodyType = compIn.bodyType;
    rules.gravityScale =
        (flags.hasTopDown || flags.hasPlatformer) ? 0.f : 1.f;

    if (!flags.hasExplicitCollider)
        rules.bodyType = BodyType::Dynamic;
    if (flags.hasPlatformer && flags.hasExplicitCollider)
        rules.bodyType = BodyType::Kinematic;

    return rules;
}

void applyPhysicsBodyRules(PhysicsComponent& comp,
                           const PhysicsBodyRules& rules)
{
    comp.bodyType = rules.bodyType;
}

} // namespace ArtCade::Modules

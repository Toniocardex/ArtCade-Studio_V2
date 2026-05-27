#include "../include/physics-body-rules.h"

#include <algorithm>

namespace ArtCade::Modules {

PhysicsBodyRules resolvePhysicsBodyRules(const PhysicsComponent& compIn,
                                         const EntityPhysicsFlags& flags)
{
    PhysicsBodyRules rules{};
    rules.bodyType = compIn.bodyType;
    // Platformer / top-down controllers integrate gravity in World — not physics step.
    rules.gravityScale =
        (flags.hasTopDown || flags.hasPlatformer) ? 0.f : 1.f;
    rules.deriveColliderFromSensor =
        !flags.hasExplicitCollider && flags.hasSensor;

    // Order matches legacy ensurePhysicsBody: implicit → platformer → solid wins.
    if (!flags.hasExplicitCollider) {
        if (flags.hasSensor)
            rules.bodyType = BodyType::Static;
        else
            rules.bodyType = BodyType::Dynamic;
    }
    if (flags.hasPlatformer && flags.hasExplicitCollider)
        rules.bodyType = BodyType::Kinematic;
    if (flags.hasSolid)
        rules.bodyType = BodyType::Static;

    return rules;
}

void applyPhysicsBodyRules(PhysicsComponent& comp,
                           const PhysicsBodyRules& rules,
                           const SensorComponent* sensor)
{
    comp.bodyType = rules.bodyType;

    if (!rules.deriveColliderFromSensor || !sensor)
        return;

    comp.collider.isSensor = true;
    if (sensor->shape == "Circle") {
        comp.collider.shape = ColliderShape::Circle;
        const float r = std::max(1.f, sensor->radius);
        comp.collider.size = { r, r };
    } else {
        comp.collider.shape = ColliderShape::Rectangle;
        comp.collider.size = {
            std::max(1.f, sensor->width),
            std::max(1.f, sensor->height),
        };
    }
}

} // namespace ArtCade::Modules

#pragma once

#include "../../core/types.h"
#include <string>

namespace ArtCade::Modules {
class RuntimeEntityGateway;
class Physics;
}

namespace ArtCade::WorldInternal {

struct GroundingContext {
    const Modules::RuntimeEntityGateway& gateway;
    Modules::Physics&                    physics;
};

bool isGroundedOnSolidAabb(const GroundingContext& ctx,
                           EntityId id,
                           const std::string& groundClass);

bool isGrounded(const GroundingContext& ctx,
                EntityId id,
                const std::string& groundClass);

} // namespace ArtCade::WorldInternal

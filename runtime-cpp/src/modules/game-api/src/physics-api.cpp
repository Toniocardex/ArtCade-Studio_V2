#include "../include/game-api.h"
#include "../../entity-system/include/entity-manager.h"
#include "../../physics/include/physics.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindPhysicsAPI(sol::state& lua) {
    auto* em      = ctx_.entityManager;
    auto* physics = ctx_.physics;

    // collision.overlap(id1, id2) → bool
    lua.set_function("collision_overlap", [em, physics](EntityId id1, EntityId id2) -> bool {
        auto* e1 = em->get(id1);
        auto* e2 = em->get(id2);
        if (!e1 || !e2) return false;
        return physics->areOverlapping(e1->physics.physicsHandle,
                                       e2->physics.physicsHandle);
    });

    // collision.touchingClass(entityId, className) → bool
    lua.set_function("collision_touchingClass",
        [em, physics](EntityId id, const std::string& cls) -> bool {
            auto* self = em->get(id);
            if (!self) return false;
            for (EntityId otherId : em->getPool(cls)) {
                if (otherId == id) continue;
                auto* other = em->get(otherId);
                if (!other) continue;
                if (physics->areOverlapping(self->physics.physicsHandle,
                                            other->physics.physicsHandle))
                    return true;
            }
            return false;
        });

    // collision.raycast(x1, y1, x2, y2) → {hit, entityId, x, y, dist}
    lua.set_function("collision_raycast",
        [physics](float x1, float y1, float x2, float y2) -> sol::table {
            // Note: sol::table creation needs the Lua state; handled below
            // Placeholder — real impl uses lua.create_table()
            (void)physics; (void)x1; (void)y1; (void)x2; (void)y2;
            return sol::table{};  // TODO: return proper table
        });

    lua.script(R"(
        collision = {}
        collision.overlap       = function(id1, id2)    return collision_overlap(id1, id2)         end
        collision.touchingClass = function(id, cls)     return collision_touchingClass(id, cls)     end
        collision.raycast       = function(x1,y1,x2,y2) return collision_raycast(x1,y1,x2,y2)     end
    )");
}

} // namespace ArtCade::Modules

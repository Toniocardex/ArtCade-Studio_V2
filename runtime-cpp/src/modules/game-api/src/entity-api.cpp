#include "../include/game-api.h"
#include "../../entity-system/include/entity-manager.h"
#include "../../physics/include/physics.h"

#include <sol/sol.hpp>
#include <tuple>

namespace ArtCade::Modules {

void GameAPI::bindEntityAPI(sol::state& lua) {
    auto* em      = ctx_.entityManager;
    auto* physics = ctx_.physics;

    // entity.position(id) → x, y
    lua.set_function("entity_position", [em](EntityId id) -> std::tuple<float, float> {
        if (auto* e = em->get(id))
            return { e->transform.position.x, e->transform.position.y };
        return { 0.f, 0.f };
    });

    // entity.setPosition(id, x, y)
    lua.set_function("entity_setPosition", [em](EntityId id, float x, float y) {
        if (auto* e = em->get(id))
            e->transform.position = { x, y };
    });

    // entity.velocity(id) → vx, vy
    lua.set_function("entity_velocity", [em, physics](EntityId id) -> std::tuple<float, float> {
        if (auto* e = em->get(id)) {
            auto vel = physics->getLinearVelocity(e->physics.physicsHandle);
            return { vel.x, vel.y };
        }
        return { 0.f, 0.f };
    });

    // entity.setVelocity(id, vx, vy)
    lua.set_function("entity_setVelocity", [em, physics](EntityId id, float vx, float vy) {
        if (auto* e = em->get(id))
            physics->setLinearVelocity(e->physics.physicsHandle, { vx, vy });
    });

    // entity.destroy(id)
    lua.set_function("entity_destroy", [em](EntityId id) {
        em->destroyEntity(id);
    });

    // pool.getAll(className) → table of ids
    lua.set_function("pool_getAll", [em](const std::string& cls) {
        return em->getPool(cls);
    });

    // pool.count(className) → integer
    lua.set_function("pool_count", [em](const std::string& cls) -> size_t {
        return em->poolCount(cls);
    });

    // Expose Lua-side convenience table wrappers
    lua.script(R"(
        entity = {}
        entity.position    = function(id)       return entity_position(id)       end
        entity.setPosition = function(id, x, y) return entity_setPosition(id,x,y) end
        entity.velocity    = function(id)       return entity_velocity(id)       end
        entity.setVelocity = function(id,vx,vy) return entity_setVelocity(id,vx,vy) end
        entity.destroy     = function(id)       return entity_destroy(id)        end

        pool = {}
        pool.getAll = function(cls)  return pool_getAll(cls)  end
        pool.count  = function(cls)  return pool_count(cls)   end
    )");
}

} // namespace ArtCade::Modules

#include "../include/game-api.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../physics/include/physics.h"

#include <sol/sol.hpp>
#include <tuple>
#include <cmath>

namespace ArtCade::Modules {

void GameAPI::bindEntityAPI(sol::state& lua) {
    auto* entities = ctx_.entityGateway;
    auto* physics = ctx_.physics;

    // entity.position(id) → x, y
    lua.set_function("entity_position", [entities](EntityId id) -> std::tuple<float, float> {
        if (auto* e = entities->get(id))
            return { e->transform.position.x, e->transform.position.y };
        return { 0.f, 0.f };
    });

    // entity.setPosition(id, x, y)
    lua.set_function("entity_setPosition", [entities](EntityId id, float x, float y) {
        if (auto* e = entities->get(id))
            e->transform.position = { x, y };
    });

    // entity.velocity(id) → vx, vy
    lua.set_function("entity_velocity", [entities, physics](EntityId id) -> std::tuple<float, float> {
        if (auto* e = entities->get(id)) {
            auto vel = physics->getLinearVelocity(e->physics.physicsHandle);
            return { vel.x, vel.y };
        }
        return { 0.f, 0.f };
    });

    // entity.setVelocity(id, vx, vy)
    lua.set_function("entity_setVelocity", [entities, physics](EntityId id, float vx, float vy) {
        if (auto* e = entities->get(id))
            physics->setLinearVelocity(e->physics.physicsHandle, { vx, vy });
    });

    // entity.destroy(id)
    // Cleans up the physics body (if any) before removing the entity.
    lua.set_function("entity_destroy", [entities](EntityId id) {
        entities->queueDestroy(id);
    });

    // entity.setRotation(id, radians)
    lua.set_function("entity_setRotation", [entities](EntityId id, float a) {
        if (auto* e = entities->get(id)) e->transform.rotation = a;
    });
    // entity.setScale(id, sx, sy)
    lua.set_function("entity_setScale", [entities](EntityId id, float sx, float sy) {
        if (auto* e = entities->get(id)) e->transform.scale = { sx, sy };
    });
    // entity.setVisible(id, bool) — implemented via sprite alpha (no struct change)
    lua.set_function("entity_setVisible", [entities](EntityId id, bool v) {
        if (auto* e = entities->get(id)) e->sprite.alpha = v ? 1.f : 0.f;
    });
    // entity.setTint(id, r, g, b, a)  — components in 0..1
    lua.set_function("entity_setTint",
        [entities](EntityId id, float r, float g, float b, float a) {
            if (auto* e = entities->get(id)) e->sprite.tint = { r, g, b, a };
        });

    // scene.load(name) / scene.restart()  — flow control via the gateway
    lua.set_function("scene_load", [entities](const std::string& name) {
        if (entities) entities->loadScene(name);
    });
    lua.set_function("scene_restart", [entities]() {
        if (entities) entities->loadScene(entities->activeSceneId());
    });

    // pool.getAll(className) → table of ids
    lua.set_function("pool_getAll", [entities](const std::string& cls) {
        return entities->poolByClass(cls);
    });

    // pool.count(className) → integer
    lua.set_function("pool_count", [entities](const std::string& cls) -> size_t {
        return entities->poolCount(cls);
    });

    // -------------------------------------------------------------------------
    // Object.spawn(className, x, y) → EntityId
    // Creates a minimal runtime entity (no sprite/physics — pure logic object).
    // The new entity is added to the class pool so pool.getAll() finds it.
    // -------------------------------------------------------------------------
    lua.set_function("object_spawn",
        [entities](const std::string& cls, float x, float y) -> EntityId {
            EntityDef def;
            def.id                   = 0;
            def.className            = cls;
            def.transform.position   = { x, y };
            def.transform.rotation   = 0.f;
            def.transform.scale      = { 1.f, 1.f };
            def.runtime.sceneActive  = true;
            return entities->create(def);
        });

    lua.set_function("object_destroy", [entities](EntityId id) {
        entities->queueDestroy(id);
    });

    // Object.findByTag(tag) → array of EntityIds
    lua.set_function("object_findByTag", [entities](const std::string& tag) {
        return entities->byTag(tag);
    });

    // Object.findNear(x, y, radius, className?) → array of EntityIds
    lua.set_function("object_findNear",
        [entities](sol::this_state ts, float x, float y, float radius,
             sol::optional<std::string> cls) -> sol::object
        {
            sol::state_view L(ts);
            sol::table result = L.create_table();

            std::vector<EntityId> candidates =
                cls ? entities->poolByClass(*cls) : entities->allIds();

            int idx = 1;
            float r2 = radius * radius;
            for (EntityId eid : candidates) {
                auto* e = entities->get(eid);
                if (!e) continue;
                float dx = e->transform.position.x - x;
                float dy = e->transform.position.y - y;
                if (dx*dx + dy*dy <= r2)
                    result[idx++] = eid;
            }
            return sol::make_object(L, result);
        });

    // Object.exists(id) → bool
    lua.set_function("object_exists", [entities](EntityId id) -> bool {
        return entities->exists(id);
    });

    // Object.distance(id1, id2) → float
    lua.set_function("object_distance",
        [entities](EntityId id1, EntityId id2) -> float {
            auto* e1 = entities->get(id1);
            auto* e2 = entities->get(id2);
            if (!e1 || !e2) return -1.f;
            float dx = e1->transform.position.x - e2->transform.position.x;
            float dy = e1->transform.position.y - e2->transform.position.y;
            return std::sqrt(dx*dx + dy*dy);
        });

    // Expose Lua-side convenience table wrappers
    lua.script(R"(
        entity = {}
        entity.position    = function(id)       return entity_position(id)       end
        entity.setPosition = function(id, x, y) return entity_setPosition(id,x,y) end
        entity.velocity    = function(id)       return entity_velocity(id)       end
        entity.setVelocity = function(id,vx,vy) return entity_setVelocity(id,vx,vy) end
        entity.destroy     = function(id)       return entity_destroy(id)        end
        entity.setRotation = function(id,a)     return entity_setRotation(id,a)  end
        entity.setScale    = function(id,sx,sy) return entity_setScale(id,sx,sy) end
        entity.setVisible  = function(id,v)     return entity_setVisible(id,v)   end
        entity.setTint     = function(id,r,g,b,a) return entity_setTint(id,r,g,b,a) end

        scene = {}
        scene.load    = function(name) return scene_load(name) end
        scene.restart = function()     return scene_restart()  end

        pool = {}
        pool.getAll = function(cls)  return pool_getAll(cls)  end
        pool.count  = function(cls)  return pool_count(cls)   end

        object = {}
        object.spawn     = function(cls, x, y)          return object_spawn(cls, x, y)         end
        object.destroy   = function(id)                  return object_destroy(id)               end
        object.findByTag = function(tag)                 return object_findByTag(tag)            end
        object.findNear  = function(x, y, r, cls)        return object_findNear(x, y, r, cls)   end
        object.exists    = function(id)                  return object_exists(id)               end
        object.distance  = function(id1, id2)            return object_distance(id1, id2)        end
    )");
}

} // namespace ArtCade::Modules

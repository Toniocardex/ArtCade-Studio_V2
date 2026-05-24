#include "../include/game-api.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../physics/include/physics.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindPhysicsAPI(sol::state& lua) {
    auto* entities = ctx_.entityGateway;
    auto* physics = ctx_.physics;

    // collision.overlap(id1, id2) → bool
    lua.set_function("collision_overlap", [entities, physics](EntityId id1, EntityId id2) -> bool {
        if (!entities->exists(id1) || !entities->exists(id2)) return false;
        const uint32_t h1 = entities->physicsHandle(id1);
        const uint32_t h2 = entities->physicsHandle(id2);
        if (h1 == 0 || h2 == 0) return false;
        return physics->areOverlapping(h1, h2);
    });

    // collision.touchingClass(entityId, className) → bool
    lua.set_function("collision_touchingClass",
        [entities, physics](EntityId id, const std::string& cls) -> bool {
            if (!entities->exists(id)) return false;
            const uint32_t selfHandle = entities->physicsHandle(id);
            if (selfHandle == 0) return false;
            for (EntityId otherId : entities->poolByClass(cls)) {
                if (otherId == id) continue;
                if (!entities->exists(otherId)) continue;
                const uint32_t otherHandle = entities->physicsHandle(otherId);
                if (otherHandle != 0 && physics->areOverlapping(selfHandle, otherHandle))
                    return true;
            }
            return false;
        });

    // collision.raycast(x1, y1, x2, y2) → {hit, entityId, x, y, dist}
    //   hit      — bool: true if the ray hit something
    //   entityId — EntityId of the hit entity, or 0 if none
    //   x, y     — world-space hit point
    //   dist     — distance in pixels from (x1,y1) to hit point
    lua.set_function("collision_raycast",
        [physics](sol::this_state ts, float x1, float y1, float x2, float y2) -> sol::object {
            sol::state_view L(ts);
            sol::table tbl = L.create_table(0, 5);

            if (!physics) {
                tbl["hit"]      = false;
                tbl["entityId"] = 0;
                tbl["x"]        = 0.f;
                tbl["y"]        = 0.f;
                tbl["dist"]     = 0.f;
                return sol::make_object(L, tbl);
            }

            auto r = physics->raycast({ x1, y1 }, { x2, y2 });
            tbl["hit"]      = r.hit;
            tbl["entityId"] = static_cast<int>(r.entityId);
            tbl["x"]        = r.point.x;
            tbl["y"]        = r.point.y;
            tbl["dist"]     = r.distance;
            return sol::make_object(L, tbl);
        });

    // -------------------------------------------------------------------------
    // physics.createBody(entityId, bodyType, shapeType, w, h)
    //   bodyType  : "dynamic" | "static" | "kinematic"   (default "dynamic")
    //   shapeType : "rect" | "circle"                     (default "rect")
    //   w, h      : collider half-size in pixels          (default 32, 32)
    //
    // Creates a Box2D body positioned at the entity's current transform and
    // stores the runtime handle in RuntimeEntityGateway so entity.velocity /
    // entity.setVelocity and syncPhysicsToEntities all work automatically.
    // Returns the opaque uint32_t handle, or 0 on failure.
    // -------------------------------------------------------------------------
    lua.set_function("physics_createBody",
        [entities, physics](EntityId id,
                      const std::string& bt,
                      const std::string& st,
                      float w, float h) -> uint32_t
        {
            Transform transform{};
            if (!entities->exists(id) || !entities->getTransform(id, transform)) return 0;

            PhysicsComponent comp;
            comp.bodyType =
                (bt == "static")    ? BodyType::Static    :
                (bt == "kinematic") ? BodyType::Kinematic : BodyType::Dynamic;

            comp.collider.shape =
                (st == "circle") ? ColliderShape::Circle : ColliderShape::Rectangle;
            comp.collider.size    = { w, h };
            comp.collider.density  = 1.f;
            comp.collider.friction = 0.4f;
            comp.collider.offset   = { 0.f, 0.f };

            uint32_t handle = physics->createBody(id, comp);
            if (handle == 0) return 0;

            // Place body at entity's JSON spawn position
            physics->setPosition(handle, transform.position);

            comp.physicsHandle = handle;
            entities->setPhysicsComponent(id, comp);
            entities->setPhysicsHandle(id, handle);

            return handle;
        });

    // physics.setGravity(gx, gy) — world gravity in px/s²; Y-down = positive gy
    lua.set_function("physics_setGravity", [physics](float gx, float gy) {
        physics->setGravity({ gx, gy });
    });

    // physics.bodyPosition(entityId) → x, y  (direct from Box2D, not transform)
    lua.set_function("physics_bodyPosition",
        [entities, physics](EntityId id) -> std::tuple<float,float> {
            const uint32_t handle = entities->physicsHandle(id);
            if (!entities->exists(id) || handle == 0) return {0.f,0.f};
            auto p = physics->getPosition(handle);
            return {p.x, p.y};
        });

    // physics.applyImpulse(id, ix, iy) — velocity-space impulse (mass≈1)
    lua.set_function("physics_applyImpulse",
        [entities, physics](EntityId id, float ix, float iy) {
            const uint32_t handle = entities->physicsHandle(id);
            if (!entities->exists(id) || handle == 0) return;
            auto v = physics->getLinearVelocity(handle);
            physics->setLinearVelocity(handle, { v.x + ix, v.y + iy });
        });
    // physics.applyForce(id, fx, fy) — same velocity-space approximation
    lua.set_function("physics_applyForce",
        [entities, physics](EntityId id, float fx, float fy) {
            const uint32_t handle = entities->physicsHandle(id);
            if (!entities->exists(id) || handle == 0) return;
            auto v = physics->getLinearVelocity(handle);
            physics->setLinearVelocity(handle, { v.x + fx, v.y + fy });
        });

    lua.script(R"(
        collision = {}
        collision.overlap       = function(id1, id2)     return collision_overlap(id1, id2)          end
        collision.touchingClass = function(id, cls)      return collision_touchingClass(id, cls)      end
        collision.raycast       = function(x1,y1,x2,y2) return collision_raycast(x1,y1,x2,y2)       end

        physics = {}
        physics.createBody    = function(id, bt, st, w, h)
                                    return physics_createBody(id, bt or "dynamic", st or "rect", w or 32, h or 32)
                                end
        physics.setGravity    = function(gx, gy)         return physics_setGravity(gx, gy)           end
        physics.bodyPosition  = function(id)             return physics_bodyPosition(id)              end
        physics.applyImpulse  = function(id, ix, iy)     return physics_applyImpulse(id, ix, iy)      end
        physics.applyForce    = function(id, fx, fy)     return physics_applyForce(id, fx, fy)        end
    )");
}

} // namespace ArtCade::Modules

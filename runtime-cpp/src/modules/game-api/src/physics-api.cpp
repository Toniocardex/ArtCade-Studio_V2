#include "../include/game-api.h"
#include "../../collision/include/entity_collision_query.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../physics/include/physics.h"

#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindPhysicsAPI(sol::state& lua) {
    auto* entities = ctx_.entityGateway;
    auto* physics = ctx_.physics;

    // collision.overlap(id1, id2) → bool (geometric; no physics body required)
    lua.set_function("collision_overlap",
        [entities](EntityId id1, EntityId id2) -> bool {
            return CollisionQuery::entitiesOverlap(*entities, id1, id2);
        });

    // collision.touchingClass(entityId, className) → bool
    lua.set_function("collision_touchingClass",
        [entities](EntityId id, const std::string& cls) -> bool {
            return CollisionQuery::touchingClass(*entities, id, cls);
        });

    // collision.firstTouching(entityId, className) → entityId (0 if none)
    lua.set_function("collision_firstTouching",
        [entities](EntityId id, const std::string& cls) -> int {
            const EntityId other =
                CollisionQuery::firstOverlappingInClass(*entities, id, cls);
            return static_cast<int>(other);
        });

    // collision.raycast(x1, y1, x2, y2) → {hit, entityId, x, y, dist}
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

            physics->setPosition(handle, transform.position);

            comp.physicsHandle = handle;
            entities->setPhysicsComponent(id, comp);
            entities->setPhysicsHandle(id, handle);

            return handle;
        });

    lua.set_function("physics_setGravity", [physics](float gx, float gy) {
        physics->setGravity({ gx, gy });
    });

    lua.set_function("physics_bodyPosition",
        [entities, physics](EntityId id) -> std::tuple<float,float> {
            const uint32_t handle = entities->physicsHandle(id);
            if (!entities->exists(id) || handle == 0) return {0.f,0.f};
            auto p = physics->getPosition(handle);
            return {p.x, p.y};
        });

    lua.set_function("physics_applyImpulse",
        [entities, physics](EntityId id, float ix, float iy) {
            const uint32_t handle = entities->physicsHandle(id);
            if (!entities->exists(id) || handle == 0) return;
            auto v = physics->getLinearVelocity(handle);
            physics->setLinearVelocity(handle, { v.x + ix, v.y + iy });
        });

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
        collision.firstTouching = function(id, cls)      return collision_firstTouching(id, cls)      end
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

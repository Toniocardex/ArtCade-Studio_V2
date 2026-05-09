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
            (void)physics; (void)x1; (void)y1; (void)x2; (void)y2;
            return sol::table{};  // TODO: return proper table (Fase 16)
        });

    // -------------------------------------------------------------------------
    // physics.createBody(entityId, bodyType, shapeType, w, h)
    //   bodyType  : "dynamic" | "static" | "kinematic"   (default "dynamic")
    //   shapeType : "rect" | "circle"                     (default "rect")
    //   w, h      : collider half-size in pixels          (default 32, 32)
    //
    // Creates a Box2D body positioned at the entity's current transform and
    // stores the handle in e->physics.physicsHandle so entity.velocity /
    // entity.setVelocity and syncPhysicsToEntities all work automatically.
    // Returns the opaque uint32_t handle, or 0 on failure.
    // -------------------------------------------------------------------------
    lua.set_function("physics_createBody",
        [em, physics](EntityId id,
                      const std::string& bt,
                      const std::string& st,
                      float w, float h) -> uint32_t
        {
            auto* e = em->get(id);
            if (!e) return 0;

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
            physics->setPosition(handle, e->transform.position);

            // Back-write into the EntityDef so entity.velocity etc. work
            e->physics.physicsHandle = handle;
            e->physics.bodyType      = comp.bodyType;
            e->physics.collider      = comp.collider;

            return handle;
        });

    // physics.setGravity(gx, gy) — world gravity in px/s²; Y-down = positive gy
    lua.set_function("physics_setGravity", [physics](float gx, float gy) {
        physics->setGravity({ gx, gy });
    });

    // physics.bodyPosition(entityId) → x, y  (direct from Box2D, not transform)
    lua.set_function("physics_bodyPosition",
        [em, physics](EntityId id) -> std::tuple<float,float> {
            auto* e = em->get(id);
            if (!e || e->physics.physicsHandle == 0) return {0.f,0.f};
            auto p = physics->getPosition(e->physics.physicsHandle);
            return {p.x, p.y};
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
    )");
}

} // namespace ArtCade::Modules

#include "../include/game-api.h"
#include "../../../world/include/world.h"
#include "../../runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <algorithm>
#include <cmath>
#include <sol/sol.hpp>

namespace ArtCade::Modules {

namespace {

RuntimeEntityGateway* gateway(const EngineContext& ctx) {
    return ctx.entityGateway;
}

World* world(const EngineContext& ctx) {
    return ctx.world;
}

} // namespace

void GameAPI::bindComponentAPI(sol::state& lua) {
    const EngineContext& ctx = ctx_;

    lua.set_function("linearMover_setDirection",
        [ctx](EntityId id, float dx, float dy) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            LinearMoverComponent lm{};
            if (!gw->getLinearMover(id, lm)) return false;
            lm.directionX = dx;
            lm.directionY = dy;
            return gw->setLinearMover(id, lm);
        });

    lua.set_function("linearMover_setSpeed",
        [ctx](EntityId id, float speed) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            LinearMoverComponent lm{};
            if (!gw->getLinearMover(id, lm)) return false;
            lm.speed = std::max(0.f, speed);
            return gw->setLinearMover(id, lm);
        });

    lua.set_function("linearMover_setPaused",
        [ctx](EntityId id, bool paused) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            LinearMoverComponent lm{};
            if (!gw->getLinearMover(id, lm)) return false;
            lm._paused = paused;
            return gw->setLinearMover(id, lm);
        });

    lua.set_function("magnet_setEnabled",
        [ctx](EntityId id, bool enabled) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            MagneticItemComponent mag{};
            if (!gw->getMagneticItem(id, mag)) return false;
            mag._enabled = enabled;
            return gw->setMagneticItem(id, mag);
        });

    lua.set_function("magnet_setTargetTag",
        [ctx](EntityId id, const std::string& tag) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            MagneticItemComponent mag{};
            if (!gw->getMagneticItem(id, mag)) return false;
            mag.attractTag = tag;
            return gw->setMagneticItem(id, mag);
        });

    lua.set_function("horde_setTargetClass",
        [ctx](EntityId id, const std::string& className) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            HordeMemberComponent horde{};
            if (!gw->getHordeMember(id, horde)) return false;
            horde.targetClass = className;
            return gw->setHordeMember(id, horde);
        });

    lua.set_function("horde_setWeights",
        [ctx](EntityId id, float chaseWeight, float separationWeight) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            HordeMemberComponent horde{};
            if (!gw->getHordeMember(id, horde)) return false;
            horde.chaseWeight = std::max(0.f, chaseWeight);
            horde.separationWeight = std::max(0.f, separationWeight);
            return gw->setHordeMember(id, horde);
        });

    lua.set_function("autoDestroy_setLifespan",
        [ctx](EntityId id, float lifespan) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            AutoDestroyComponent ad{};
            if (!gw->getAutoDestroy(id, ad)) return false;
            ad.lifespan = std::max(0.f, lifespan);
            ad._timeAlive = 0.f;
            return gw->setAutoDestroy(id, ad);
        });

    lua.set_function("autoDestroy_cancel",
        [ctx](EntityId id) -> bool {
            auto* gw = gateway(ctx);
            if (!gw) return false;
            AutoDestroyComponent ad{};
            if (!gw->getAutoDestroy(id, ad)) return false;
            ad.lifespan = 0.f;
            ad._timeAlive = 0.f;
            return gw->setAutoDestroy(id, ad);
        });

    lua.set_function("platformer_isGrounded",
        [ctx](EntityId id) -> bool {
            auto* w = world(ctx);
            return w && w->isPlatformerGrounded(id);
        });

    lua.script(R"(
        linearMover = linearMover or {}
        magnet = magnet or {}
        horde = horde or {}
        autoDestroy = autoDestroy or {}

        function linearMover.setDirection(entityId, directionX, directionY)
            return linearMover_setDirection(entityId, directionX or 0, directionY or 0)
        end

        function linearMover.setSpeed(entityId, speed)
            return linearMover_setSpeed(entityId, speed or 0)
        end

        function linearMover.pause(entityId)
            return linearMover_setPaused(entityId, true)
        end

        function linearMover.resume(entityId)
            return linearMover_setPaused(entityId, false)
        end

        function magnet.setEnabled(entityId, enabled)
            return magnet_setEnabled(entityId, enabled ~= false)
        end

        function magnet.setTargetTag(entityId, tag)
            return magnet_setTargetTag(entityId, tag or "")
        end

        function horde.setTargetClass(entityId, className)
            return horde_setTargetClass(entityId, className or "")
        end

        function horde.setWeights(entityId, chaseWeight, separationWeight)
            return horde_setWeights(entityId, chaseWeight or 0, separationWeight or 0)
        end

        function autoDestroy.setLifespan(entityId, lifespan)
            return autoDestroy_setLifespan(entityId, lifespan or 0)
        end

        function autoDestroy.cancel(entityId)
            return autoDestroy_cancel(entityId)
        end

        function platformer.isGrounded(entityId)
            return platformer_isGrounded(entityId)
        end
    )");
}

} // namespace ArtCade::Modules

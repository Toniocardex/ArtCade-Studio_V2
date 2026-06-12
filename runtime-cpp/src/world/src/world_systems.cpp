#include "world_internal.h"
#include "../../modules/renderer/include/renderer.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace ArtCade {

void World::tickCameraTargets(float dt) {
    if (!renderer_) return;

    entityGateway_.forEachActiveCameraTarget(
        [this, dt](EntityId id, const CameraTargetComponent& ct) {
            Transform transform{};
            if (!entityGateway_.getTransform(id, transform)) return;

            const Vec2 desiredCenter = {
                transform.position.x + ct.offsetX,
                transform.position.y + ct.offsetY,
            };
            const Vec2 currentCenter = renderer_->getCameraCenter();
            Vec2 nextCenter = desiredCenter;
            if (ct.followSpeed > 0.f && dt > 0.f) {
                const float t = 1.f - std::exp(-ct.followSpeed * dt);
                nextCenter = {
                    currentCenter.x + (desiredCenter.x - currentCenter.x) * t,
                    currentCenter.y + (desiredCenter.y - currentCenter.y) * t,
                };
            }
            renderer_->setCameraCenter(nextCenter);
        });
}

void World::tickSensorOverlapEdges() {
    entityGateway_.forEachActiveSensor(
        [this](EntityId id, const SensorComponent& sensor) {
            const uint32_t handle = entityGateway_.physicsHandle(id);
            if (handle == 0) return;

            bool overlapping = false;
            EntityId otherHit = INVALID_ENTITY;
            const std::string& target = sensor.targetTag;

            entityGateway_.forEachActiveByTag(target, [&](EntityId otherId) {
                if (overlapping || otherId == id) return;
                const uint32_t otherHandle = entityGateway_.physicsHandle(otherId);
                if (otherHandle == 0) return;
                if (physics_.areOverlapping(handle, otherHandle)) {
                    overlapping = true;
                    otherHit = otherId;
                }
            });

            const bool was = sensorWasOverlapping_[id];
            if (overlapping && !was) {
                sensorEdgeBuffer_.push_back({ id, otherHit, target, true });
            } else if (!overlapping && was) {
                sensorEdgeBuffer_.push_back({ id, INVALID_ENTITY, target, false });
            }

            sensorWasOverlapping_[id] = overlapping;
        });
}

void World::tickHordeMembers(float dt) {
    struct HordeSnap {
        EntityId              id = 0;
        Vec2                  pos;
        HordeMemberComponent  cfg;
    };
    std::vector<HordeSnap> members;
    members.reserve(32);

    entityGateway_.forEachActiveHordeMember(
        [&](EntityId id, const HordeMemberComponent& horde) {
            // Skip entities that ALREADY have their own movement authority:
            // gameplay controllers (platformer / top-down / linear mover) own
            // velocity directly and we must not stomp them. SolidComponent,
            // however, is just a collision flag — having one does NOT mean
            // the entity has its own steering. The previous code returned
            // here for any Solid entity, which froze every horde enemy that
            // also had collision (i.e. almost all of them).
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;
            TopDownControllerComponent topDown{};
            if (entityGateway_.getTopDownController(id, topDown))
                return;
            LinearMoverComponent linear{};
            if (entityGateway_.getLinearMover(id, linear))
                return;

            Transform transform{};
            if (!entityGateway_.getTransform(id, transform)) return;
            members.push_back({ id, transform.position, horde });
        });

    for (const HordeSnap& self : members) {
        Vec2 steer{};

        float bestDist2 = 1e30f;
        Vec2 chaseDir{};
        for (EntityId targetId : entityGateway_.poolByClass(self.cfg.targetClass)) {
            if (targetId == self.id) continue;
            Transform targetTransform{};
            if (!entityGateway_.getTransform(targetId, targetTransform)) continue;
            const Vec2 toTarget = {
                targetTransform.position.x - self.pos.x,
                targetTransform.position.y - self.pos.y,
            };
            const float dist2 = WorldInternal::lengthSq(toTarget);
            if (dist2 < bestDist2) {
                bestDist2 = dist2;
                chaseDir = WorldInternal::normalizeOrZero(toTarget);
            }
        }
        steer.x += chaseDir.x * self.cfg.chaseWeight;
        steer.y += chaseDir.y * self.cfg.chaseWeight;

        const float sepR = self.cfg.separationRadius;
        if (sepR > 0.f) {
            for (const HordeSnap& other : members) {
                if (other.id == self.id) continue;
                Vec2 away = { self.pos.x - other.pos.x, self.pos.y - other.pos.y };
                float dist2 = WorldInternal::lengthSq(away);
                if (dist2 >= sepR * sepR) continue;
                float dist;
                if (dist2 < 1e-6f) {
                    away = (self.id < other.id) ? Vec2{ 1.f, 0.f } : Vec2{ -1.f, 0.f };
                    dist = 1.f;
                } else {
                    dist = std::sqrt(dist2);
                }
                const float strength = (sepR - dist) / sepR;
                steer.x += (away.x / dist) * strength * self.cfg.separationWeight;
                steer.y += (away.y / dist) * strength * self.cfg.separationWeight;
            }
        }

        const Vec2 dir = WorldInternal::normalizeOrZero(steer);
        const Vec2 velocity = {
            dir.x * std::max(0.f, self.cfg.maxSpeed),
            dir.y * std::max(0.f, self.cfg.maxSpeed),
        };
        WorldInternal::applySteeringVelocity(
            physics_, entityGateway_, self.id, velocity, dt);
    }
}

void World::tickMagneticItems(float dt) {
    entityGateway_.forEachActiveMagneticItem(
        [this, dt](EntityId magnetId, const MagneticItemComponent& mag) {
            if (!mag._enabled) return;
            Transform magnetTransform{};
            if (!entityGateway_.getTransform(magnetId, magnetTransform)) return;

            const Vec2 magnetPos = magnetTransform.position;
            const float maxDist = mag.radius;
            const float speed = std::max(0.f, mag.pullSpeed);

            for (EntityId itemId : entityGateway_.byTag(mag.attractTag)) {
                if (itemId == magnetId) continue;

                Transform itemTransform{};
                if (!entityGateway_.getTransform(itemId, itemTransform)) continue;

                const Vec2 toMagnet = {
                    magnetPos.x - itemTransform.position.x,
                    magnetPos.y - itemTransform.position.y,
                };
                const float dist2 = WorldInternal::lengthSq(toMagnet);
                if (maxDist > 0.f && dist2 > maxDist * maxDist) continue;

                const Vec2 dir = WorldInternal::normalizeOrZero(toMagnet);
                const Vec2 velocity = { dir.x * speed, dir.y * speed };

                WorldInternal::applySteeringVelocity(
                    physics_, entityGateway_, itemId, velocity, dt);
            }
        });
}

void World::tickHealthCooldowns(float dt) {
    entityGateway_.forEachActiveHealth(
        [dt](EntityId, HealthComponent& h) {
            if (h._iFramesRemaining <= 0.f) return;
            h._iFramesRemaining = std::max(0.f, h._iFramesRemaining - dt);
        });
}

void World::tickAutoDestroy(float dt) {
    entityGateway_.forEachActiveAutoDestroy(
        [this, dt](EntityId id, AutoDestroyComponent& a) {
            if (a.lifespan <= 0.f) return;
            a._timeAlive += dt;
            if (a._timeAlive >= a.lifespan)
                entityGateway_.queueDestroy(id);
        });
}

} // namespace ArtCade

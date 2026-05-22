#include "../include/world.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../modules/renderer/include/renderer.h"

#include <algorithm>
#include <cmath>
#include <iostream>

namespace ArtCade {

namespace {

float lengthSq(Vec2 v) {
    return v.x * v.x + v.y * v.y;
}

Vec2 normalizeOrZero(Vec2 v) {
    const float len2 = lengthSq(v);
    if (len2 <= 0.000001f) return {};
    const float inv = 1.f / std::sqrt(len2);
    return { v.x * inv, v.y * inv };
}

Vec2 approach(Vec2 current, Vec2 target, float maxDelta) {
    const Vec2 delta{ target.x - current.x, target.y - current.y };
    const float dist2 = lengthSq(delta);
    if (dist2 <= maxDelta * maxDelta || dist2 <= 0.000001f)
        return target;
    const float inv = 1.f / std::sqrt(dist2);
    return {
        current.x + delta.x * inv * maxDelta,
        current.y + delta.y * inv * maxDelta,
    };
}

Vec2 constrainTopDownDirection(Vec2 direction, bool fourDirections) {
    direction.x = std::clamp(direction.x, -1.f, 1.f);
    direction.y = std::clamp(direction.y, -1.f, 1.f);
    if (fourDirections && direction.x != 0.f && direction.y != 0.f) {
        if (std::abs(direction.x) >= std::abs(direction.y))
            direction.y = 0.f;
        else
            direction.x = 0.f;
    }
    return normalizeOrZero(direction);
}

} // namespace

World::World(Modules::RuntimeEntityGateway& gateway,
             Modules::Physics&              ph,
             Modules::VariableManager&      variables)
    : entityGateway_(gateway), physics_(ph), variables_(variables) {}

void World::setGameplayDeps(Modules::Input* /*input*/) {}

void World::clearTilemapPhysics() {
    for (uint32_t h : tilePhysicsHandles_)
        physics_.destroyBody(h);
    tilePhysicsHandles_.clear();
}

void World::rebuildTilemapPhysics() {
    clearTilemapPhysics();

    const SceneId sid = entityGateway_.activeSceneId();
    const SceneDef* scene = entityGateway_.activeScene();
    if (!scene) {
        activeTilemap_ = TilemapData{};
        return;
    }

    activeTilemap_ = scene->tilemap;
    const TilemapData& tm = activeTilemap_;
    if (tm.cols <= 0 || tm.rows <= 0) return;

    int created = 0;
    const int n = static_cast<int>(tm.data.size());
    for (int r = 0; r < tm.rows; ++r) {
        for (int c = 0; c < tm.cols; ++c) {
            const int idx = r * tm.cols + c;
            if (idx >= n) continue;
            const int id = tm.data[idx];
            if (id <= 0) continue;
            auto si = tileSolid_.find(id);
            if (si == tileSolid_.end() || !si->second) continue;

            PhysicsComponent pc;
            pc.bodyType       = BodyType::Static;
            pc.collider.shape = ColliderShape::Rectangle;
            pc.collider.size  = { tm.tileSize, tm.tileSize };
            const uint32_t h = physics_.createBody(INVALID_ENTITY, pc);
            physics_.setPosition(h, {
                c * tm.tileSize + tm.tileSize * 0.5f,
                r * tm.tileSize + tm.tileSize * 0.5f });
            tilePhysicsHandles_.push_back(h);
            ++created;
        }
    }
    std::cout << "[Tilemap] " << created << " solid collision bodies created\n";
}

void World::clearGameplayRuntimeState() {
    platformerRt_.clear();
    topDownRt_.clear();
    controlIntents_.clear();
    sensorWasOverlapping_.clear();
    sensorEdgeBuffer_.clear();
}

void World::syncAfterEditorProject(const std::vector<TilePaletteEntry>& tilePalette) {
    tileSolid_.clear();
    for (const auto& e : tilePalette) tileSolid_[e.id] = e.solid;
    clearGameplayRuntimeState();
    rebuildTilemapPhysics();
}

void World::init(const ProjectDoc& doc) {
    entityGateway_.setPhysics(&physics_);
    entityGateway_.replaceProject(doc.scenes, doc.entities, doc.activeSceneId);

    tileSolid_.clear();
    activeTilemap_ = TilemapData{};
    for (const auto& e : doc.tilePalette) tileSolid_[e.id] = e.solid;

    rebuildTilemapPhysics();
}

void World::shutdown() {
    variables_.clear();
    platformerRt_.clear();
    topDownRt_.clear();
    controlIntents_.clear();
    sensorWasOverlapping_.clear();
    sensorEdgeBuffer_.clear();
}

std::vector<SensorEdgeEvent> World::pollSensorEdges() {
    std::vector<SensorEdgeEvent> out;
    out.swap(sensorEdgeBuffer_);
    return out;
}

bool World::loadScene(const SceneId& id) {
    if (!entityGateway_.loadScene(id)) return false;
    if (const SceneDef* sc = entityGateway_.activeScene())
        activeTilemap_ = sc->tilemap;
    else
        activeTilemap_ = TilemapData{};
    return true;
}

SceneId World::activeSceneId() const {
    return entityGateway_.activeSceneId();
}

void World::syncPhysicsToEntities() {
    // EnTT visitor: in-place Transform update for every active entity that
    // has a live physics handle. One registry pass, no double lookup.
    entityGateway_.forEachActivePhysicsBody(
        [this](EntityId, uint32_t handle, Transform& t) {
            t.position = physics_.getPosition(handle);
            t.velocity = physics_.getLinearVelocity(handle);
        });
}

bool World::hasGlobalState(const std::string& key) const {
    return variables_.exists(key);
}

StateValue World::getGlobalState(const std::string& key) const {
    auto v = variables_.get(key);
    if (auto* i = std::get_if<int32_t>(&v))   return StateValue{ *i };
    if (auto* f = std::get_if<float>(&v))     return StateValue{ *f };
    if (auto* b = std::get_if<bool>(&v))      return StateValue{ *b };
    if (auto* s = std::get_if<std::string>(&v)) return StateValue{ *s };
    return StateValue{ 0 };
}

void World::setGlobalState(const std::string& key, const StateValue& value) {
    if (auto* i = std::get_if<int32_t>(&value))   variables_.setInt(key, *i);
    else if (auto* f = std::get_if<float>(&value)) variables_.setFloat(key, *f);
    else if (auto* b = std::get_if<bool>(&value))  variables_.setBool(key, *b);
    else if (auto* s = std::get_if<std::string>(&value))
        variables_.setString(key, *s);
}

std::vector<EntityId> World::activeEntityIds() const {
    return entityGateway_.activeSceneIds();
}

bool World::isGrounded(EntityId id, const std::string& groundClass) const {
    const uint32_t selfHandle = entityGateway_.physicsHandle(id);
    if (selfHandle == 0) return false;

    for (EntityId otherId : entityGateway_.poolByClass(groundClass)) {
        if (otherId == id) continue;
        const uint32_t otherHandle = entityGateway_.physicsHandle(otherId);
        if (otherHandle == 0) continue;
        if (physics_.areOverlapping(selfHandle, otherHandle))
            return true;
    }
    return false;
}

void World::tickPlatformerControllers(float dt) {
    // EnTT visitor: const PlatformerControllerComponent& (authored config);
    // per-entity runtime state lives in platformerRt_ keyed by EntityId.
    entityGateway_.forEachActivePlatformer(
        [this, dt](EntityId id, const PlatformerControllerComponent& pc) {
            auto& rt = platformerRt_[id];

            const bool grounded = isGrounded(id, pc.groundClass);
            if (grounded)
                rt.coyoteTimer = pc.coyoteTime;
            else
                rt.coyoteTimer = std::max(0.f, rt.coyoteTimer - dt);

            auto intentIt = controlIntents_.find(id);
            ControlIntent* intent = intentIt != controlIntents_.end()
                ? &intentIt->second
                : nullptr;

            // Movement and jump are intent-only (movement.setIntent /
            // platformer.requestJump from Lua). No direct Input polling here.
            if (intent && intent->jumpRequested)
                rt.jumpBufferTimer = pc.jumpBuffer;
            else
                rt.jumpBufferTimer = std::max(0.f, rt.jumpBufferTimer - dt);

            const uint32_t handle = entityGateway_.physicsHandle(id);
            if (handle == 0) return;

            float vx = 0.f;
            float vy = physics_.getLinearVelocity(handle).y;

            if (intent && intent->hasMovement) {
                const float axis = std::clamp(intent->movement.x, -1.f, 1.f);
                vx = axis * pc.maxSpeed;
            }

            if (rt.jumpBufferTimer > 0.f && rt.coyoteTimer > 0.f) {
                vy = -pc.jumpForce;
                rt.coyoteTimer     = 0.f;
                rt.jumpBufferTimer = 0.f;
            } else if (!grounded) {
                vy += pc.customGravity * dt;
            }

            physics_.setLinearVelocity(handle, { vx, vy });
            if (intent)
                intent->jumpRequested = false;
        });
}

void World::tickTopDownControllers(float dt) {
    entityGateway_.forEachActiveTopDown(
        [this, dt](EntityId id, const TopDownControllerComponent& tc) {
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;

            auto& rt = topDownRt_[id];
            auto intentIt = controlIntents_.find(id);
            ControlIntent* intent = intentIt != controlIntents_.end()
                ? &intentIt->second
                : nullptr;

            Vec2 targetVelocity{};
            if (intent && intent->hasMovement) {
                const Vec2 direction = constrainTopDownDirection(
                    intent->movement, tc.fourDirections);
                targetVelocity = {
                    direction.x * tc.maxSpeed,
                    direction.y * tc.maxSpeed,
                };
                rt.velocity = approach(
                    rt.velocity, targetVelocity, std::max(0.f, tc.acceleration) * dt);
            } else {
                rt.velocity = approach(
                    rt.velocity, {}, std::max(0.f, tc.friction) * dt);
            }

            const uint32_t handle = entityGateway_.physicsHandle(id);
            if (handle != 0) {
                physics_.setLinearVelocity(handle, rt.velocity);
                return;
            }

            Transform transform{};
            if (!entityGateway_.getTransform(id, transform)) return;
            transform.velocity = rt.velocity;
            transform.position.x += rt.velocity.x * dt;
            transform.position.y += rt.velocity.y * dt;
            entityGateway_.setTransform(id, transform);
        });
}

void World::setRenderer(Modules::Renderer* renderer) {
    renderer_ = renderer;
}

void World::tickCameraTargets(float dt) {
    if (!renderer_) return;

    entityGateway_.forEachActiveCameraTarget(
        [this, dt](EntityId id, const CameraTargetComponent& ct) {
            Transform transform{};
            if (!entityGateway_.getTransform(id, transform)) return;

            const Vec2 desired = {
                transform.position.x + ct.offsetX,
                transform.position.y + ct.offsetY,
            };
            const Vec2 current = renderer_->getCameraPosition();
            Vec2 next = desired;
            if (ct.followSpeed > 0.f && dt > 0.f) {
                const float t = 1.f - std::exp(-ct.followSpeed * dt);
                next = {
                    current.x + (desired.x - current.x) * t,
                    current.y + (desired.y - current.y) * t,
                };
            }
            renderer_->setCameraPosition(next);
        });
}

void World::tickLinearMovers(float dt) {
    entityGateway_.forEachActiveLinearMover(
        [this, dt](EntityId id, const LinearMoverComponent& lm) {
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;
            TopDownControllerComponent topDown{};
            if (entityGateway_.getTopDownController(id, topDown))
                return;

            const Vec2 direction = normalizeOrZero({ lm.directionX, lm.directionY });
            const Vec2 velocity = {
                direction.x * std::max(0.f, lm.speed),
                direction.y * std::max(0.f, lm.speed),
            };

            const uint32_t handle = entityGateway_.physicsHandle(id);
            if (handle != 0) {
                PhysicsComponent physics{};
                if (entityGateway_.getPhysicsComponent(id, physics) &&
                    physics.bodyType != BodyType::Static)
                {
                    physics_.setLinearVelocity(handle, velocity);
                    return;
                }
            }

            Transform transform{};
            if (!entityGateway_.getTransform(id, transform)) return;
            transform.velocity = velocity;
            transform.position.x += velocity.x * dt;
            transform.position.y += velocity.y * dt;
            entityGateway_.setTransform(id, transform);
        });
}

void World::tickSensorOverlapEdges() {
    // EnTT visitor: deterministic insertion order so sensorEdgeBuffer_
    // (drained by Lua via pollSensorEdges) is reproducible across runs.
    entityGateway_.forEachActiveSensor(
        [this](EntityId id, const SensorComponent& sensor) {
            const uint32_t handle = entityGateway_.physicsHandle(id);
            if (handle == 0) return;

            bool overlapping = false;
            EntityId otherHit = INVALID_ENTITY;
            const std::string& target = sensor.targetTag;

            for (EntityId otherId : entityGateway_.byTag(target)) {
                if (otherId == id) continue;
                const uint32_t otherHandle = entityGateway_.physicsHandle(otherId);
                if (otherHandle == 0) continue;
                if (physics_.areOverlapping(handle, otherHandle)) {
                    overlapping = true;
                    otherHit = otherId;
                    break;
                }
            }

            const bool was = sensorWasOverlapping_[id];
            if (overlapping && !was) {
                sensorEdgeBuffer_.push_back({ id, otherHit, target, true });
            } else if (!overlapping && was) {
                sensorEdgeBuffer_.push_back({ id, INVALID_ENTITY, target, false });
            }

            sensorWasOverlapping_[id] = overlapping;
        });
}

void World::tickMagneticItems(float dt) {
    entityGateway_.forEachActiveMagneticItem(
        [this, dt](EntityId magnetId, const MagneticItemComponent& mag) {
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
                const float dist2 = lengthSq(toMagnet);
                if (maxDist > 0.f && dist2 > maxDist * maxDist) continue;

                const Vec2 dir = normalizeOrZero(toMagnet);
                const Vec2 velocity = { dir.x * speed, dir.y * speed };

                const uint32_t handle = entityGateway_.physicsHandle(itemId);
                if (handle != 0) {
                    PhysicsComponent physics{};
                    if (entityGateway_.getPhysicsComponent(itemId, physics) &&
                        physics.bodyType != BodyType::Static)
                    {
                        physics_.setLinearVelocity(handle, velocity);
                        continue;
                    }
                }

                itemTransform.velocity = velocity;
                itemTransform.position.x += velocity.x * dt;
                itemTransform.position.y += velocity.y * dt;
                entityGateway_.setTransform(itemId, itemTransform);
            }
        });
}

void World::tickGameplaySystems(float dt) {
    if (const SceneDef* sc = entityGateway_.activeScene())
        activeTilemap_ = sc->tilemap;
    tickPlatformerControllers(dt);
    tickTopDownControllers(dt);
    tickLinearMovers(dt);
    tickMagneticItems(dt);
    tickSensorOverlapEdges();
}

void World::flushEntityQueues() {
    entityGateway_.flushPendingOperations();
}

void World::snapEntityToGrid(EntityId id, float cellSize) {
    if (cellSize <= 0.f) return;
    Transform transform{};
    if (!entityGateway_.getTransform(id, transform)) return;
    const float cs = cellSize;
    transform.position.x = std::round(transform.position.x / cs) * cs;
    transform.position.y = std::round(transform.position.y / cs) * cs;
    entityGateway_.setTransform(id, transform);
    if (const uint32_t handle = entityGateway_.physicsHandle(id); handle != 0)
        physics_.setPosition(handle, transform.position);
}

void World::moveEntityByOffset(EntityId id, float dx, float dy) {
    Transform transform{};
    if (!entityGateway_.getTransform(id, transform)) return;
    transform.position.x += dx;
    transform.position.y += dy;
    entityGateway_.setTransform(id, transform);
    if (const uint32_t handle = entityGateway_.physicsHandle(id); handle != 0)
        physics_.setPosition(handle, transform.position);
}

bool World::isSpaceFree(float x, float y, float w, float h) const {
    const auto& tm = activeTilemap_;
    if (tm.cols <= 0 || tm.rows <= 0 || tm.tileSize <= 0.f) return true;

    const float ts = tm.tileSize;
    const int c0 = static_cast<int>(std::floor(x / ts));
    const int r0 = static_cast<int>(std::floor(y / ts));
    const int c1 = static_cast<int>(std::floor((x + w) / ts));
    const int r1 = static_cast<int>(std::floor((y + h) / ts));

    for (int r = r0; r <= r1; ++r) {
        for (int c = c0; c <= c1; ++c) {
            if (c < 0 || r < 0 || c >= tm.cols || r >= tm.rows) return false;
            const int idx = r * tm.cols + c;
            if (idx >= static_cast<int>(tm.data.size())) continue;
            const int tid = tm.data[idx];
            if (tid <= 0) continue;
            auto it = tileSolid_.find(tid);
            if (it != tileSolid_.end() && it->second) return false;
        }
    }
    return true;
}

void World::setMovementIntent(EntityId id, float directionX, float directionY) {
    if (id == INVALID_ENTITY) return;
    auto& intent = controlIntents_[id];
    intent.movement = {
        std::clamp(directionX, -1.f, 1.f),
        std::clamp(directionY, -1.f, 1.f)
    };
    intent.hasMovement = true;
}

void World::clearMovementIntent(EntityId id) {
    if (id == INVALID_ENTITY) return;
    auto it = controlIntents_.find(id);
    if (it == controlIntents_.end()) return;
    it->second.hasMovement = false;
    it->second.movement = {};
}

void World::requestJump(EntityId id) {
    if (id == INVALID_ENTITY) return;
    controlIntents_[id].jumpRequested = true;
}

} // namespace ArtCade

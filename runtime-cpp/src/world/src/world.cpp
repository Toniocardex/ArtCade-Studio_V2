#include "../include/world.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/input/include/input.h"
#include "../../modules/variable-manager/include/variable-manager.h"

#include <cmath>
#include <iostream>

namespace ArtCade {

World::World(Modules::RuntimeEntityGateway& gateway,
             Modules::Physics&              ph,
             Modules::VariableManager&      variables)
    : entityGateway_(gateway), physics_(ph), variables_(variables) {}

void World::setGameplayDeps(Modules::Input* input) {
    input_ = input;
}

void World::init(const ProjectDoc& doc) {
    entityGateway_.setPhysics(&physics_);
    entityGateway_.replaceProject(doc.scenes, doc.entities, doc.activeSceneId);

    int created = 0;
    const SceneId sid = entityGateway_.activeSceneId();
    auto sceneIt = doc.scenes.find(sid);
    if (sceneIt == doc.scenes.end()) return;
    const TilemapData& tm = sceneIt->second.tilemap;
    if (tm.cols <= 0 || tm.rows <= 0) return;

    std::unordered_map<int, bool> solid;
    for (const auto& e : doc.tilePalette) solid[e.id] = e.solid;

    const int n = static_cast<int>(tm.data.size());
    for (int r = 0; r < tm.rows; ++r) {
        for (int c = 0; c < tm.cols; ++c) {
            const int idx = r * tm.cols + c;
            if (idx >= n) continue;
            const int id = tm.data[idx];
            if (id <= 0) continue;
            auto si = solid.find(id);
            if (si == solid.end() || !si->second) continue;

            PhysicsComponent pc;
            pc.bodyType         = BodyType::Static;
            pc.collider.shape   = ColliderShape::Rectangle;
            pc.collider.size    = { tm.tileSize, tm.tileSize };
            const uint32_t h = physics_.createBody(INVALID_ENTITY, pc);
            physics_.setPosition(h, {
                c * tm.tileSize + tm.tileSize * 0.5f,
                r * tm.tileSize + tm.tileSize * 0.5f });
            ++created;
        }
    }
    std::cout << "[Tilemap] " << created << " solid collision bodies created\n";
}

void World::shutdown() {
    variables_.clear();
    platformerRt_.clear();
    sensorWasOverlapping_.clear();
}

bool World::loadScene(const SceneId& id) {
    return entityGateway_.loadScene(id);
}

SceneId World::activeSceneId() const {
    return entityGateway_.activeSceneId();
}

void World::syncPhysicsToEntities() {
    for (EntityId id : entityGateway_.activeSceneIds()) {
        auto* e = entityGateway_.get(id);
        if (!e || e->physics.physicsHandle == 0) continue;

        e->transform.position = physics_.getPosition(e->physics.physicsHandle);
        auto vel = physics_.getLinearVelocity(e->physics.physicsHandle);
        e->transform.velocity = vel;
    }
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
    auto* self = entityGateway_.get(id);
    if (!self || self->physics.physicsHandle == 0) return false;

    for (EntityId otherId : entityGateway_.poolByClass(groundClass)) {
        if (otherId == id) continue;
        auto* other = entityGateway_.get(otherId);
        if (!other || other->physics.physicsHandle == 0) continue;
        if (physics_.areOverlapping(self->physics.physicsHandle,
                                  other->physics.physicsHandle))
            return true;
    }
    return false;
}

void World::tickPlatformerControllers(float dt) {
    if (!input_) return;

    for (EntityId id : entityGateway_.activeSceneIds()) {
        EntityDef* e = entityGateway_.get(id);
        if (!e || !e->platformerController) continue;

        const auto& pc = *e->platformerController;
        auto& rt = platformerRt_[id];

        const bool grounded = isGrounded(id, pc.groundClass);
        if (grounded)
            rt.coyoteTimer = pc.coyoteTime;
        else
            rt.coyoteTimer = std::max(0.f, rt.coyoteTimer - dt);

        const bool jumpPressed =
            input_->wasKeyPressed("Space") ||
            input_->wasKeyPressed("KeyW") ||
            input_->wasKeyPressed("ArrowUp");

        if (jumpPressed)
            rt.jumpBufferTimer = pc.jumpBuffer;
        else
            rt.jumpBufferTimer = std::max(0.f, rt.jumpBufferTimer - dt);

        if (e->physics.physicsHandle == 0) continue;

        float vx = 0.f;
        float vy = physics_.getLinearVelocity(e->physics.physicsHandle).y;

        if (input_->isKeyDown("KeyA") || input_->isKeyDown("ArrowLeft"))  vx -= pc.maxSpeed;
        if (input_->isKeyDown("KeyD") || input_->isKeyDown("ArrowRight")) vx += pc.maxSpeed;

        if (rt.jumpBufferTimer > 0.f && rt.coyoteTimer > 0.f) {
            vy = -pc.jumpForce;
            rt.coyoteTimer     = 0.f;
            rt.jumpBufferTimer = 0.f;
        } else if (!grounded) {
            vy += pc.customGravity * dt;
        }

        physics_.setLinearVelocity(e->physics.physicsHandle, { vx, vy });
    }
}

void World::tickSensorOverlapEdges() {
    for (EntityId id : entityGateway_.activeSceneIds()) {
        EntityDef* e = entityGateway_.get(id);
        if (!e || !e->sensor) continue;
        if (e->physics.physicsHandle == 0) continue;

        bool overlapping = false;
        const std::string& target = e->sensor->targetTag;

        for (EntityId otherId : entityGateway_.byTag(target)) {
            if (otherId == id) continue;
            auto* other = entityGateway_.get(otherId);
            if (!other || other->physics.physicsHandle == 0) continue;
            if (physics_.areOverlapping(e->physics.physicsHandle,
                                        other->physics.physicsHandle)) {
                overlapping = true;
                break;
            }
        }

        const bool was = sensorWasOverlapping_[id];
        if (overlapping && !was)
            std::cout << "[Sensor] enter entity " << id << " tag=" << target << "\n";
        else if (!overlapping && was)
            std::cout << "[Sensor] exit entity " << id << " tag=" << target << "\n";

        sensorWasOverlapping_[id] = overlapping;
    }
}

void World::tickGameplaySystems(float dt) {
    tickPlatformerControllers(dt);
}

void World::flushEntityQueues() {
    entityGateway_.flushPendingOperations();
}

} // namespace ArtCade

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
        EntityId otherHit = INVALID_ENTITY;
        const std::string& target = e->sensor->targetTag;

        for (EntityId otherId : entityGateway_.byTag(target)) {
            if (otherId == id) continue;
            auto* other = entityGateway_.get(otherId);
            if (!other || other->physics.physicsHandle == 0) continue;
            if (physics_.areOverlapping(e->physics.physicsHandle,
                                        other->physics.physicsHandle)) {
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
    }
}

void World::tickGameplaySystems(float dt) {
    if (const SceneDef* sc = entityGateway_.activeScene())
        activeTilemap_ = sc->tilemap;
    tickPlatformerControllers(dt);
    tickSensorOverlapEdges();
}

void World::flushEntityQueues() {
    entityGateway_.flushPendingOperations();
}

void World::snapEntityToGrid(EntityId id, float cellSize) {
    if (cellSize <= 0.f) return;
    auto* e = entityGateway_.get(id);
    if (!e) return;
    const float cs = cellSize;
    e->transform.position.x = std::round(e->transform.position.x / cs) * cs;
    e->transform.position.y = std::round(e->transform.position.y / cs) * cs;
    if (e->physics.physicsHandle != 0)
        physics_.setPosition(e->physics.physicsHandle, e->transform.position);
}

void World::moveEntityByOffset(EntityId id, float dx, float dy) {
    auto* e = entityGateway_.get(id);
    if (!e) return;
    e->transform.position.x += dx;
    e->transform.position.y += dy;
    if (e->physics.physicsHandle != 0)
        physics_.setPosition(e->physics.physicsHandle, e->transform.position);
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

} // namespace ArtCade

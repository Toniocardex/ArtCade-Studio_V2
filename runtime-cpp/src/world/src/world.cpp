#include "../include/world.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../modules/renderer/include/renderer.h"

#include <cmath>

namespace ArtCade {

World::World(Modules::RuntimeEntityGateway& gateway,
             Modules::Physics&              ph,
             Modules::VariableManager&      variables)
    : entityGateway_(gateway), physics_(ph), variables_(variables) {}

void World::setGameplayDeps(Modules::Input* /*input*/) {}

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
    clearTilemapPhysics();
    variables_.clear();
    platformerRt_.clear();
    topDownRt_.clear();
    controlIntents_.clear();
    sensorWasOverlapping_.clear();
    sensorEdgeBuffer_.clear();
    activeTilemap_ = TilemapData{};
    tileSolid_.clear();
}

std::vector<SensorEdgeEvent> World::pollSensorEdges() {
    std::vector<SensorEdgeEvent> out;
    out.swap(sensorEdgeBuffer_);
    return out;
}

bool World::loadScene(const SceneId& id) {
    if (!entityGateway_.loadScene(id)) return false;
    clearGameplayRuntimeState();
    rebuildTilemapPhysics();
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

void World::setRenderer(Modules::Renderer* renderer) {
    renderer_ = renderer;
}

void World::tickGameplaySystems(float dt) {
    if (const SceneDef* sc = entityGateway_.activeScene())
        activeTilemap_ = sc->tilemap;
    tickPlatformerControllers(dt);
    tickTopDownControllers(dt);
    tickLinearMovers(dt);
    tickMagneticItems(dt);
    tickHordeMembers(dt);
    tickHealthCooldowns(dt);
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

} // namespace ArtCade

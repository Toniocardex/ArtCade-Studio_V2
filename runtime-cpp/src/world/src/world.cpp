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
    : entityGateway_(gateway), physics_(ph), variables_(variables) {
    // Drop per-entity gameplay caches the moment the gateway destroys an
    // entity. EnTT recycles ids, so without this a fresh entity reusing
    // id N inherits the previous owner's coyote timer / jump buffer /
    // sensor "was overlapping" memory → phantom jumps on respawn,
    // sensor.onEnter mis-fires, etc.
    entityGateway_.setEntityDestroyHandler([this](EntityId id) {
        forgetEntity(id);
        variables_.destroyEntity(id);
    });
    entityGateway_.setEntityCreatedHandler([this](EntityId id, const EntityDef& def) {
        variables_.createEntity(id, def.localVariables, def.localVariableOverrides);
    });
    entityGateway_.setPhysicsTopologyHandler([this] {
        syncTilemapPhysicsWithDynamics();
    });
}

void World::forgetEntity(EntityId id) {
    platformerRt_.erase(id);
    topDownRt_.erase(id);
    controlIntents_.erase(id);
    sensorWasOverlapping_.erase(id);
    if (cameraFollowMode_ == CameraFollowMode::Explicit
        && cameraFollowTarget_ == id) {
        useAutomaticCameraTarget();
    }
}

void World::clearGameplayRuntimeState() {
    platformerRt_.clear();
    topDownRt_.clear();
    controlIntents_.clear();
    sensorWasOverlapping_.clear();
    sensorEdgeBuffer_.clear();
    useAutomaticCameraTarget();
}

void World::applyTilePalette(const std::vector<TilePaletteEntry>& tilePalette) {
    tileMeta_.clear();
    for (const auto& e : tilePalette) {
        if (e.id < 1) continue;
        TileSurfaceMeta m;
        m.blocks      = e.solid;
        m.groundClass = e.groundClass.empty() ? "Ground" : e.groundClass;
        const std::string& kind = e.surfaceKind;
        m.oneWay = (kind == "oneWay" || kind == "OneWay" || kind == "one-way"
                    || kind == "One-Way");
        tileMeta_[e.id] = std::move(m);
    }
}

void World::syncAfterEditorProject(const std::vector<TilePaletteEntry>& tilePalette) {
    applyTilePalette(tilePalette);
    clearGameplayRuntimeState();
    rebuildTilemapPhysics();
}

void World::restoreDesignState(const std::vector<TilePaletteEntry>& tilePalette) {
    syncAfterEditorProject(tilePalette);
}

void World::init(const ProjectDoc& doc) {
    clearGameplayRuntimeState();
    variables_.configureGlobals(doc.globalVariables);
    entityGateway_.setPhysics(&physics_);
    const std::unordered_map<std::string, EntityDef>* typesPtr =
        doc.objectTypes.empty() ? nullptr : &doc.objectTypes;
    entityGateway_.replaceProject(doc.scenes, doc.entities, doc.activeSceneId, typesPtr);

    applyTilePalette(doc.tilePalette);
    activeTilemap_ = TilemapData{};

    rebuildTilemapPhysics();
}

void World::shutdown() {
    // Unregister the destroy hook before anything else: the lambda captures
    // `this`, and if World is destroyed before the gateway any later
    // destroy(id) on the gateway would dereference dangling memory.
    entityGateway_.setEntityDestroyHandler(nullptr);
    entityGateway_.setEntityCreatedHandler(nullptr);
    entityGateway_.setPhysicsTopologyHandler(nullptr);

    clearTilemapPhysics();
    variables_.clear();
    clearGameplayRuntimeState();
    activeTilemap_ = TilemapData{};
    tileMeta_.clear();
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
    // has a live physics handle. PlatformerController owns transform; its
    // collider body is pushed from transform in tickPlatformerControllers.
    entityGateway_.forEachActivePhysicsBody(
        [this](EntityId id, uint32_t handle, Transform& t) {
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;
            t.position = physics_.getPosition(handle);
            t.velocity = physics_.getLinearVelocity(handle);
        });
}

bool World::hasGlobalState(const std::string& key) const {
    return variables_.exists(key);
}

StateValue World::getGlobalState(const std::string& key) const {
    auto v = variables_.get(key);
    if (auto* number = std::get_if<double>(&v)) return StateValue{ static_cast<float>(*number) };
    if (auto* b = std::get_if<bool>(&v))      return StateValue{ *b };
    if (auto* s = std::get_if<std::string>(&v)) return StateValue{ *s };
    return StateValue{ 0 };
}

void World::setGlobalState(const std::string& key, const StateValue& value) {
    if (auto* i = std::get_if<int32_t>(&value)) variables_.set(key, static_cast<double>(*i));
    else if (auto* f = std::get_if<float>(&value)) variables_.set(key, static_cast<double>(*f));
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

bool World::followCameraTarget(EntityId id) {
    Transform transform{};
    if (id == INVALID_ENTITY || !entityGateway_.getTransform(id, transform))
        return false;
    cameraFollowMode_ = CameraFollowMode::Explicit;
    cameraFollowTarget_ = id;
    return true;
}

void World::stopCameraFollow() {
    cameraFollowMode_ = CameraFollowMode::Disabled;
    cameraFollowTarget_ = INVALID_ENTITY;
}

void World::useAutomaticCameraTarget() {
    cameraFollowMode_ = CameraFollowMode::Automatic;
    cameraFollowTarget_ = INVALID_ENTITY;
}

void World::tickGameplaySystems(float dt) {
    if (const SceneDef* sc = entityGateway_.activeScene())
        activeTilemap_ = sc->tilemap;
    // Platformer runs in Application::tickFixedStep after Lua, before physics.step
    // (see FIXED_STEP_CONTRACT).
    tickTopDownControllers(dt);
    tickLinearMovers(dt);
    tickMagneticItems(dt);
    tickHordeMembers(dt);
    tickHealthCooldowns(dt);
    // tickSensorOverlapEdges() intentionally NOT called here — sensor
    // edges must be computed against fresh post-physics positions, so the
    // app driver invokes refreshSensorEdges() after physics->step() and
    // syncPhysicsToEntities(). See Application::tickFixedStep.
}

void World::refreshSensorEdges() {
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

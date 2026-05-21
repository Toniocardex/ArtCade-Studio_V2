#include "../include/runtime-entity-gateway.h"
#include "entity-registry.h"
#include "../../entity-system/include/entity-manager.h"
#include "../../scene-system/include/scene-manager.h"
#include "../../physics/include/physics.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <iostream>

namespace ArtCade::Modules {

namespace {

EntityDef cloneForSpawn(const EntityDef& proto, float x, float y) {
    EntityDef copy = proto;
    copy.id = 0;
    copy.transform.position = { x, y };
    copy.physics.physicsHandle = 0;
    copy.runtime.sceneActive = true;
    if (copy.sprite.alpha <= 0.f)
        copy.sprite.alpha = 1.f;
    return copy;
}

EntityDef minimalSpawnDef(const std::string& cls, float x, float y) {
    EntityDef def;
    def.id = 0;
    def.name = cls;
    def.className = cls;
    def.transform.position = { x, y };
    def.transform.scale = { 1.f, 1.f };
    def.runtime.sceneActive = true;
    return def;
}

} // namespace

RuntimeEntityGateway::RuntimeEntityGateway(EntityManager& em, SceneManager& sm)
    : entityManager_(em),
      sceneManager_(sm),
      registry_(std::make_unique<EntityRegistry>()) {}

RuntimeEntityGateway::~RuntimeEntityGateway() = default;

bool RuntimeEntityGateway::init() { return true; }

void RuntimeEntityGateway::shutdown() {
    pendingDestroy_.clear();
    pendingSpawn_.clear();
    destroyBuffer_.clear();
    registry_->clear();
    classPrototypes_.clear();
    spawnLogCallback_ = nullptr;
    fadePhase_ = FadePhase::None;
}

void RuntimeEntityGateway::setPhysics(Physics* physics) {
    physics_ = physics;
}

void RuntimeEntityGateway::setSpawnLogCallback(SpawnLogCallback cb) {
    spawnLogCallback_ = std::move(cb);
}

bool RuntimeEntityGateway::entityListedInActiveScene(EntityId id) const {
    const SceneDef* scene = sceneManager_.activeScene();
    if (!scene) return false;
    return std::find(scene->entityIds.begin(), scene->entityIds.end(), id)
           != scene->entityIds.end();
}

bool RuntimeEntityGateway::isEntityActiveInScene(EntityId id) const {
    if (!entityManager_.exists(id)) return false;
    return registry_->sceneActive(id);
}

void RuntimeEntityGateway::ensurePhysicsBody(EntityDef& def) {
    if (!physics_) return;
    if (physicsHandle(def.id) != 0) return;

    PhysicsComponent comp{};
    if (!getPhysicsComponent(def.id, comp))
        comp = def.physics;

    const bool hasCollider =
        comp.collider.size.x > 2.f && comp.collider.size.y > 2.f;
    PlatformerControllerComponent platformer{};
    const bool hasPlatformer = getPlatformerController(def.id, platformer);
    if (!hasCollider && !hasPlatformer) return;

    if (!hasCollider) {
        comp.collider.size = { 32.f, 32.f };
        comp.bodyType = BodyType::Dynamic;
    }

    const uint32_t handle = physics_->createBody(def.id, comp);
    if (handle == 0) return;

    setPhysicsComponent(def.id, comp);
    setPhysicsHandle(def.id, handle);
    Transform transform{};
    if (!getTransform(def.id, transform))
        transform = def.transform;
    physics_->setPosition(handle, transform.position);

    SensorComponent sensor{};
    if (getSensor(def.id, sensor))
        physics_->addSensorFixture(handle, sensor);
}

void RuntimeEntityGateway::teardownPhysicsBody(EntityDef& def) {
    const uint32_t handle = physicsHandle(def.id);
    if (!physics_ || handle == 0) return;
    physics_->destroyBody(handle);
    setPhysicsHandle(def.id, 0);
}

void RuntimeEntityGateway::deactivateEntity(EntityId id) {
    EntityDef* e = entityManager_.get(id);
    if (!e) return;
    registry_->setSceneActive(id, false);
    // Compatibility mirror until EntityDef stops carrying runtime flags.
    e->runtime.sceneActive = false;
    SpriteComponent sprite{};
    if (getSprite(id, sprite)) {
        sprite.alpha = 0.f;
        setSprite(id, sprite);
    }
    teardownPhysicsBody(*e);
}

void RuntimeEntityGateway::activateEntity(EntityId id) {
    EntityDef* e = entityManager_.get(id);
    if (!e) return;
    registry_->setSceneActive(id, true);
    // Compatibility mirror until EntityDef stops carrying runtime flags.
    e->runtime.sceneActive = true;
    SpriteComponent sprite{};
    if (getSprite(id, sprite)) {
        sprite.alpha = 1.f;
        setSprite(id, sprite);
    }
    ensurePhysicsBody(*e);
}

void RuntimeEntityGateway::syncSceneActivation() {
    for (EntityId id : allIds()) {
        if (entityListedInActiveScene(id))
            activateEntity(id);
        else
            deactivateEntity(id);
    }
}

EntityId RuntimeEntityGateway::create(const EntityDef& def) {
    EntityDef copy = def;
    copy.physics.physicsHandle = 0;
    const EntityId id = entityManager_.createEntity(copy);

    registry_->touch(id);
    registry_->setSceneActive(id, entityListedInActiveScene(id));
    registry_->setPhysicsHandle(id, 0);
    registry_->setTransform(id, copy.transform);
    registry_->setSprite(id, copy.sprite);
    registry_->setPhysics(id, copy.physics);
    registry_->setSensor(id, copy.sensor);
    registry_->setPlatformer(id, copy.platformerController);
    registry_->setAutoDestroy(id, copy.autoDestroy);
    registry_->setIdentity(id, copy.className, copy.tags);

    EntityDef* e = entityManager_.get(id);
    if (e) {
        e->runtime.sceneActive   = registry_->sceneActive(id);
        e->transform             = copy.transform;
        e->sprite                = copy.sprite;
        e->physics               = copy.physics;
        e->sensor                = copy.sensor;
        e->platformerController  = copy.platformerController;
        e->autoDestroy           = copy.autoDestroy;
    }
    if (e && registry_->sceneActive(id))
        ensurePhysicsBody(*e);
    return id;
}

void RuntimeEntityGateway::rebuildClassPrototypes(
    const std::unordered_map<EntityId, EntityDef>& entityDefs)
{
    classPrototypes_.clear();
    for (const auto& [id, def] : entityDefs) {
        (void)id;
        if (def.className.empty()) continue;
        if (classPrototypes_.find(def.className) == classPrototypes_.end())
            classPrototypes_[def.className] = def;
    }
}

EntityId RuntimeEntityGateway::spawnFromClass(const std::string& className, float x, float y) {
    EntityDef copy;
    auto protoIt = classPrototypes_.find(className);
    if (protoIt != classPrototypes_.end()) {
        copy = cloneForSpawn(protoIt->second, x, y);
    } else {
        const std::vector<EntityId> pool = poolByClass(className);
        const EntityDef* live = nullptr;
        for (EntityId eid : pool) {
            if ((live = entityManager_.get(eid))) break;
        }
        if (live)
            copy = cloneForSpawn(*live, x, y);
        else
            copy = minimalSpawnDef(className, x, y);
    }

    const EntityId id = entityManager_.createEntity(copy);
    registry_->touch(id);
    registry_->setPhysicsHandle(id, 0);
    registry_->setTransform(id, copy.transform);
    registry_->setSprite(id, copy.sprite);
    registry_->setPhysics(id, copy.physics);
    registry_->setSensor(id, copy.sensor);
    registry_->setPlatformer(id, copy.platformerController);
    registry_->setAutoDestroy(id, copy.autoDestroy);
    registry_->setIdentity(id, copy.className, copy.tags);

    if (SceneDef* scene = sceneManager_.activeSceneMutable()) {
        if (std::find(scene->entityIds.begin(), scene->entityIds.end(), id)
            == scene->entityIds.end())
            scene->entityIds.push_back(id);
    }
    activateEntity(id);

    char buf[96];
    std::snprintf(buf, sizeof(buf), "[Spawn] %s #%u at (%.0f, %.0f)",
                  className.c_str(), static_cast<unsigned>(id), x, y);
    const std::string line(buf);
    if (spawnLogCallback_)
        spawnLogCallback_(line);
    else
        std::cout << line << std::endl;

    return id;
}

void RuntimeEntityGateway::destroy(EntityId id) {
    sceneManager_.removeEntityFromAllScenes(id);
    EntityDef* e = entityManager_.get(id);
    if (e) teardownPhysicsBody(*e);
    registry_->erase(id);
    entityManager_.destroyEntity(id);
}

void RuntimeEntityGateway::queueDestroy(EntityId id) {
    if (id == 0) return;
    if (std::find(pendingDestroy_.begin(), pendingDestroy_.end(), id) == pendingDestroy_.end())
        pendingDestroy_.push_back(id);
}

EntityId RuntimeEntityGateway::queueSpawn(const EntityDef& def) {
    pendingSpawn_.push_back(def);
    return def.id != 0 ? def.id : 0;
}

void RuntimeEntityGateway::flushPendingOperations() {
    for (EntityId id : pendingDestroy_) {
        destroyBuffer_.push_back({ id });
        destroy(id);
    }
    pendingDestroy_.clear();

    for (const EntityDef& def : pendingSpawn_)
        create(def);
    pendingSpawn_.clear();
}

bool RuntimeEntityGateway::exists(EntityId id) const {
    return entityManager_.exists(id);
}

EntityDef* RuntimeEntityGateway::get(EntityId id) {
    return entityManager_.get(id);
}

const EntityDef* RuntimeEntityGateway::get(EntityId id) const {
    return entityManager_.get(id);
}

bool RuntimeEntityGateway::getTransform(EntityId id, Transform& out) const {
    if (!entityManager_.exists(id)) return false;
    if (registry_->getTransform(id, out)) return true;
    // Compatibility fallback for legacy setup paths that bypass the registry.
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->transform;
    return true;
}

bool RuntimeEntityGateway::setTransform(EntityId id, const Transform& transform) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    registry_->setTransform(id, transform);
    // Compatibility mirror until EntityDef stops carrying authored/runtime transforms.
    entity->transform = transform;
    return true;
}

bool RuntimeEntityGateway::setTransform(EntityId id, Vec2 position, float rotation, Vec2 scale) {
    Transform transform{};
    if (!getTransform(id, transform)) return false;
    transform.position = position;
    transform.rotation = rotation;
    transform.scale    = scale;
    return setTransform(id, transform);
}

bool RuntimeEntityGateway::getSprite(EntityId id, SpriteComponent& out) const {
    if (!entityManager_.exists(id)) return false;
    if (registry_->getSprite(id, out)) return true;
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->sprite;
    return true;
}

bool RuntimeEntityGateway::setSprite(EntityId id, const SpriteComponent& sprite) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    registry_->setSprite(id, sprite);
    // Compatibility mirror until EntityDef stops carrying authored/runtime sprites.
    entity->sprite = sprite;
    return true;
}

bool RuntimeEntityGateway::getPhysicsComponent(EntityId id, PhysicsComponent& out) const {
    if (!entityManager_.exists(id)) return false;
    if (registry_->getPhysics(id, out)) return true;
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->physics;
    return true;
}

bool RuntimeEntityGateway::setPhysicsComponent(EntityId id, const PhysicsComponent& physics) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    registry_->setPhysics(id, physics);
    // Compatibility mirror until EntityDef stops carrying authored/runtime physics.
    entity->physics = physics;
    return true;
}

bool RuntimeEntityGateway::getSensor(EntityId id, SensorComponent& out) const {
    if (!entityManager_.exists(id)) return false;
    if (registry_->getSensor(id, out)) return true;
    const auto* entity = entityManager_.get(id);
    if (!entity || !entity->sensor) return false;
    out = *entity->sensor;
    return true;
}

bool RuntimeEntityGateway::setSensor(EntityId id, const std::optional<SensorComponent>& sensor) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    registry_->setSensor(id, sensor);
    entity->sensor = sensor;
    return true;
}

bool RuntimeEntityGateway::getPlatformerController(
    EntityId id, PlatformerControllerComponent& out) const
{
    if (!entityManager_.exists(id)) return false;
    if (registry_->getPlatformer(id, out)) return true;
    const auto* entity = entityManager_.get(id);
    if (!entity || !entity->platformerController) return false;
    out = *entity->platformerController;
    return true;
}

bool RuntimeEntityGateway::setPlatformerController(
    EntityId id, const std::optional<PlatformerControllerComponent>& controller)
{
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    registry_->setPlatformer(id, controller);
    entity->platformerController = controller;
    return true;
}

bool RuntimeEntityGateway::getAutoDestroy(EntityId id, AutoDestroyComponent& out) const {
    if (!entityManager_.exists(id)) return false;
    if (registry_->getAutoDestroy(id, out)) return true;
    const auto* entity = entityManager_.get(id);
    if (!entity || !entity->autoDestroy) return false;
    out = *entity->autoDestroy;
    return true;
}

bool RuntimeEntityGateway::setAutoDestroy(
    EntityId id, const std::optional<AutoDestroyComponent>& autoDestroy)
{
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    registry_->setAutoDestroy(id, autoDestroy);
    entity->autoDestroy = autoDestroy;
    return true;
}

uint32_t RuntimeEntityGateway::physicsHandle(EntityId id) const {
    return registry_->physicsHandle(id);
}

bool RuntimeEntityGateway::hasPhysicsBody(EntityId id) const {
    return physicsHandle(id) != 0;
}

void RuntimeEntityGateway::setPhysicsHandle(EntityId id, uint32_t handle) {
    if (!entityManager_.exists(id)) return;
    registry_->setPhysicsHandle(id, handle);
    // Compatibility mirror until PhysicsComponent stops carrying runtime handles.
    if (EntityDef* e = entityManager_.get(id))
        e->physics.physicsHandle = handle;
}

std::vector<EntityId> RuntimeEntityGateway::poolByClass(const std::string& className) const {
    std::vector<EntityId> out;
    for (EntityId id : registry_->idsByClass(className)) {
        if (isEntityActiveInScene(id))
            out.push_back(id);
    }
    return out;
}

size_t RuntimeEntityGateway::poolCount(const std::string& className) const {
    return poolByClass(className).size();
}

std::vector<EntityId> RuntimeEntityGateway::byTag(const std::string& tag) const {
    std::vector<EntityId> out;
    for (EntityId id : registry_->idsByTag(tag)) {
        if (isEntityActiveInScene(id))
            out.push_back(id);
    }
    return out;
}

std::vector<EntityId> RuntimeEntityGateway::allIds() const {
    return registry_->allIds();
}

std::vector<EntityId> RuntimeEntityGateway::activeSceneIds() const {
    const SceneDef* scene = sceneManager_.activeScene();
    if (!scene) return {};
    std::vector<EntityId> out;
    out.reserve(scene->entityIds.size());
    for (EntityId id : scene->entityIds) {
        if (isEntityActiveInScene(id))
            out.push_back(id);
    }
    return out;
}

void RuntimeEntityGateway::registerScenes(
    const std::unordered_map<SceneId, SceneDef>& scenes,
    const std::unordered_map<EntityId, EntityDef>& /*entityDefs*/)
{
    sceneManager_.registerScenes(scenes, {});
}

bool RuntimeEntityGateway::replaceProject(
    const std::unordered_map<SceneId, SceneDef>& scenes,
    const std::unordered_map<EntityId, EntityDef>& entityDefs,
    const SceneId& activeSceneId)
{
    if (physics_)
        physics_->destroyAllBodies();

    entityManager_.clear();
    registry_->clear();
    rebuildClassPrototypes(entityDefs);
    sceneManager_.registerScenes(scenes, entityDefs);
    for (const auto& [id, def] : entityDefs) {
        EntityDef copy = def;
        copy.runtime.sceneActive = false;
        copy.physics.physicsHandle = 0;
        const EntityId runtimeId = entityManager_.createEntity(copy);

        registry_->touch(runtimeId);
        registry_->setSceneActive(runtimeId, false);
        registry_->setPhysicsHandle(runtimeId, 0);
        registry_->setTransform(runtimeId, copy.transform);
        registry_->setSprite(runtimeId, copy.sprite);
        registry_->setPhysics(runtimeId, copy.physics);
        registry_->setSensor(runtimeId, copy.sensor);
        registry_->setPlatformer(runtimeId, copy.platformerController);
        registry_->setAutoDestroy(runtimeId, copy.autoDestroy);
        registry_->setIdentity(runtimeId, copy.className, copy.tags);
    }

    if (!activeSceneId.empty())
        sceneManager_.loadScene(activeSceneId);
    else if (!scenes.empty())
        sceneManager_.loadScene(scenes.begin()->first);

    syncSceneActivation();
    return true;
}

void RuntimeEntityGateway::setTilesets(std::vector<TilesetAsset> tilesets) {
    sceneManager_.setTilesets(std::move(tilesets));
}

bool RuntimeEntityGateway::loadScene(const SceneId& id) {
    if (!sceneManager_.loadScene(id)) return false;
    syncSceneActivation();
    return true;
}

void RuntimeEntityGateway::requestLoadScene(const SceneId& id, float fadeSeconds) {
    if (fadeSeconds <= 0.f) {
        loadScene(id);
        return;
    }
    pendingSceneId_ = id;
    fadeDuration_   = fadeSeconds;
    fadeElapsed_    = 0.f;
    fadePhase_      = FadePhase::Out;
}

void RuntimeEntityGateway::tickSceneTransition(float dt) {
    if (fadePhase_ == FadePhase::None) return;

    fadeElapsed_ += dt;
    const float half = fadeDuration_ * 0.5f;

    if (fadePhase_ == FadePhase::Out) {
        if (fadeElapsed_ >= half) {
            loadScene(pendingSceneId_);
            fadePhase_   = FadePhase::In;
            fadeElapsed_ = 0.f;
        }
    } else if (fadePhase_ == FadePhase::In) {
        if (fadeElapsed_ >= half) {
            fadePhase_ = FadePhase::None;
        }
    }
}

float RuntimeEntityGateway::sceneFadeAlpha() const {
    if (fadePhase_ == FadePhase::None || fadeDuration_ <= 0.f) return 0.f;
    const float half = fadeDuration_ * 0.5f;
    if (half <= 0.f) return 0.f;
    if (fadePhase_ == FadePhase::Out)
        return std::min(1.f, fadeElapsed_ / half);
    return std::max(0.f, 1.f - fadeElapsed_ / half);
}

std::vector<RuntimeEntityGateway::DestroyedEvent>
RuntimeEntityGateway::pollDestroyed() {
    std::vector<DestroyedEvent> out;
    out.swap(destroyBuffer_);
    return out;
}

SceneId RuntimeEntityGateway::activeSceneId() const {
    return sceneManager_.activeSceneId();
}

const SceneDef* RuntimeEntityGateway::activeScene() const {
    return sceneManager_.activeScene();
}

SceneDef* RuntimeEntityGateway::activeSceneMutable() {
    return sceneManager_.activeSceneMutable();
}

void RuntimeEntityGateway::forEachInPool(
    const std::string& className,
    const std::function<void(EntityId, EntityDef&)>& fn)
{
    for (EntityId id : poolByClass(className)) {
        EntityDef* e = entityManager_.get(id);
        if (e) fn(id, *e);
    }
}

} // namespace ArtCade::Modules

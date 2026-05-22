#include "../include/runtime-entity-gateway.h"
#include "entity-registry.h"
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

RuntimeEntityGateway::RuntimeEntityGateway(SceneManager& sm)
    : sceneManager_(sm),
      registry_(std::make_unique<EntityRegistry>()) {}

RuntimeEntityGateway::~RuntimeEntityGateway() = default;

bool RuntimeEntityGateway::init() { return true; }

void RuntimeEntityGateway::shutdown() {
    pendingDestroy_.clear();
    pendingSpawn_.clear();
    destroyBuffer_.clear();
    // Clear while physics is still alive: registry.clear() fires
    // on_destroy<PhysicsHandleComp> for every entity, which frees the
    // matching Box2D bodies. Detach physics afterwards so any stray
    // signal during ~EntityRegistry can't reach a torn-down module.
    registry_->clear();
    registry_->attachPhysicsModule(nullptr);
    lifecycleQueue_.clear();
    classPrototypes_.clear();
    spawnLogCallback_ = nullptr;
    fadePhase_ = FadePhase::None;
}

void RuntimeEntityGateway::setPhysics(Physics* physics) {
    physics_ = physics;
    registry_->attachPhysicsModule(physics);
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
    return registry_->contains(id) && registry_->sceneActive(id);
}

void RuntimeEntityGateway::syncSensorFixture(EntityId id) {
    if (!physics_) return;
    const uint32_t handle = physicsHandle(id);
    if (handle == 0) return;
    SensorComponent sensor{};
    if (getSensor(id, sensor))
        physics_->setSensorFixture(handle, sensor);
    else
        physics_->clearSensorFixture(handle);
}

void RuntimeEntityGateway::ensurePhysicsBody(EntityId id) {
    if (!physics_) return;
    if (physicsHandle(id) != 0) return;

    PhysicsComponent comp{};
    if (!getPhysicsComponent(id, comp))
        return;

    const bool hasCollider =
        comp.collider.size.x > 2.f && comp.collider.size.y > 2.f;
    PlatformerControllerComponent platformer{};
    const bool hasPlatformer = getPlatformerController(id, platformer);
    TopDownControllerComponent topDown{};
    const bool hasTopDown = getTopDownController(id, topDown);
    if (!hasCollider && !hasPlatformer && !hasTopDown) return;

    if (!hasCollider) {
        comp.collider.size = { 32.f, 32.f };
        comp.bodyType = BodyType::Dynamic;
    }
    if (hasTopDown && !hasPlatformer)
        comp.bodyType = BodyType::Kinematic;

    const uint32_t handle = physics_->createBody(id, comp);
    if (handle == 0) return;

    setPhysicsComponent(id, comp);
    setPhysicsHandle(id, handle);
    Transform transform{};
    if (getTransform(id, transform))
        physics_->setPosition(handle, transform.position);

    syncSensorFixture(id);
}

void RuntimeEntityGateway::teardownPhysicsBody(EntityId id) {
    const uint32_t handle = physicsHandle(id);
    if (!physics_ || handle == 0) return;
    physics_->destroyBody(handle);
    setPhysicsHandle(id, 0);
}

void RuntimeEntityGateway::deactivateEntity(EntityId id) {
    if (!registry_->contains(id)) return;
    registry_->setSceneActive(id, false);
    teardownPhysicsBody(id);
}

void RuntimeEntityGateway::activateEntity(EntityId id) {
    if (!registry_->contains(id)) return;
    registry_->setSceneActive(id, true);
    ensurePhysicsBody(id);
}

void RuntimeEntityGateway::syncSceneActivation() {
    for (EntityId id : allIds()) {
        if (entityListedInActiveScene(id))
            activateEntity(id);
        else
            deactivateEntity(id);
    }
}

void RuntimeEntityGateway::applyEntityDefToRegistry(
    EntityId id, const EntityDef& def)
{
    // Order matters: setIdentity is LAST so that the on_construct<Identity>
    // signal observes the fully-populated entity (Transform, Sprite, …)
    // when emitting LifecycleEvent::Spawned. This lets future signal
    // handlers read sibling components without races.
    registry_->setPhysicsHandle(id, 0);
    registry_->setTransform(id, def.transform);
    registry_->setSprite(id, def.sprite);
    registry_->setPhysics(id, def.physics);
    registry_->setSensor(id, def.sensor);
    registry_->setPlatformer(id, def.platformerController);
    registry_->setTopDown(id, def.topDownController);
    registry_->setAutoDestroy(id, def.autoDestroy);
    registry_->setHealth(id, def.health);
    registry_->setIdentity(id, def.className, def.tags);
}

EntityId RuntimeEntityGateway::create(const EntityDef& def) {
    EntityDef copy = def;
    copy.physics.physicsHandle = 0;
    const EntityId id = registry_->allocate(copy.id);
    copy.id = id;

    registry_->setSceneActive(id, entityListedInActiveScene(id));
    applyEntityDefToRegistry(id, copy);

    if (registry_->sceneActive(id))
        ensurePhysicsBody(id);
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
        copy = minimalSpawnDef(className, x, y);
    }

    const EntityId id = registry_->allocate(copy.id);
    copy.id = id;
    applyEntityDefToRegistry(id, copy);

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
    // No explicit teardownPhysicsBody: registry_->erase fires the
    // on_destroy<PhysicsHandleComp> signal which frees the Box2D body
    // (see EntityRegistry::Impl::onPhysicsHandleDestroyed). It also
    // fires on_destroy<Identity>, draining class/tag indices and
    // queueing a LifecycleEvent::Destroyed for Lua.
    registry_->erase(id);
}

void RuntimeEntityGateway::drainLifecycleEvents(
    std::vector<LifecycleEvent>& out)
{
    // First make sure local + registry queues are merged: gateway-level
    // operations (queueDestroy → flushPendingOperations → destroy) already
    // route through the registry signals, so the registry queue is the
    // single source of truth. We keep the gateway-level vector member
    // around for future extension (e.g. non-component lifecycle hooks).
    registry_->drainLifecycleEvents(lifecycleQueue_);
    if (lifecycleQueue_.empty()) return;
    out.insert(out.end(),
               std::make_move_iterator(lifecycleQueue_.begin()),
               std::make_move_iterator(lifecycleQueue_.end()));
    lifecycleQueue_.clear();
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
    return registry_->contains(id);
}

std::string RuntimeEntityGateway::className(EntityId id) const {
    if (!registry_->contains(id)) return {};
    return registry_->className(id);
}

bool RuntimeEntityGateway::getTransform(EntityId id, Transform& out) const {
    return registry_->getTransform(id, out);
}

bool RuntimeEntityGateway::setTransform(EntityId id, const Transform& transform) {
    if (!registry_->contains(id)) return false;
    registry_->setTransform(id, transform);
    if (physics_) {
        const uint32_t handle = physicsHandle(id);
        if (handle != 0)
            physics_->setPosition(handle, transform.position);
    }
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
    return registry_->getSprite(id, out);
}

bool RuntimeEntityGateway::setSprite(EntityId id, const SpriteComponent& sprite) {
    if (!registry_->contains(id)) return false;
    registry_->setSprite(id, sprite);
    return true;
}

bool RuntimeEntityGateway::getPhysicsComponent(EntityId id, PhysicsComponent& out) const {
    return registry_->getPhysics(id, out);
}

bool RuntimeEntityGateway::setPhysicsComponent(EntityId id, const PhysicsComponent& physics) {
    if (!registry_->contains(id)) return false;
    registry_->setPhysics(id, physics);
    return true;
}

bool RuntimeEntityGateway::getSensor(EntityId id, SensorComponent& out) const {
    return registry_->getSensor(id, out);
}

bool RuntimeEntityGateway::setSensor(EntityId id, const std::optional<SensorComponent>& sensor) {
    if (!registry_->contains(id)) return false;
    registry_->setSensor(id, sensor);
    syncSensorFixture(id);
    return true;
}

bool RuntimeEntityGateway::getPlatformerController(
    EntityId id, PlatformerControllerComponent& out) const
{
    return registry_->getPlatformer(id, out);
}

bool RuntimeEntityGateway::setPlatformerController(
    EntityId id, const std::optional<PlatformerControllerComponent>& controller)
{
    if (!registry_->contains(id)) return false;
    registry_->setPlatformer(id, controller);
    return true;
}

bool RuntimeEntityGateway::getTopDownController(
    EntityId id, TopDownControllerComponent& out) const
{
    return registry_->getTopDown(id, out);
}

bool RuntimeEntityGateway::setTopDownController(
    EntityId id, const std::optional<TopDownControllerComponent>& controller)
{
    if (!registry_->contains(id)) return false;
    registry_->setTopDown(id, controller);
    return true;
}

bool RuntimeEntityGateway::getAutoDestroy(EntityId id, AutoDestroyComponent& out) const {
    return registry_->getAutoDestroy(id, out);
}

bool RuntimeEntityGateway::setAutoDestroy(
    EntityId id, const std::optional<AutoDestroyComponent>& autoDestroy)
{
    if (!registry_->contains(id)) return false;
    registry_->setAutoDestroy(id, autoDestroy);
    return true;
}

bool RuntimeEntityGateway::getHealth(EntityId id, HealthComponent& out) const {
    return registry_->getHealth(id, out);
}

bool RuntimeEntityGateway::setHealth(EntityId id,
                                     const std::optional<HealthComponent>& health)
{
    if (!registry_->contains(id)) return false;
    registry_->setHealth(id, health);
    return true;
}

size_t RuntimeEntityGateway::activeSceneEntityCount() const {
    size_t n = 0;
    for (EntityId id : registry_->allIds()) {
        if (isEntityActiveInScene(id)) ++n;
    }
    return n;
}

size_t RuntimeEntityGateway::activePhysicsBodyCount() const {
    size_t n = 0;
    for (EntityId id : registry_->allIds()) {
        if (isEntityActiveInScene(id) && physicsHandle(id) != 0) ++n;
    }
    return n;
}

uint32_t RuntimeEntityGateway::physicsHandle(EntityId id) const {
    return registry_->physicsHandle(id);
}

bool RuntimeEntityGateway::hasPhysicsBody(EntityId id) const {
    return physicsHandle(id) != 0;
}

void RuntimeEntityGateway::setPhysicsHandle(EntityId id, uint32_t handle) {
    if (!registry_->contains(id)) return;
    registry_->setPhysicsHandle(id, handle);
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

void RuntimeEntityGateway::forEachActiveRenderable(
    const ActiveRenderableFn& fn) const
{
    registry_->forEachActiveRenderable(fn);
}

void RuntimeEntityGateway::forEachActivePhysicsBody(
    const ActivePhysicsBodyFn& fn)
{
    registry_->forEachActivePhysicsBody(fn);
}

void RuntimeEntityGateway::forEachActivePlatformer(
    const ActivePlatformerFn& fn) const
{
    registry_->forEachActivePlatformer(fn);
}

void RuntimeEntityGateway::forEachActiveTopDown(
    const ActiveTopDownFn& fn) const
{
    registry_->forEachActiveTopDown(fn);
}

void RuntimeEntityGateway::forEachActiveSensor(
    const ActiveSensorFn& fn) const
{
    registry_->forEachActiveSensor(fn);
}

void RuntimeEntityGateway::forEachActiveAutoDestroy(
    const ActiveAutoDestroyFn& fn)
{
    registry_->forEachActiveAutoDestroy(fn);
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
    // registry_->clear() fires on_destroy<PhysicsHandleComp> for every
    // entity, which calls physics_->destroyBody on each live handle.
    // No explicit destroyAllBodies() is needed — the signal is the
    // single source of truth for Box2D teardown. Keeping a parallel
    // batch call would risk double-free if the wrapper's destroyAll
    // and per-handle destroy interact.
    registry_->clear();
    rebuildClassPrototypes(entityDefs);
    sceneManager_.registerScenes(scenes, entityDefs);
    for (const auto& [id, def] : entityDefs) {
        EntityDef copy = def;
        copy.runtime.sceneActive = false;
        copy.physics.physicsHandle = 0;
        const EntityId runtimeId = registry_->allocate(copy.id);
        copy.id = runtimeId;

        registry_->setSceneActive(runtimeId, false);
        applyEntityDefToRegistry(runtimeId, copy);
    }

    if (!activeSceneId.empty())
        sceneManager_.loadScene(activeSceneId);
    else if (!scenes.empty())
        sceneManager_.loadScene(scenes.begin()->first);

    syncSceneActivation();
    return true;
}

bool RuntimeEntityGateway::updateEntity(EntityId id, const EntityDef& def) {
    if (!exists(id)) return false;

    const bool wasActive = registry_->sceneActive(id);
    const uint32_t oldHandle = physicsHandle(id);
    if (oldHandle != 0)
        teardownPhysicsBody(id);

    EntityDef copy = def;
    copy.id = id;
    copy.physics.physicsHandle = 0;

    applyEntityDefToRegistry(id, copy);
    sceneManager_.upsertEntityDef(id, copy);

    if (!copy.className.empty()) {
        auto it = classPrototypes_.find(copy.className);
        if (it == classPrototypes_.end())
            classPrototypes_[copy.className] = copy;
    }

    if (wasActive) {
        ensurePhysicsBody(id);
        syncSensorFixture(id);
    }
    return true;
}

bool RuntimeEntityGateway::updateSceneSettings(
    const SceneId& sceneId, const SceneDef& patch)
{
    if (!sceneManager_.getScene(sceneId)) return false;
    sceneManager_.patchSceneSettings(sceneId, patch);
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

} // namespace ArtCade::Modules

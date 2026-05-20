#include "../include/runtime-entity-gateway.h"
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
    : entityManager_(em), sceneManager_(sm) {}

bool RuntimeEntityGateway::init()     { return true; }
void RuntimeEntityGateway::shutdown() {
    pendingDestroy_.clear();
    pendingSpawn_.clear();
    destroyBuffer_.clear();
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
    const EntityDef* e = entityManager_.get(id);
    return e && e->runtime.sceneActive;
}

void RuntimeEntityGateway::ensurePhysicsBody(EntityDef& def) {
    if (!physics_) return;
    if (def.physics.physicsHandle != 0) return;

    const bool hasCollider =
        def.physics.collider.size.x > 2.f && def.physics.collider.size.y > 2.f;
    if (!hasCollider && !def.platformerController) return;

    PhysicsComponent comp = def.physics;
    if (!hasCollider) {
        comp.collider.size = { 32.f, 32.f };
        comp.bodyType = BodyType::Dynamic;
    }

    const uint32_t handle = physics_->createBody(def.id, comp);
    if (handle == 0) return;

    def.physics = comp;
    def.physics.physicsHandle = handle;
    physics_->setPosition(handle, def.transform.position);

    if (def.sensor)
        physics_->addSensorFixture(handle, *def.sensor);
}

void RuntimeEntityGateway::teardownPhysicsBody(EntityDef& def) {
    if (!physics_ || def.physics.physicsHandle == 0) return;
    physics_->destroyBody(def.physics.physicsHandle);
    def.physics.physicsHandle = 0;
}

void RuntimeEntityGateway::deactivateEntity(EntityId id) {
    EntityDef* e = entityManager_.get(id);
    if (!e) return;
    e->runtime.sceneActive = false;
    e->sprite.alpha = 0.f;
    teardownPhysicsBody(*e);
}

void RuntimeEntityGateway::activateEntity(EntityId id) {
    EntityDef* e = entityManager_.get(id);
    if (!e) return;
    e->runtime.sceneActive = true;
    e->sprite.alpha = 1.f;
    ensurePhysicsBody(*e);
}

void RuntimeEntityGateway::syncSceneActivation() {
    for (EntityId id : entityManager_.allIds()) {
        if (entityListedInActiveScene(id))
            activateEntity(id);
        else
            deactivateEntity(id);
    }
}

EntityId RuntimeEntityGateway::create(const EntityDef& def) {
    EntityDef copy = def;
    copy.runtime.sceneActive = entityListedInActiveScene(copy.id);
    const EntityId id = entityManager_.createEntity(copy);
    EntityDef* e = entityManager_.get(id);
    if (e && e->runtime.sceneActive)
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
        const std::vector<EntityId> pool = entityManager_.getPool(className);
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
    if (SceneDef* scene = sceneManager_.activeSceneMutable()) {
        auto& ids = scene->entityIds;
        ids.erase(std::remove(ids.begin(), ids.end(), id), ids.end());
    }
    EntityDef* e = entityManager_.get(id);
    if (e) teardownPhysicsBody(*e);
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
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->transform;
    return true;
}

bool RuntimeEntityGateway::setTransform(EntityId id, const Transform& transform) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    entity->transform = transform;
    return true;
}

bool RuntimeEntityGateway::setTransform(EntityId id, Vec2 position, float rotation, Vec2 scale) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    entity->transform.position = position;
    entity->transform.rotation = rotation;
    entity->transform.scale    = scale;
    return true;
}

std::vector<EntityId> RuntimeEntityGateway::poolByClass(const std::string& className) const {
    std::vector<EntityId> out;
    for (EntityId id : entityManager_.getPool(className)) {
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
    for (EntityId id : entityManager_.getByTag(tag)) {
        if (isEntityActiveInScene(id))
            out.push_back(id);
    }
    return out;
}

std::vector<EntityId> RuntimeEntityGateway::allIds() const {
    return entityManager_.allIds();
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
    entityManager_.clear();
    rebuildClassPrototypes(entityDefs);
    sceneManager_.registerScenes(scenes, entityDefs);
    for (const auto& [id, def] : entityDefs) {
        EntityDef copy = def;
        copy.runtime.sceneActive = false;
        entityManager_.createEntity(copy);
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

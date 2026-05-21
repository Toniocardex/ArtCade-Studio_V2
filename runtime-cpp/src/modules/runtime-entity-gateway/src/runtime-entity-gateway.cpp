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
    runtimeState_.clear();
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
    auto it = runtimeState_.find(id);
    return it != runtimeState_.end() && it->second.sceneActive;
}

void RuntimeEntityGateway::ensurePhysicsBody(EntityDef& def) {
    if (!physics_) return;
    if (physicsHandle(def.id) != 0) return;

    PhysicsComponent comp{};
    if (!getPhysicsComponent(def.id, comp))
        comp = def.physics;

    const bool hasCollider =
        comp.collider.size.x > 2.f && comp.collider.size.y > 2.f;
    if (!hasCollider && !def.platformerController) return;

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

    if (def.sensor)
        physics_->addSensorFixture(handle, *def.sensor);
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
    runtimeState_[id].sceneActive = false;
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
    runtimeState_[id].sceneActive = true;
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
    for (EntityId id : entityManager_.allIds()) {
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
    runtimeState_[id].sceneActive = entityListedInActiveScene(id);
    runtimeState_[id].physicsHandle = 0;
    runtimeState_[id].transform = copy.transform;
    runtimeState_[id].sprite = copy.sprite;
    runtimeState_[id].physics = copy.physics;
    EntityDef* e = entityManager_.get(id);
    if (e) {
        e->runtime.sceneActive = runtimeState_[id].sceneActive;
        e->transform = runtimeState_[id].transform;
        e->sprite = runtimeState_[id].sprite;
        e->physics = runtimeState_[id].physics;
    }
    if (e && runtimeState_[id].sceneActive)
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
    runtimeState_[id].physicsHandle = 0;
    runtimeState_[id].transform = copy.transform;
    runtimeState_[id].sprite = copy.sprite;
    runtimeState_[id].physics = copy.physics;
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
    entityManager_.destroyEntity(id);
    runtimeState_.erase(id);
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
    auto it = runtimeState_.find(id);
    if (it != runtimeState_.end()) {
        out = it->second.transform;
        return true;
    }
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->transform; // Compatibility fallback for legacy setup paths.
    return true;
}

bool RuntimeEntityGateway::setTransform(EntityId id, const Transform& transform) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    runtimeState_[id].transform = transform;
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
    auto it = runtimeState_.find(id);
    if (it != runtimeState_.end()) {
        out = it->second.sprite;
        return true;
    }
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->sprite; // Compatibility fallback for legacy setup paths.
    return true;
}

bool RuntimeEntityGateway::setSprite(EntityId id, const SpriteComponent& sprite) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    runtimeState_[id].sprite = sprite;
    // Compatibility mirror until EntityDef stops carrying authored/runtime sprites.
    entity->sprite = sprite;
    return true;
}

bool RuntimeEntityGateway::getPhysicsComponent(EntityId id, PhysicsComponent& out) const {
    if (!entityManager_.exists(id)) return false;
    auto it = runtimeState_.find(id);
    if (it != runtimeState_.end()) {
        out = it->second.physics;
        out.physicsHandle = it->second.physicsHandle;
        return true;
    }
    const auto* entity = entityManager_.get(id);
    if (!entity) return false;
    out = entity->physics; // Compatibility fallback for legacy setup paths.
    return true;
}

bool RuntimeEntityGateway::setPhysicsComponent(EntityId id, const PhysicsComponent& physics) {
    auto* entity = entityManager_.get(id);
    if (!entity) return false;
    PhysicsComponent copy = physics;
    runtimeState_[id].physics = copy;
    runtimeState_[id].physicsHandle = copy.physicsHandle;
    // Compatibility mirror until EntityDef stops carrying authored/runtime physics.
    entity->physics = copy;
    return true;
}

uint32_t RuntimeEntityGateway::physicsHandle(EntityId id) const {
    auto it = runtimeState_.find(id);
    return it != runtimeState_.end() ? it->second.physicsHandle : 0;
}

bool RuntimeEntityGateway::hasPhysicsBody(EntityId id) const {
    return physicsHandle(id) != 0;
}

void RuntimeEntityGateway::setPhysicsHandle(EntityId id, uint32_t handle) {
    if (!entityManager_.exists(id)) return;
    runtimeState_[id].physicsHandle = handle;
    runtimeState_[id].physics.physicsHandle = handle;
    // Compatibility mirror until PhysicsComponent stops carrying runtime handles.
    if (EntityDef* e = entityManager_.get(id))
        e->physics.physicsHandle = handle;
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
    if (physics_)
        physics_->destroyAllBodies();

    entityManager_.clear();
    runtimeState_.clear();
    rebuildClassPrototypes(entityDefs);
    sceneManager_.registerScenes(scenes, entityDefs);
    for (const auto& [id, def] : entityDefs) {
        EntityDef copy = def;
        copy.runtime.sceneActive = false;
        copy.physics.physicsHandle = 0;
        const EntityId runtimeId = entityManager_.createEntity(copy);
        runtimeState_[runtimeId].sceneActive = false;
        runtimeState_[runtimeId].physicsHandle = 0;
        runtimeState_[runtimeId].transform = copy.transform;
        runtimeState_[runtimeId].sprite = copy.sprite;
        runtimeState_[runtimeId].physics = copy.physics;
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

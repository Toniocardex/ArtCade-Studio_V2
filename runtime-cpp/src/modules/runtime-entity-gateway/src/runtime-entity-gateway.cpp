#include "../include/runtime-entity-gateway.h"
#include "../../entity-system/include/entity-manager.h"
#include "../../scene-system/include/scene-manager.h"

namespace ArtCade::Modules {

RuntimeEntityGateway::RuntimeEntityGateway(EntityManager& em, SceneManager& sm)
    : entityManager_(em), sceneManager_(sm) {}

bool RuntimeEntityGateway::init() { return true; }
void RuntimeEntityGateway::shutdown() {}

EntityId RuntimeEntityGateway::create(const EntityDef& def) {
    return entityManager_.createEntity(def);
}

void RuntimeEntityGateway::destroy(EntityId id) {
    entityManager_.destroyEntity(id);
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
    entity->transform.scale = scale;
    return true;
}

std::vector<EntityId> RuntimeEntityGateway::poolByClass(const std::string& className) const {
    return entityManager_.getPool(className);
}

size_t RuntimeEntityGateway::poolCount(const std::string& className) const {
    return entityManager_.poolCount(className);
}

std::vector<EntityId> RuntimeEntityGateway::byTag(const std::string& tag) const {
    return entityManager_.getByTag(tag);
}

std::vector<EntityId> RuntimeEntityGateway::allIds() const {
    return entityManager_.allIds();
}

std::vector<EntityId> RuntimeEntityGateway::activeSceneIds() const {
    const auto* scene = sceneManager_.activeScene();
    return scene ? scene->entityIds : std::vector<EntityId>{};
}

void RuntimeEntityGateway::registerScenes(
    const std::unordered_map<SceneId, SceneDef>& scenes,
    const std::unordered_map<EntityId, EntityDef>& entityDefs)
{
    sceneManager_.registerScenes(scenes, entityDefs);
}

bool RuntimeEntityGateway::replaceProject(
    const std::unordered_map<SceneId, SceneDef>& scenes,
    const std::unordered_map<EntityId, EntityDef>& entityDefs,
    const SceneId& activeSceneId)
{
    entityManager_.clear();
    sceneManager_.registerScenes(scenes, entityDefs);
    for (const auto& [id, def] : entityDefs)
        entityManager_.createEntity(def);

    if (!activeSceneId.empty())
        return sceneManager_.loadScene(activeSceneId);
    if (!scenes.empty())
        return sceneManager_.loadScene(scenes.begin()->first);
    return true;
}

bool RuntimeEntityGateway::loadScene(const SceneId& id) {
    return sceneManager_.loadScene(id);
}

SceneId RuntimeEntityGateway::activeSceneId() const {
    return sceneManager_.activeSceneId();
}

const SceneDef* RuntimeEntityGateway::activeScene() const {
    return sceneManager_.activeScene();
}

void RuntimeEntityGateway::forEachInPool(
    const std::string& className,
    const std::function<void(EntityId, EntityDef&)>& fn)
{
    entityManager_.forEachInPool(className, fn);
}

} // namespace ArtCade::Modules

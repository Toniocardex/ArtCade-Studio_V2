#include "../include/world.h"
#include "../../modules/entity-system/include/entity-manager.h"
#include "../../modules/scene-system/include/scene-manager.h"
#include "../../modules/physics/include/physics.h"

namespace ArtCade {

World::World(Modules::EntityManager& em,
             Modules::SceneManager&  sm,
             Modules::Physics&       ph)
    : entityManager_(em), sceneManager_(sm), physics_(ph) {}

void World::init(const ProjectDoc& doc) {
    sceneManager_.registerScenes(doc.scenes, doc.entities);

    // Spawn all entities into the EntityManager so Lua and the
    // render loop can access them via entityManager_.get(id).
    for (const auto& [id, def] : doc.entities)
        entityManager_.createEntity(def);

    if (!doc.activeSceneId.empty())
        loadScene(doc.activeSceneId);
}

void World::shutdown() {
    globalState_.clear();
}

bool World::loadScene(const SceneId& id) {
    return sceneManager_.loadScene(id);
}

SceneId World::activeSceneId() const {
    return sceneManager_.activeSceneId();
}

void World::syncPhysicsToEntities() {
    for (EntityId id : entityManager_.allIds()) {
        auto* e = entityManager_.get(id);
        if (!e || e->physics.physicsHandle == 0) continue;

        e->transform.position = physics_.getPosition(e->physics.physicsHandle);
        auto vel = physics_.getLinearVelocity(e->physics.physicsHandle);
        e->transform.velocity = vel;
    }
}

StateValue World::getGlobalState(const std::string& key) const {
    auto it = globalState_.find(key);
    return (it != globalState_.end()) ? it->second : StateValue{0};
}

void World::setGlobalState(const std::string& key, const StateValue& value) {
    globalState_[key] = value;
}

std::vector<EntityId> World::activeEntityIds() const {
    const auto* scene = sceneManager_.activeScene();
    if (!scene) return {};
    return scene->entityIds;
}

} // namespace ArtCade

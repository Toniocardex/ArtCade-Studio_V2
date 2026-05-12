#include "../include/world.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"

namespace ArtCade {

World::World(Modules::RuntimeEntityGateway& gateway,
             Modules::Physics&              ph)
    : entityGateway_(gateway), physics_(ph) {}

void World::init(const ProjectDoc& doc) {
    entityGateway_.replaceProject(doc.scenes, doc.entities, doc.activeSceneId);
}

void World::shutdown() {
    globalState_.clear();
}

bool World::loadScene(const SceneId& id) {
    return entityGateway_.loadScene(id);
}

SceneId World::activeSceneId() const {
    return entityGateway_.activeSceneId();
}

void World::syncPhysicsToEntities() {
    for (EntityId id : entityGateway_.allIds()) {
        auto* e = entityGateway_.get(id);
        if (!e || e->physics.physicsHandle == 0) continue;

        e->transform.position = physics_.getPosition(e->physics.physicsHandle);
        auto vel = physics_.getLinearVelocity(e->physics.physicsHandle);
        e->transform.velocity = vel;
    }
}

bool World::hasGlobalState(const std::string& key) const {
    return globalState_.count(key) > 0;
}

StateValue World::getGlobalState(const std::string& key) const {
    auto it = globalState_.find(key);
    return (it != globalState_.end()) ? it->second : StateValue{0};
}

void World::setGlobalState(const std::string& key, const StateValue& value) {
    globalState_[key] = value;
}

std::vector<EntityId> World::activeEntityIds() const {
    return entityGateway_.activeSceneIds();
}

} // namespace ArtCade

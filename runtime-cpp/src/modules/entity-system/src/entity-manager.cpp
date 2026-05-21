#include "../include/entity-manager.h"

#include <utility>

namespace ArtCade::Modules {

bool EntityManager::init() {
    return true;
}

void EntityManager::shutdown() {
    entities_.clear();
}

EntityId EntityManager::createEntity(const EntityDef& def) {
    const EntityId id = (def.id != 0) ? def.id : nextId_;
    if (id >= nextId_) nextId_ = id + 1;

    EntityDef copy = def;
    copy.id = id;
    entities_[id] = std::move(copy);
    return id;
}

void EntityManager::destroyEntity(EntityId id) {
    entities_.erase(id);
}

void EntityManager::clear() {
    entities_.clear();
    nextId_ = 1;
}

bool EntityManager::exists(EntityId id) const {
    return entities_.count(id) > 0;
}

EntityDef* EntityManager::get(EntityId id) {
    auto it = entities_.find(id);
    return (it != entities_.end()) ? &it->second : nullptr;
}

const EntityDef* EntityManager::get(EntityId id) const {
    auto it = entities_.find(id);
    return (it != entities_.end()) ? &it->second : nullptr;
}

std::vector<EntityId> EntityManager::allIds() const {
    std::vector<EntityId> ids;
    ids.reserve(entities_.size());
    for (const auto& [id, _] : entities_)
        ids.push_back(id);
    return ids;
}

} // namespace ArtCade::Modules

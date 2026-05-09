// entity-manager.cpp — stub (Phase 9 implements entity lifecycle)
#include "../include/entity-manager.h"

namespace ArtCade::Modules {

bool EntityManager::init()     { return true; }
void EntityManager::shutdown() { entities_.clear(); classIndex_.clear(); tagIndex_.clear(); }

EntityId EntityManager::createEntity(const EntityDef& def) {
    // Preserve the id from the def if it is non-zero (loaded from project.json).
    // Otherwise assign the next sequential id.
    EntityId id = (def.id != 0) ? def.id : nextId_;
    // Keep nextId_ always one ahead of the highest allocated id.
    if (id >= nextId_) nextId_ = id + 1;
    EntityDef copy = def;
    copy.id = id;
    rebuildIndex(id, copy);
    entities_[id] = std::move(copy);
    return id;
}

void EntityManager::destroyEntity(EntityId id) {
    auto it = entities_.find(id);
    if (it == entities_.end()) return;
    removeFromIndex(id, it->second);
    entities_.erase(it);
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

std::vector<EntityId> EntityManager::getPool(const std::string& className) const {
    auto it = classIndex_.find(className);
    return (it != classIndex_.end()) ? it->second : std::vector<EntityId>{};
}

size_t EntityManager::poolCount(const std::string& className) const {
    auto it = classIndex_.find(className);
    return (it != classIndex_.end()) ? it->second.size() : 0;
}

std::vector<EntityId> EntityManager::getByTag(const std::string& tag) const {
    auto it = tagIndex_.find(tag);
    return (it != tagIndex_.end()) ? it->second : std::vector<EntityId>{};
}

std::vector<EntityId> EntityManager::allIds() const {
    std::vector<EntityId> ids;
    ids.reserve(entities_.size());
    for (auto& [id, _] : entities_) ids.push_back(id);
    return ids;
}

void EntityManager::forEachInPool(const std::string& className,
                                  const std::function<void(EntityId, EntityDef&)>& fn) {
    auto it = classIndex_.find(className);
    if (it == classIndex_.end()) return;
    for (EntityId id : it->second) {
        auto eit = entities_.find(id);
        if (eit != entities_.end()) fn(id, eit->second);
    }
}

void EntityManager::rebuildIndex(EntityId id, const EntityDef& def) {
    classIndex_[def.className].push_back(id);
    for (auto& tag : def.tags) tagIndex_[tag].push_back(id);
}

void EntityManager::removeFromIndex(EntityId id, const EntityDef& def) {
    auto removeId = [id](std::vector<EntityId>& v) {
        v.erase(std::remove(v.begin(), v.end(), id), v.end());
    };
    auto cit = classIndex_.find(def.className);
    if (cit != classIndex_.end()) removeId(cit->second);
    for (auto& tag : def.tags) {
        auto tit = tagIndex_.find(tag);
        if (tit != tagIndex_.end()) removeId(tit->second);
    }
}

} // namespace ArtCade::Modules

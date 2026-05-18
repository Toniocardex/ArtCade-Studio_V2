// scene-manager.cpp — stub (Phase 9 implements scene loading)
#include "../include/scene-manager.h"
#include "../../entity-system/include/entity-manager.h"

namespace ArtCade::Modules {

SceneManager::SceneManager(EntityManager& em) : entityManager_(em) {}

bool SceneManager::init()     { return true; }
void SceneManager::shutdown() { scenes_.clear(); entityDefs_.clear(); }

void SceneManager::registerScenes(
    const std::unordered_map<SceneId, SceneDef>& scenes,
    const std::unordered_map<EntityId, EntityDef>& defs)
{
    scenes_     = scenes;
    entityDefs_ = defs;
}

bool SceneManager::loadScene(const SceneId& id) {
    auto it = scenes_.find(id);
    if (it == scenes_.end()) return false;
    activeId_ = id;
    return true;
}

const SceneDef* SceneManager::activeScene() const {
    return getScene(activeId_);
}

const SceneDef* SceneManager::getScene(const SceneId& id) const {
    auto it = scenes_.find(id);
    return (it != scenes_.end()) ? &it->second : nullptr;
}

SceneDef* SceneManager::activeSceneMutable() {
    auto it = scenes_.find(activeId_);
    return (it != scenes_.end()) ? &it->second : nullptr;
}

} // namespace ArtCade::Modules

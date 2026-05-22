// scene-manager.cpp - scene registry + active-scene selection
#include "../include/scene-manager.h"

#include <algorithm>

namespace ArtCade::Modules {

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

SceneDef* SceneManager::getSceneMutable(const SceneId& id) {
    auto it = scenes_.find(id);
    return (it != scenes_.end()) ? &it->second : nullptr;
}

SceneDef* SceneManager::activeSceneMutable() {
    return getSceneMutable(activeId_);
}

void SceneManager::upsertEntityDef(EntityId id, const EntityDef& def) {
    entityDefs_[id] = def;
}

void SceneManager::patchSceneSettings(const SceneId& id, const SceneDef& patch) {
    auto it = scenes_.find(id);
    if (it == scenes_.end()) return;
    SceneDef& scene = it->second;
    if (patch.worldSize.x > 0.f && patch.worldSize.y > 0.f)
        scene.worldSize = patch.worldSize;
    if (patch.viewportSize.x > 0.f && patch.viewportSize.y > 0.f)
        scene.viewportSize = patch.viewportSize;
    scene.backgroundColor = patch.backgroundColor;
    if (!patch.name.empty())
        scene.name = patch.name;
}

void SceneManager::removeEntityFromAllScenes(EntityId id) {
    for (auto& [sceneId, scene] : scenes_) {
        (void)sceneId;
        auto& ids = scene.entityIds;
        ids.erase(std::remove(ids.begin(), ids.end(), id), ids.end());
    }
}

} // namespace ArtCade::Modules

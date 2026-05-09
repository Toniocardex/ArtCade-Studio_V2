#pragma once

#include "../engine/types.h"
#include <unordered_map>
#include <string>

namespace ArtCade {

/**
 * SceneManager: Manages scene loading and switching
 *
 * Handles scene transitions and maintains scene definitions.
 */
class SceneManager {
public:
    SceneManager();
    ~SceneManager();

    void init();
    void shutdown();

    // Scene management
    void loadScene(const SceneId& sceneId, const std::unordered_map<SceneId, SceneDef>& sceneDefinitions);
    bool setActiveScene(const SceneId& sceneId);

    SceneId getActiveSceneId() const { return activeSceneId_; }
    SceneDef* getActiveScene();
    const SceneDef* getActiveScene() const;

    // Scene queries
    const SceneDef* getScene(const SceneId& id) const;

private:
    std::unordered_map<SceneId, SceneDef> loadedScenes_;
    SceneId activeSceneId_;
};

} // namespace ArtCade

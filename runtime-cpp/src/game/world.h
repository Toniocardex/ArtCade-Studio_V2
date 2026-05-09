#pragma once

#include "entity-manager.h"
#include "scene-manager.h"
#include "../engine/types.h"
#include <glm/glm.hpp>

namespace ArtCade {

/**
 * World: Main game state container
 *
 * Holds active scene, entities, and global state.
 * Orchestrates entity manager and scene manager.
 */
class World {
public:
    World();
    ~World();

    void init(const ProjectDoc& projectDoc);
    void shutdown();

    // Scene management
    bool loadScene(const SceneId& sceneId);
    SceneId getActiveSceneId() const;
    const SceneDef* getActiveScene() const;

    // Entity access
    EntityManager& getEntityManager() { return entityManager_; }
    const EntityManager& getEntityManager() const { return entityManager_; }

    // Global state
    GlobalStateValue getGlobalState(const std::string& key) const;
    void setGlobalState(const std::string& key, const GlobalStateValue& value);

    // Update active scene entities
    void updateActiveScene();

    // Get all entities in active scene
    std::vector<EntityId> getActiveSceneEntities() const;

private:
    EntityManager entityManager_;
    SceneManager sceneManager_;
    GlobalState globalState_;
    ProjectDoc projectDoc_;
};

} // namespace ArtCade

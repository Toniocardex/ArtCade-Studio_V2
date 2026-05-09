#pragma once

#include "../../core/types.h"
#include <string>

namespace ArtCade::Modules {
    class EntityManager;
    class SceneManager;
    class Physics;
}

namespace ArtCade {

/**
 * World — game-state orchestrator (Layer 3).
 *
 * Sits above individual modules; gives Lua API a single consistent place
 * to read/write state without knowing which module owns the data.
 *
 * Dependencies injected via constructor (no god-context stored long-term).
 */
class World {
public:
    World(Modules::EntityManager& entityManager,
          Modules::SceneManager&  sceneManager,
          Modules::Physics&       physics);

    // Initialise from a loaded project document
    void init(const ProjectDoc& doc);
    void shutdown();

    // Scene control
    bool    loadScene(const SceneId& id);
    SceneId activeSceneId() const;

    // Per-frame: sync physics positions back into entity transforms
    void syncPhysicsToEntities();

    // Global state (key-value store shared across scenes)
    bool       hasGlobalState(const std::string& key) const;
    StateValue getGlobalState(const std::string& key) const;
    void       setGlobalState(const std::string& key, const StateValue& value);

    // Convenience
    std::vector<EntityId> activeEntityIds() const;

private:
    Modules::EntityManager& entityManager_;
    Modules::SceneManager&  sceneManager_;
    Modules::Physics&       physics_;
    GlobalState             globalState_;
};

} // namespace ArtCade

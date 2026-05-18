#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <vector>
#include <utility>

namespace ArtCade::Modules {

class EntityManager;   // forward — SceneManager uses it to populate entities

/**
 * SceneManager — scene switching and entity population.
 *
 * On loadScene() it reads the SceneDef from the ProjectDoc,
 * clears the EntityManager, and spawns the scene's entity list.
 */
class SceneManager final : public IModule {
public:
    explicit SceneManager(EntityManager& entityManager);

    bool init() override;
    void shutdown() override;

    // Register all scenes from the ProjectDoc
    void registerScenes(const std::unordered_map<SceneId, SceneDef>& scenes,
                        const std::unordered_map<EntityId, EntityDef>& entityDefs);

    // Activate a scene (clears entities, spawns scene's entity list)
    bool loadScene(const SceneId& id);

    SceneId           activeSceneId()     const { return activeId_; }
    const SceneDef*   activeScene()       const;
    const SceneDef*   getScene(const SceneId& id) const;
    // Phase F2: mutable access for in-scene tile painting.
    SceneDef*         activeSceneMutable();

    // Phase F3: project-level tileset assets (spritesheets). Set at startup
    // from the ProjectDoc and refreshed on editor hot-reload so the render
    // path always sees the current tilesets.
    void setTilesets(std::vector<TilesetAsset> tilesets) {
        tilesets_ = std::move(tilesets);
    }
    const std::vector<TilesetAsset>& tilesets() const { return tilesets_; }

private:
    EntityManager&                               entityManager_;
    std::unordered_map<SceneId, SceneDef>        scenes_;
    std::unordered_map<EntityId, EntityDef>      entityDefs_;
    SceneId                                      activeId_;
    std::vector<TilesetAsset>                    tilesets_;   // Phase F3
};

} // namespace ArtCade::Modules

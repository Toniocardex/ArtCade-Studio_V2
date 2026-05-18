#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <functional>
#include <vector>

namespace ArtCade::Modules {

class EntityManager;
class SceneManager;

/**
 * RuntimeEntityGateway is the migration point between the current
 * EntityManager/SceneManager storage and the future EnTT registry.
 */
class RuntimeEntityGateway final : public IModule {
public:
    RuntimeEntityGateway(EntityManager& entityManager, SceneManager& sceneManager);

    bool init() override;
    void shutdown() override;

    EntityId create(const EntityDef& def);
    void destroy(EntityId id);
    bool exists(EntityId id) const;

    EntityDef* get(EntityId id);
    const EntityDef* get(EntityId id) const;

    bool getTransform(EntityId id, Transform& out) const;
    bool setTransform(EntityId id, const Transform& transform);
    bool setTransform(EntityId id, Vec2 position, float rotation, Vec2 scale);

    std::vector<EntityId> poolByClass(const std::string& className) const;
    size_t poolCount(const std::string& className) const;
    std::vector<EntityId> byTag(const std::string& tag) const;
    std::vector<EntityId> allIds() const;
    std::vector<EntityId> activeSceneIds() const;

    void registerScenes(const std::unordered_map<SceneId, SceneDef>& scenes,
                        const std::unordered_map<EntityId, EntityDef>& entityDefs);
    bool replaceProject(const std::unordered_map<SceneId, SceneDef>& scenes,
                        const std::unordered_map<EntityId, EntityDef>& entityDefs,
                        const SceneId& activeSceneId);
    bool loadScene(const SceneId& id);
    SceneId activeSceneId() const;
    const SceneDef* activeScene() const;
    SceneDef*       activeSceneMutable();   // Phase F2: in-scene tile painting

    void forEachInPool(const std::string& className,
                       const std::function<void(EntityId, EntityDef&)>& fn);

private:
    EntityManager& entityManager_;
    SceneManager& sceneManager_;
};

} // namespace ArtCade::Modules

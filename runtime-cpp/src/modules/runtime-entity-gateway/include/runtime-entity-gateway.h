#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <functional>
#include <unordered_map>
#include <vector>

namespace ArtCade::Modules {

using SpawnLogCallback = std::function<void(const std::string&)>;

class EntityManager;
class SceneManager;
class Physics;

/**
 * RuntimeEntityGateway is the migration point between the current
 * EntityManager/SceneManager storage and the future EnTT registry.
 */
class RuntimeEntityGateway final : public IModule {
public:
    RuntimeEntityGateway(EntityManager& entityManager, SceneManager& sceneManager);

    bool init() override;
    void shutdown() override;

    void setPhysics(Physics* physics);

    /** Editor console (or tests): called after each spawnFromClass with "[Spawn] …" line. */
    void setSpawnLogCallback(SpawnLogCallback cb);

    EntityId create(const EntityDef& def);
    /** Spawn a new instance: clone first project entity of that class, else pool, else minimal. */
    EntityId spawnFromClass(const std::string& className, float x, float y);
    void destroy(EntityId id);
    void queueDestroy(EntityId id);
    EntityId queueSpawn(const EntityDef& def);
    void flushPendingOperations();

    bool exists(EntityId id) const;

    EntityDef* get(EntityId id);
    const EntityDef* get(EntityId id) const;

    bool getTransform(EntityId id, Transform& out) const;
    bool setTransform(EntityId id, const Transform& transform);
    bool setTransform(EntityId id, Vec2 position, float rotation, Vec2 scale);

    uint32_t physicsHandle(EntityId id) const;
    bool hasPhysicsBody(EntityId id) const;
    void setPhysicsHandle(EntityId id, uint32_t handle);

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
    void setTilesets(std::vector<TilesetAsset> tilesets);

    bool loadScene(const SceneId& id);
    /** Fade to black, load scene, fade in. fadeSeconds <= 0 loads immediately. */
    void requestLoadScene(const SceneId& id, float fadeSeconds = 0.f);
    void tickSceneTransition(float dt);
    /** 0 = no overlay, 1 = full black (for fade). */
    float sceneFadeAlpha() const;

    struct DestroyedEvent { EntityId entityId = 0; };
    std::vector<DestroyedEvent> pollDestroyed();

    void syncSceneActivation();
    SceneId activeSceneId() const;
    const SceneDef* activeScene() const;
    SceneDef*       activeSceneMutable();

    void forEachInPool(const std::string& className,
                       const std::function<void(EntityId, EntityDef&)>& fn);

    bool isEntityActiveInScene(EntityId id) const;

private:
    EntityManager& entityManager_;
    SceneManager& sceneManager_;
    Physics*       physics_ = nullptr;

    struct RuntimeEntityState {
        bool sceneActive = false;
        uint32_t physicsHandle = 0;
    };

    std::unordered_map<EntityId, RuntimeEntityState> runtimeState_;
    std::vector<EntityId> pendingDestroy_;
    std::vector<EntityDef> pendingSpawn_;
    std::vector<DestroyedEvent> destroyBuffer_;

    SceneId  pendingSceneId_;
    float    fadeDuration_  = 0.f;
    float    fadeElapsed_   = 0.f;
    enum class FadePhase { None, Out, In };
    FadePhase fadePhase_     = FadePhase::None;

    /** First EntityDef seen per className when the project is loaded (spawn template). */
    std::unordered_map<std::string, EntityDef> classPrototypes_;

    SpawnLogCallback spawnLogCallback_;

    void rebuildClassPrototypes(const std::unordered_map<EntityId, EntityDef>& entityDefs);
    bool entityListedInActiveScene(EntityId id) const;
    void deactivateEntity(EntityId id);
    void activateEntity(EntityId id);
    void ensurePhysicsBody(EntityDef& def);
    void teardownPhysicsBody(EntityDef& def);
};

} // namespace ArtCade::Modules

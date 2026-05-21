#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <functional>
#include <memory>
#include <optional>
#include <unordered_map>
#include <vector>

namespace ArtCade::Modules {

using SpawnLogCallback = std::function<void(const std::string&)>;

class SceneManager;
class Physics;
class EntityRegistry;

/**
 * RuntimeEntityGateway — single owner of runtime entity state.
 *
 * Component data and entity ids live in EntityRegistry (private to this
 * module, backed by entt::registry). Scene metadata (entityIds per scene,
 * tilesets) lives in SceneManager. Authoring still uses EntityDef as a DTO
 * when loading project JSON; runtime queries use the typed get/set* API
 * below, not raw EntityDef pointers.
 */
class RuntimeEntityGateway final : public IModule {
public:
    explicit RuntimeEntityGateway(SceneManager& sceneManager);
    ~RuntimeEntityGateway() override; // unique_ptr<EntityRegistry> needs complete type at destruction.

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

    bool getTransform(EntityId id, Transform& out) const;
    bool setTransform(EntityId id, const Transform& transform);
    bool setTransform(EntityId id, Vec2 position, float rotation, Vec2 scale);
    bool getSprite(EntityId id, SpriteComponent& out) const;
    bool setSprite(EntityId id, const SpriteComponent& sprite);
    bool getPhysicsComponent(EntityId id, PhysicsComponent& out) const;
    bool setPhysicsComponent(EntityId id, const PhysicsComponent& physics);
    bool getSensor(EntityId id, SensorComponent& out) const;
    bool setSensor(EntityId id, const std::optional<SensorComponent>& sensor);
    bool getPlatformerController(EntityId id, PlatformerControllerComponent& out) const;
    bool setPlatformerController(EntityId id, const std::optional<PlatformerControllerComponent>& controller);
    bool getAutoDestroy(EntityId id, AutoDestroyComponent& out) const;
    bool setAutoDestroy(EntityId id, const std::optional<AutoDestroyComponent>& autoDestroy);

    uint32_t physicsHandle(EntityId id) const;
    bool hasPhysicsBody(EntityId id) const;
    void setPhysicsHandle(EntityId id, uint32_t handle);

    std::vector<EntityId> poolByClass(const std::string& className) const;
    size_t poolCount(const std::string& className) const;
    std::vector<EntityId> byTag(const std::string& tag) const;
    std::vector<EntityId> allIds() const;
    std::vector<EntityId> activeSceneIds() const;

    // ---- System visitors (EnTT-backed, deterministic insertion order) ----
    //
    // Prefer these over `for (id : activeSceneIds()) { getX(id); getY(id); }`:
    // one pass through the registry, typed try_get for the required
    // components, callback only fires when all components are present.
    // Order is stable across runs (Lua reproducibility).

    using ActiveRenderableFn = std::function<void(
        EntityId, const Transform&, const SpriteComponent&)>;
    void forEachActiveRenderable(const ActiveRenderableFn& fn) const;

    using ActivePhysicsBodyFn = std::function<void(
        EntityId, uint32_t handle, Transform&)>;
    void forEachActivePhysicsBody(const ActivePhysicsBodyFn& fn);

    using ActivePlatformerFn = std::function<void(
        EntityId, const PlatformerControllerComponent&)>;
    void forEachActivePlatformer(const ActivePlatformerFn& fn) const;

    using ActiveSensorFn = std::function<void(
        EntityId, const SensorComponent&)>;
    void forEachActiveSensor(const ActiveSensorFn& fn) const;

    using ActiveAutoDestroyFn = std::function<void(
        EntityId, AutoDestroyComponent&)>;
    void forEachActiveAutoDestroy(const ActiveAutoDestroyFn& fn);

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

    // Drain entity lifecycle events (Spawned / Destroyed) queued by the
    // registry signals. Called once per frame by the main loop, then
    // routed to Lua handlers registered via lifecycle.onSpawn/onDestroy.
    // Order: stable within a frame, matches the order signals fired
    // (i.e. insertion order for Spawned, deterministic for Destroyed
    // when called through flushPendingOperations).
    void drainLifecycleEvents(std::vector<LifecycleEvent>& out);

    void syncSceneActivation();
    SceneId activeSceneId() const;
    const SceneDef* activeScene() const;
    SceneDef*       activeSceneMutable();

    bool isEntityActiveInScene(EntityId id) const;

private:
    SceneManager&  sceneManager_;
    Physics*       physics_ = nullptr;

    /** EnTT-backed storage (entity-registry.cpp). PIMPL keeps entt headers
     *  out of this public include; gateway methods delegate here. */
    std::unique_ptr<EntityRegistry> registry_;

    std::vector<EntityId>        pendingDestroy_;
    std::vector<EntityDef>       pendingSpawn_;
    std::vector<DestroyedEvent>  destroyBuffer_;
    std::vector<LifecycleEvent>  lifecycleQueue_;

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
    void ensurePhysicsBody(EntityId id);
    void teardownPhysicsBody(EntityId id);
    /** Copy every EntityDef field into the registry under `id`. Single
     *  place that defines the EntityDef → component mapping; used by
     *  create(), spawnFromClass() and replaceProject() to keep them
     *  in lockstep when new components are added. */
    void applyEntityDefToRegistry(EntityId id, const EntityDef& def);
};

} // namespace ArtCade::Modules

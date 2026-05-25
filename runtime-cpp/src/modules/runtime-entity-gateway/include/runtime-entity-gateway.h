#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::Modules {

using SpawnLogCallback = std::function<void(const std::string&)>;

// Synchronous notification fired by destroy(id) BEFORE the registry erase.
// Used by upstream owners (e.g. World) to drop per-entity gameplay caches
// keyed by EntityId so a recycled id doesn't inherit the previous owner's
// state (coyote timer, sensor "was overlapping", etc.).
using EntityDestroyHandler = std::function<void(EntityId)>;

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

    /** Fired synchronously from destroy(id) before the entity is erased. */
    void setEntityDestroyHandler(EntityDestroyHandler cb);

    EntityId create(const EntityDef& def);
    /** Spawn a new instance: clone first project entity of that class, else pool, else minimal. */
    EntityId spawnFromClass(const std::string& className, float x, float y);
    void destroy(EntityId id);
    void queueDestroy(EntityId id);
    EntityId queueSpawn(const EntityDef& def);
    void flushPendingOperations();

    bool exists(EntityId id) const;
    std::string className(EntityId id) const;

    bool getTransform(EntityId id, Transform& out) const;
    bool setTransform(EntityId id, const Transform& transform);
    bool setTransform(EntityId id, Vec2 position, float rotation, Vec2 scale);
    bool getSprite(EntityId id, SpriteComponent& out) const;
    bool setSprite(EntityId id, const SpriteComponent& sprite);
    bool getPhysicsComponent(EntityId id, PhysicsComponent& out) const;
    bool setPhysicsComponent(EntityId id, const PhysicsComponent& physics);
    bool getSensor(EntityId id, SensorComponent& out) const;
    bool setSensor(EntityId id, const std::optional<SensorComponent>& sensor);
    bool getSolid(EntityId id, SolidComponent& out) const;
    bool setSolid(EntityId id, const std::optional<SolidComponent>& solid);
    bool getPlatformerController(EntityId id, PlatformerControllerComponent& out) const;
    bool setPlatformerController(EntityId id, const std::optional<PlatformerControllerComponent>& controller);
    bool getTopDownController(EntityId id, TopDownControllerComponent& out) const;
    bool setTopDownController(EntityId id, const std::optional<TopDownControllerComponent>& controller);
    bool getLinearMover(EntityId id, LinearMoverComponent& out) const;
    bool setLinearMover(EntityId id, const std::optional<LinearMoverComponent>& mover);
    bool getCameraTarget(EntityId id, CameraTargetComponent& out) const;
    bool setCameraTarget(EntityId id, const std::optional<CameraTargetComponent>& target);
    bool getMagneticItem(EntityId id, MagneticItemComponent& out) const;
    bool setMagneticItem(EntityId id, const std::optional<MagneticItemComponent>& item);
    bool getHordeMember(EntityId id, HordeMemberComponent& out) const;
    bool setHordeMember(EntityId id, const std::optional<HordeMemberComponent>& horde);
    bool getAutoDestroy(EntityId id, AutoDestroyComponent& out) const;
    bool setAutoDestroy(EntityId id, const std::optional<AutoDestroyComponent>& autoDestroy);

    bool getHealth(EntityId id, HealthComponent& out) const;
    bool setHealth(EntityId id, const std::optional<HealthComponent>& health);
    /** Apply damage when not in i-frames; returns false if blocked or no health. */
    bool applyDamage(EntityId id, float amount);

    /** Count entities with SceneActiveTag (profiler / diagnostics). */
    size_t activeSceneEntityCount() const;
    /** Count active-scene entities with a live physics handle. */
    size_t activePhysicsBodyCount() const;

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

    using ActiveTopDownFn = std::function<void(
        EntityId, const TopDownControllerComponent&)>;
    void forEachActiveTopDown(const ActiveTopDownFn& fn) const;

    using ActiveLinearMoverFn = std::function<void(
        EntityId, const LinearMoverComponent&)>;
    void forEachActiveLinearMover(const ActiveLinearMoverFn& fn) const;

    using ActiveCameraTargetFn = std::function<void(
        EntityId, const CameraTargetComponent&)>;
    void forEachActiveCameraTarget(const ActiveCameraTargetFn& fn) const;

    using ActiveMagneticItemFn = std::function<void(
        EntityId, const MagneticItemComponent&)>;
    void forEachActiveMagneticItem(const ActiveMagneticItemFn& fn) const;

    using ActiveHordeMemberFn = std::function<void(
        EntityId, const HordeMemberComponent&)>;
    void forEachActiveHordeMember(const ActiveHordeMemberFn& fn) const;

    using ActiveSensorFn = std::function<void(
        EntityId, const SensorComponent&)>;
    void forEachActiveSensor(const ActiveSensorFn& fn) const;

    using ActiveSolidFn = std::function<void(
        EntityId, const SolidComponent&)>;
    void forEachActiveSolid(const ActiveSolidFn& fn) const;

    using ActiveAutoDestroyFn = std::function<void(
        EntityId, AutoDestroyComponent&)>;
    void forEachActiveAutoDestroy(const ActiveAutoDestroyFn& fn);

    using ActiveHealthFn = std::function<void(EntityId, HealthComponent&)>;
    void forEachActiveHealth(const ActiveHealthFn& fn);

    /** Design-time "visible in game" flag (editor may still draw the sprite). */
    bool visibleInGame(EntityId id) const;
    /** Enter PLAY: hide sprites for entities marked invisible in the project. */
    void applyDesignVisibilityForPlay();
    /** Return to EDIT: restore sprite alpha from the project snapshot. */
    void restoreDesignVisibilityForEdit();

    using ActiveHiddenInGameFn = std::function<void(
        EntityId, const Transform&, const PhysicsComponent&)>;
    void forEachActiveHiddenInGame(const ActiveHiddenInGameFn& fn) const;

    void registerScenes(const std::unordered_map<SceneId, SceneDef>& scenes,
                        const std::unordered_map<EntityId, EntityDef>& entityDefs);
    bool replaceProject(const std::unordered_map<SceneId, SceneDef>& scenes,
                        const std::unordered_map<EntityId, EntityDef>& entityDefs,
                        const SceneId& activeSceneId);
    /** Apply a single EntityDef without clearing the registry (editor sync). */
    bool updateEntity(EntityId id, const EntityDef& def);
    /** Patch scene viewport/world/background on the active project snapshot. */
    bool updateSceneSettings(const SceneId& sceneId, const SceneDef& patch);
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

    SpawnLogCallback     spawnLogCallback_;
    EntityDestroyHandler destroyHandler_;

    void rebuildClassPrototypes(const std::unordered_map<EntityId, EntityDef>& entityDefs);
    bool entityListedInActiveScene(EntityId id) const;
    void deactivateEntity(EntityId id);
    void activateEntity(EntityId id);
    void ensurePhysicsBody(EntityId id);
    void teardownPhysicsBody(EntityId id);
    void rebuildPhysicsBodyIfActive(EntityId id);
    void syncSensorFixture(EntityId id);
    /** Copy every EntityDef field into the registry under `id`. Single
     *  place that defines the EntityDef → component mapping; used by
     *  create(), spawnFromClass() and replaceProject() to keep them
     *  in lockstep when new components are added. */
    void applyEntityDefToRegistry(EntityId id, const EntityDef& def);
};

} // namespace ArtCade::Modules

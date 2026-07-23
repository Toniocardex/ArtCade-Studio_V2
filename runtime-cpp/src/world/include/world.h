#pragma once

#include "../../core/types.h"
#include "../../modules/collision/include/collision_world.h"
#include <string>
#include <functional>
#include <unordered_map>
#include <vector>

namespace ArtCade::Modules {
    class RuntimeEntityGateway;
    class SceneLifecycleService;
    class Physics;
    class VariableManager;
    class Renderer;
    class SpriteAnimator;
}

namespace ArtCade {

class World;
struct PlatformerControllerComponent;
struct TopDownControllerComponent;

namespace WorldInternal {
void stepPlatformerController(World& world,
                              EntityId id,
                              const PlatformerControllerComponent& pc,
                              float dt);
void stepTopDownController(World& world,
                           EntityId id,
                           const TopDownControllerComponent& tc,
                           float dt);
} // namespace WorldInternal

/**
 * World — game-state orchestrator (Layer 3).
 *
 * Global blackboard: VariableManager (Lua state.* / save.*).
 * Scene activation: SceneLifecycleService (when wired) or gateway fallback.
 */
class World {
public:
    World(Modules::RuntimeEntityGateway& entityGateway,
          Modules::Physics&              physics,
          Modules::VariableManager&      variables);

    /** Non-owning; set by Application so loadScene routes through lifecycle. */
    void setSceneLifecycleService(Modules::SceneLifecycleService* lifecycle);

    void setRenderer(Modules::Renderer* renderer);
    void setSpriteAnimator(Modules::SpriteAnimator* animator);
    void setEntityDestroyedHandler(std::function<void(EntityId)> handler);

    void init(const ProjectDoc& doc);
    /** After editor_load_project: refresh tile collisions + gameplay runtime maps. */
    void syncAfterEditorProject(const std::vector<TilePaletteEntry>& tilePalette);
    /** Preview STOP: reset global state + gameplay maps without reloading Lua. */
    void restoreDesignState(const std::vector<TilePaletteEntry>& tilePalette);
    void shutdown();

    /** Clears per-scene gameplay caches after SceneLifecycleService commits a load. */
    void onSceneActivated();

    bool    loadScene(const SceneId& id);
    SceneId activeSceneId() const;

    void syncPhysicsToEntities();
    void tickGameplaySystems(float dt);
    /** Platformer owns Transform; runs before physics.step. Kinematic collider
     *  bodies are pushed from Transform each tick — not pulled by syncPhysics. */
    void tickPlatformerControllers(float dt);
    /** Refresh collision enter/stay/exit contacts after physics updates. */
    void refreshCollisionEvents();
    /** Follow exactly one camera target. Automatic mode selects the lowest active id. */
    void tickCameraTargets(float dt);
    /** Override CameraTargetComponent selection until stop/useAutomatic is called. */
    bool followCameraTarget(EntityId id);
    /** Disable automatic and explicit camera following without moving the camera. */
    void stopCameraFollow();
    /** Return to deterministic CameraTargetComponent selection. */
    void useAutomaticCameraTarget();
    /** Runtime camera position, available even for headless/editor presentation. */
    Vec2 cameraCenter() const { return cameraCenter_; }
    /** Count down AutoDestroy lifespans and queue destroys (call before flush). */
    void tickAutoDestroy(float dt);
    void flushEntityQueues();

    bool       hasGlobalState(const std::string& key) const;
    StateValue getGlobalState(const std::string& key) const;
    void       setGlobalState(const std::string& key, const StateValue& value);

    std::vector<EntityId> activeEntityIds() const;

    void rebuildCollisionWorld();
    bool collisionOverlap(EntityId a, EntityId b) const;
    EntityId firstCollisionTouching(EntityId id, const CollisionWorld::Filter& filter) const;
    /** Number of active runtime collision shapes, useful for debug overlays/tests. */
    size_t collisionShapeCount() const;
    /** Read-only runtime collision shapes generated from entities and tilemaps. */
    const std::vector<CollisionWorld::ShapeRef>& collisionShapes() const;
    /** Read-only collision events computed during the latest collision refresh. */
    const std::vector<CollisionWorld::ContactEvent>& collisionEvents() const;
    /** Return current-frame collision events involving id, normalized so id is self. */
    std::vector<CollisionWorld::ContactEvent> collisionEventsFor(
        EntityId id,
        const std::string& kind,
        const CollisionWorld::Filter& filter) const;
    /** Fast predicate for event gates such as Logic Board enter/exit triggers. */
    bool hasCollisionEvent(
        EntityId id,
        const std::string& kind,
        const CollisionWorld::Filter& filter) const;
    CollisionWorld::RaycastResult collisionRaycast(
        const Vec2& from,
        const Vec2& to,
        const CollisionWorld::Filter& filter = {}) const;
    bool collisionGrounded(EntityId id) const;
    void resolveKinematicCollisionBody(
        EntityId id,
        Transform& transform,
        const Transform& beforeMove,
        float& horizontalVelocity,
        float& verticalVelocity) const;

    void snapEntityToGrid(EntityId id, float cellSize);
    void moveEntityByOffset(EntityId id, float dx, float dy);
    bool isSpaceFree(float x, float y, float w, float h) const;
    /** True when entity has PlatformerController and its feet touch solid collision. */
    bool isPlatformerGrounded(EntityId id) const;
    /**
     * True when airborne (not grounded, not climbing) and vertical velocity is
     * downward (+Y down). Rising after a jump is false.
     */
    bool isPlatformerFalling(EntityId id) const;

    /** Canonical Logic Runtime operations over materialized world state. */
    bool isActiveEntity(EntityId id) const;
    bool isObjectType(EntityId id, const ObjectTypeId& expected) const;
    bool requestDestroy(EntityId id);
    bool playAnimationClip(EntityId id, const AssetId& animationAssetId,
                           const std::string& clipId);
    bool stopAnimation(EntityId id);
    bool setAnimationPlaybackSpeed(EntityId id, float speed);

    void setMovementIntent(EntityId id, float directionX, float directionY);
    void clearMovementIntent(EntityId id);
    /** Starts a new physical-input frame: clears ephemeral movement intents
     *  (Platformer, Top Down, simple movers). Jump requests are preserved. */
    void clearFrameMovementIntents();
    /** @deprecated Prefer clearFrameMovementIntents(); kept as a Top Down alias. */
    void clearTopDownMovementContributions();
    /** Adds a bounded Top Down direction contribution for the current input frame. */
    void addTopDownMovementContribution(EntityId id, Vec2 direction);
    void requestJump(EntityId id);
    /** Apply movement intent on entities without Platformer/TopDown (Logic Board default). */
    void tickSimpleMovementIntents(float dt);

    friend void WorldInternal::stepPlatformerController(
        World&, EntityId, const PlatformerControllerComponent&, float);
    friend void WorldInternal::stepTopDownController(
        World&, EntityId, const TopDownControllerComponent&, float);

private:
    Modules::RuntimeEntityGateway& entityGateway_;
    Modules::Physics&              physics_;
    Modules::VariableManager&      variables_;

    struct PlatformerRt {
        float coyoteTimer     = 0.f;
        float jumpBufferTimer = 0.f;
        Vec2  velocity        = {};
        /** Previous-frame jump intent; used to arm buffer only on rising edge. */
        bool jumpPendingPrev  = false;
        /** Consecutive frames raw isGrounded() was true/false (hysteresis). */
        int groundedFrames    = 0;
        int airborneFrames    = 0;
        /** True while the body is attached to a ladder (gravity suspended). */
        bool climbing         = false;
    };
    std::unordered_map<EntityId, PlatformerRt> platformerRt_;

    struct TopDownRt {
        Vec2 velocity;
    };
    std::unordered_map<EntityId, TopDownRt> topDownRt_;

    struct ControlIntent {
        Vec2 movement;
        bool hasMovement   = false;
        bool jumpRequested = false;
    };
    std::unordered_map<EntityId, ControlIntent> controlIntents_;

    CollisionWorld::World              collisionWorld_;
    std::vector<CollisionWorld::ContactEvent> collisionEvents_;
    std::vector<PhysicsLayerDef>       physicsLayers_;

    TilemapData  activeTilemap_;
    std::unordered_map<int, TileSurfaceMeta> tileMeta_;

    void applyTilePalette(const std::vector<TilePaletteEntry>& tilePalette);

    void clearGameplayRuntimeState();
    /** Drop per-entity gameplay caches when the gateway destroys entity id. */
    void forgetEntity(EntityId id);

    void tickTopDownControllers(float dt);
    void tickLinearMovers(float dt);
    void tickMagneticItems(float dt);
    void tickHordeMembers(float dt);

    enum class CameraFollowMode {
        Automatic,
        Explicit,
        Disabled,
    };
    CameraFollowMode cameraFollowMode_ = CameraFollowMode::Automatic;
    EntityId cameraFollowTarget_ = INVALID_ENTITY;
    Vec2 cameraCenter_{};

    Modules::Renderer* renderer_ = nullptr;
    Modules::SpriteAnimator* spriteAnimator_ = nullptr;
    std::function<void(EntityId)> entityDestroyedHandler_;
    Modules::SceneLifecycleService* lifecycle_ = nullptr;
};

} // namespace ArtCade

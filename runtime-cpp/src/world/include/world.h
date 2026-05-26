#pragma once

#include "../../core/types.h"
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::Modules {
    class RuntimeEntityGateway;
    class Physics;
    class VariableManager;
    class Renderer;
}

namespace ArtCade {

/** One sensor overlap edge detected this frame (consumed via pollSensorEdges). */
struct SensorEdgeEvent {
    EntityId    entityId = INVALID_ENTITY;
    EntityId    otherId  = INVALID_ENTITY;
    std::string targetTag;
    bool        enter    = false;
};

/**
 * World — game-state orchestrator (Layer 3).
 *
 * Global blackboard: VariableManager (Lua state.* / save.*).
 * Scene activation: RuntimeEntityGateway::syncSceneActivation on loadScene.
 */
class World {
public:
    World(Modules::RuntimeEntityGateway& entityGateway,
          Modules::Physics&              physics,
          Modules::VariableManager&      variables);

    void setRenderer(Modules::Renderer* renderer);

    void init(const ProjectDoc& doc);
    /** After editor_load_project: refresh tile collisions + gameplay runtime maps. */
    void syncAfterEditorProject(const std::vector<TilePaletteEntry>& tilePalette);
    /** Preview STOP: reset global state + gameplay maps without reloading Lua. */
    void restoreDesignState(const std::vector<TilePaletteEntry>& tilePalette);
    void shutdown();

    bool    loadScene(const SceneId& id);
    SceneId activeSceneId() const;

    void syncPhysicsToEntities();
    void tickGameplaySystems(float dt);
    /** Compute sensor begin/end edges from CURRENT physics positions. Must
     *  be called by the app driver AFTER physics->step + syncPhysics, so
     *  Lua callbacks fire on this frame's overlaps (no 1-frame lag). */
    void refreshSensorEdges();
    /** Smooth-follow active CameraTargetComponent entities on the Renderer. */
    void tickCameraTargets(float dt);
    /** Count down AutoDestroy lifespans and queue destroys (call before flush). */
    void tickAutoDestroy(float dt);
    void flushEntityQueues();

    bool       hasGlobalState(const std::string& key) const;
    StateValue getGlobalState(const std::string& key) const;
    void       setGlobalState(const std::string& key, const StateValue& value);

    std::vector<EntityId> activeEntityIds() const;

    /** Drain and clear sensor enter/exit events queued since last poll. */
    std::vector<SensorEdgeEvent> pollSensorEdges();

    void snapEntityToGrid(EntityId id, float cellSize);
    void moveEntityByOffset(EntityId id, float dx, float dy);
    bool isSpaceFree(float x, float y, float w, float h) const;
    /** True when entity has PlatformerController and overlaps its groundClass. */
    bool isPlatformerGrounded(EntityId id) const;

    void setMovementIntent(EntityId id, float directionX, float directionY);
    void clearMovementIntent(EntityId id);
    void requestJump(EntityId id);

private:
    Modules::RuntimeEntityGateway& entityGateway_;
    Modules::Physics&              physics_;
    Modules::VariableManager&      variables_;

    struct PlatformerRt {
        float coyoteTimer     = 0.f;
        float jumpBufferTimer = 0.f;
        Vec2  velocity        = {};
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

    /** Sensor overlap memory: entityId -> was overlapping target last frame. */
    std::unordered_map<EntityId, bool> sensorWasOverlapping_;
    std::vector<SensorEdgeEvent>       sensorEdgeBuffer_;

    TilemapData  activeTilemap_;
    std::unordered_map<int, bool> tileSolid_;
    std::vector<uint32_t>         tilePhysicsHandles_;

    void clearTilemapPhysics();
    void rebuildTilemapPhysics();
    void clearGameplayRuntimeState();
    /** Drop per-entity gameplay caches when the gateway destroys entity id. */
    void forgetEntity(EntityId id);

    bool isGrounded(EntityId id, const std::string& groundClass) const;
    void tickPlatformerControllers(float dt);
    void tickTopDownControllers(float dt);
    void tickLinearMovers(float dt);
    void tickMagneticItems(float dt);
    void tickHordeMembers(float dt);
    void tickHealthCooldowns(float dt);
    void tickSensorOverlapEdges();

    Modules::Renderer* renderer_ = nullptr;
};

} // namespace ArtCade

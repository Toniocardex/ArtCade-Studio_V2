#pragma once

#include "../../core/types.h"
#include <string>
#include <unordered_map>

namespace ArtCade::Modules {
    class RuntimeEntityGateway;
    class Physics;
    class Input;
    class VariableManager;
}

namespace ArtCade {

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

    void setGameplayDeps(Modules::Input* input);

    void init(const ProjectDoc& doc);
    void shutdown();

    bool    loadScene(const SceneId& id);
    SceneId activeSceneId() const;

    void syncPhysicsToEntities();
    void tickGameplaySystems(float dt);
    void flushEntityQueues();

    bool       hasGlobalState(const std::string& key) const;
    StateValue getGlobalState(const std::string& key) const;
    void       setGlobalState(const std::string& key, const StateValue& value);

    std::vector<EntityId> activeEntityIds() const;

private:
    Modules::RuntimeEntityGateway& entityGateway_;
    Modules::Physics&              physics_;
    Modules::VariableManager&      variables_;
    Modules::Input*                input_ = nullptr;

    struct PlatformerRt {
        float coyoteTimer     = 0.f;
        float jumpBufferTimer = 0.f;
    };
    std::unordered_map<EntityId, PlatformerRt> platformerRt_;

    /** Sensor overlap memory: entityId -> was overlapping target last frame. */
    std::unordered_map<EntityId, bool> sensorWasOverlapping_;

    bool isGrounded(EntityId id, const std::string& groundClass) const;
    void tickPlatformerControllers(float dt);
    void tickSensorOverlapEdges();
};

} // namespace ArtCade

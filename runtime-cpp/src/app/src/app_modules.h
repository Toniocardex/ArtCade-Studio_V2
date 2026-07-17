#pragma once

#include "../include/app.h"

#include "../../modules/asset-system/include/asset-loader.h"
#include "../../modules/audio/include/audio.h"
#include "../../modules/camera-manager/include/camera-manager.h"
#include "../../modules/dialog/include/dialog-manager.h"
#include "../../modules/event-bus/include/event-bus.h"
#include "../../modules/game-api/include/game-api.h"
#include "../../modules/game-state/include/game-state-manager.h"
#include "../../modules/input/include/input.h"
#include "../../modules/lua-runtime/include/lua-host.h"
#include "../../modules/logic-runtime/include/logic-runtime.h"
#include "../../modules/script-runtime/include/script-runtime.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/presentation/include/editor_viewport_service.h"
#include "../../modules/renderer/include/renderer.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/save-load/include/save-load-manager.h"
#include "../../modules/scene-system/include/scene-manager.h"
#include "../../modules/scene-system/include/scene-mutation-service.h"
#include "../../modules/scene-system/include/scene-lifecycle-service.h"
#include "../../modules/sprite-animator/include/sprite-animator.h"
#include "../../modules/texture-manager/include/texture-manager.h"
#include "../../modules/time/include/time-manager.h"
#include "../../modules/tween-manager/include/tween-manager.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../world/include/world.h"

#include <cmath>
#include <functional>
#include <memory>
#include <set>
#include <string>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace ArtCade {

class RuntimeLogicHostAdapter final : public Logic::ILogicRuntimeHost {
public:
    using SpawnInstaller = std::function<bool(EntityId)>;

    RuntimeLogicHostAdapter(Modules::RuntimeEntityGateway& gateway, Modules::Audio& audio)
        : gateway_(gateway), audio_(audio) {}
    /** World is constructed after this adapter; wired in once available. */
    void setWorld(World* world) { world_ = world; }
    void setVariableManager(Modules::VariableManager* variables) { variables_ = variables; }
    void setInput(Modules::Input* input) { input_ = input; }
    void setPhysics(Modules::Physics* physics) { physics_ = physics; }
    void setSpawnInstaller(SpawnInstaller installer) { spawnInstaller_ = std::move(installer); }

    bool setVisible(EntityId owner, bool value) override {
        return gateway_.setRuntimeVisible(owner, value);
    }
    bool setPosition(EntityId owner, Vec2 value) override {
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.position = value;
        return gateway_.setTransform(owner, transform);
    }
    bool translate(EntityId owner, Vec2 delta) override {
        if (!std::isfinite(delta.x) || !std::isfinite(delta.y)) return false;
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.position.x += delta.x;
        transform.position.y += delta.y;
        return gateway_.setTransform(owner, transform);
    }
    bool setRotation(EntityId owner, float radians) override {
        if (!std::isfinite(radians)) return false;
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.rotation = radians;
        return gateway_.setTransform(owner, transform);
    }
    bool rotateBy(EntityId owner, float deltaRadians) override {
        if (!std::isfinite(deltaRadians)) return false;
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.rotation += deltaRadians;
        return gateway_.setTransform(owner, transform);
    }
    bool setScale(EntityId owner, Vec2 scale) override {
        if (!std::isfinite(scale.x) || !std::isfinite(scale.y)
            || scale.x <= 0.f || scale.y <= 0.f) {
            return false;
        }
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.scale = scale;
        return gateway_.setTransform(owner, transform);
    }
    bool isGrounded(EntityId owner) override {
        return world_ && world_->isPlatformerGrounded(owner);
    }
    bool requestPlatformerMove(EntityId owner, float axis) override {
        PlatformerControllerComponent platformer{};
        if (!world_ || !std::isfinite(axis)
            || !gateway_.getPlatformerController(owner, platformer)) return false;
        world_->setMovementIntent(owner, axis, 0.f);
        return true;
    }
    bool requestPlatformerJump(EntityId owner) override {
        PlatformerControllerComponent platformer{};
        if (!world_ || !gateway_.getPlatformerController(owner, platformer)) return false;
        world_->requestJump(owner);
        return true;
    }
    bool isObjectType(EntityId entity, const ObjectTypeId& expected) override {
        return world_ && world_->isObjectType(entity, expected);
    }
    bool requestDestroy(EntityId owner) override {
        return world_ && world_->requestDestroy(owner);
    }
    bool playAnimationClip(EntityId owner, const AssetId& animationAssetId,
                           const std::string& clipId) override {
        return world_ && world_->playAnimationClip(owner, animationAssetId, clipId);
    }
    bool stopAnimation(EntityId owner) override {
        return world_ && world_->stopAnimation(owner);
    }
    bool setAnimationPlaybackSpeed(EntityId owner, float speed) override {
        return world_ && world_->setAnimationPlaybackSpeed(owner, speed);
    }
    bool playSound(EntityId owner, const AssetId& audioAssetId, float volume) override {
        return world_ && world_->isActiveEntity(owner)
            && audio_.playResolvedAsset(audioAssetId, volume);
    }
    bool setStateNumber(const GameVariableId& id, double value) override {
        if (!variables_) return false;
        return variables_->setGlobal(id, value).accepted();
    }
    bool addStateNumber(const GameVariableId& id, double delta) override {
        if (!variables_) return false;
        return variables_->addNumber(id, delta).accepted();
    }
    bool toggleStateBoolean(const GameVariableId& id) override {
        if (!variables_) return false;
        return variables_->toggleBoolean(id).accepted();
    }
    std::optional<double> getStateNumber(const GameVariableId& id) const override {
        if (!variables_) return std::nullopt;
        return variables_->tryGetNumber(id);
    }
    bool setVelocity(EntityId owner, Vec2 velocity) override {
        if (!std::isfinite(velocity.x) || !std::isfinite(velocity.y)) return false;
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.velocity = velocity;
        if (!gateway_.setTransform(owner, transform)) return false;
        const uint32_t handle = gateway_.physicsHandle(owner);
        if (handle != 0 && physics_) physics_->setLinearVelocity(handle, velocity);
        return true;
    }
    bool isKeyDown(LogicKey key) override {
        return input_ && input_->isKeyDown(Logic::logicInputCode(key));
    }
    EntityId spawnObjectType(EntityId owner, const ObjectTypeId& objectTypeId,
                             float x, float y) override {
        if (!world_ || !world_->isActiveEntity(owner) || objectTypeId.empty())
            return INVALID_ENTITY;
        if (!std::isfinite(x) || !std::isfinite(y)) return INVALID_ENTITY;
        const EntityId spawned = gateway_.spawnFromClass(objectTypeId, x, y);
        if (spawned == INVALID_ENTITY) return INVALID_ENTITY;
        // Installer must succeed when present; otherwise destroy the orphan and fail.
        if (spawnInstaller_ && !spawnInstaller_(spawned)) {
            gateway_.destroy(spawned);
            return INVALID_ENTITY;
        }
        return spawned;
    }

private:
    Modules::RuntimeEntityGateway& gateway_;
    Modules::Audio& audio_;
    World* world_ = nullptr;
    Modules::VariableManager* variables_ = nullptr;
    Modules::Input* input_ = nullptr;
    Modules::Physics* physics_ = nullptr;
    SpawnInstaller spawnInstaller_;
};

static_assert(!std::is_abstract_v<RuntimeLogicHostAdapter>,
              "RuntimeLogicHostAdapter must implement every ILogicRuntimeHost method");

/** Internal ownership table shared only by Application implementation units. */
struct Application::Modules {
    std::unique_ptr<ArtCade::Presentation::EditorViewportService> editorViewport;
    std::unique_ptr<ArtCade::Modules::Renderer> renderer;
    std::unique_ptr<ArtCade::Modules::Physics> physics;
    std::unique_ptr<ArtCade::Modules::Input> input;
    std::unique_ptr<ArtCade::Modules::Audio> audio;
    std::unique_ptr<ArtCade::Modules::LuaHost> luaHost;
    std::unique_ptr<RuntimeLogicHostAdapter> logicHost;
    std::unique_ptr<ArtCade::Logic::LogicRuntime> logicRuntime;
    std::unordered_map<EntityId, ArtCade::Logic::ScopeToken> logicScopes;
    std::unordered_set<ObjectTypeId> logicObjectTypes;
    std::unique_ptr<ArtCade::Scripts::ScriptRuntime> scriptRuntime;
    std::unordered_map<AssetId, ArtCade::Scripts::ScriptProgram> scriptPrograms;
    std::unordered_map<ObjectTypeId, std::vector<ScriptAttachmentDef>> scriptAttachments;
    std::set<std::pair<EntityId, EntityId>> activeGameplayCollisionPairs;
    std::unique_ptr<ArtCade::Modules::SceneManager> sceneManager;
    std::unique_ptr<ArtCade::Modules::SceneMutationService> sceneMutation;
    std::unique_ptr<ArtCade::Modules::SceneLifecycleService> sceneLifecycle;
    std::unique_ptr<ArtCade::Modules::RuntimeEntityGateway> entityGateway;
    std::unique_ptr<ArtCade::Modules::AssetLoader> assetLoader;
    std::unique_ptr<ArtCade::Modules::GameAPI> gameAPI;
    std::unique_ptr<World> world;

    std::unique_ptr<ArtCade::Modules::TimeManager> timeManager;
    std::unique_ptr<ArtCade::Modules::EventBus> eventBus;
    std::unique_ptr<ArtCade::Modules::VariableManager> variableManager;
    std::unique_ptr<ArtCade::Modules::GameStateManager> gameStateManager;
    std::unique_ptr<ArtCade::Modules::TextureManager> textureManager;
    std::unique_ptr<ArtCade::Modules::SpriteAnimator> spriteAnimator;
    std::unique_ptr<ArtCade::Modules::CameraManager> cameraManager;
    std::unique_ptr<ArtCade::Modules::TweenManager> tweenManager;
    std::unique_ptr<ArtCade::Modules::SaveLoadManager> saveLoadManager;
    std::unique_ptr<ArtCade::Modules::DialogManager> dialogManager;
};

} // namespace ArtCade

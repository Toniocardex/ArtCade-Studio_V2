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
#include "../../modules/layer-manager/include/layer-manager.h"
#include "../../modules/lua-runtime/include/lua-host.h"
#include "../../modules/logic-runtime/include/logic-runtime.h"
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

#include <memory>
#include <unordered_set>
#include <vector>

namespace ArtCade {

class RuntimeLogicHostAdapter final : public Logic::ILogicRuntimeHost {
public:
    explicit RuntimeLogicHostAdapter(Modules::RuntimeEntityGateway& gateway)
        : gateway_(gateway) {}
    bool setVisible(EntityId owner, bool value) override {
        return gateway_.setRuntimeVisible(owner, value);
    }
    bool setPosition(EntityId owner, Vec2 value) override {
        Transform transform{};
        if (!gateway_.getTransform(owner, transform)) return false;
        transform.position = value;
        return gateway_.setTransform(owner, transform);
    }
private:
    Modules::RuntimeEntityGateway& gateway_;
};

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
    std::vector<ArtCade::Logic::ScopeToken> logicScopes;
    std::unordered_set<ObjectTypeId> logicObjectTypes;
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
    std::unique_ptr<ArtCade::Modules::LayerManager> layerManager;
    std::unique_ptr<ArtCade::Modules::CameraManager> cameraManager;
    std::unique_ptr<ArtCade::Modules::TweenManager> tweenManager;
    std::unique_ptr<ArtCade::Modules::SaveLoadManager> saveLoadManager;
    std::unique_ptr<ArtCade::Modules::DialogManager> dialogManager;
};

} // namespace ArtCade

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
#include "../../modules/physics/include/physics.h"
#include "../../modules/presentation/include/editor_viewport_service.h"
#include "../../modules/renderer/include/renderer.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/save-load/include/save-load-manager.h"
#include "../../modules/scene-system/include/scene-manager.h"
#include "../../modules/sprite-animator/include/sprite-animator.h"
#include "../../modules/texture-manager/include/texture-manager.h"
#include "../../modules/time/include/time-manager.h"
#include "../../modules/tween-manager/include/tween-manager.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../world/include/world.h"

#include <memory>

namespace ArtCade {

/** Internal ownership table shared only by Application implementation units. */
struct Application::Modules {
    std::unique_ptr<ArtCade::Presentation::EditorViewportService> editorViewport;
    std::unique_ptr<ArtCade::Modules::Renderer> renderer;
    std::unique_ptr<ArtCade::Modules::Physics> physics;
    std::unique_ptr<ArtCade::Modules::Input> input;
    std::unique_ptr<ArtCade::Modules::Audio> audio;
    std::unique_ptr<ArtCade::Modules::LuaHost> luaHost;
    std::unique_ptr<ArtCade::Modules::SceneManager> sceneManager;
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

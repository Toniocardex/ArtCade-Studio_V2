#pragma once

#include "../../core/types.h"
#include "editor-overlay-renderer.h"

#include <unordered_map>
#include <vector>

namespace ArtCade {

namespace Modules {
class Renderer;
class SpriteAnimator;
class RuntimeEntityGateway;
class VariableManager;
class SceneManager;
class TimeManager;
}

struct SceneFrameContext {
    Modules::Renderer* renderer = nullptr;
    Modules::SpriteAnimator* spriteAnimator = nullptr;
    Modules::RuntimeEntityGateway* entityGateway = nullptr;
    Modules::VariableManager* variableManager = nullptr;
    Modules::SceneManager* sceneManager = nullptr;
    Modules::TimeManager* timeManager = nullptr;
    const SceneDef* activeScene = nullptr;
    EditorOverlayState overlay{};
    std::vector<EntityId>* selectedEntityIds = nullptr;
    const std::unordered_map<std::string, TilesetAsset>* tilesets = nullptr;
    const std::unordered_map<int, Vec4>* tileColors = nullptr;
    float sceneFadeAlpha = 0.f;
};

} // namespace ArtCade

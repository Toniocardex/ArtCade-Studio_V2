#include "artcade/editor_core/editor_core.h"
#include "scene_layer_support.h"

#include <algorithm>
#include <memory>
#include <utility>

namespace ArtCade::EditorCore {
using namespace SceneLayerSupport;

bool EditorCoordinator::addSceneLayer(std::string &out_layer_id, std::string &error_message)
{
    if (!m_has_project) { error_message = "No project open"; return false; }
    SceneDef *scene = activeScene();
    if (!scene) { error_message = "No active scene"; return false; }

    const std::string layer_id = allocate_layer_id(*scene);
    const std::string name = next_available_layer_name(*scene);
    std::size_t insert_index = scene->layers.size();
    const std::size_t active_index = sceneLayerIndex(*scene, m_active_layer_id);
    if (active_index != static_cast<std::size_t>(-1)) {
        insert_index = active_index + 1;
    }

    auto command = std::make_unique<AddSceneLayerCommand>(
        m_doc.activeSceneId, layer_id, name, insert_index);
    AddSceneLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied()) { error_message = "Failed to add layer"; return false; }
    bumpRevision();
    m_active_layer_id = layer_id;
    out_layer_id = layer_id;
    return true;
}

bool EditorCoordinator::renameSceneLayer(const std::string &layer_id,
                                         const std::string &new_name,
                                         std::string &error_message)
{
    if (!m_has_project) { error_message = "No project open"; return false; }
    SceneDef *scene = activeScene();
    if (!scene) { error_message = "No active scene"; return false; }
    const std::string trimmed = trim_whitespace(new_name);
    if (trimmed.empty()) { error_message = "Layer name cannot be empty"; return false; }
    const SceneLayerDef *layer = findSceneLayer(*scene, layer_id);
    if (!layer) { error_message = "Layer not found"; return false; }
    const std::string current = layer->name.empty() ? layer->id : layer->name;
    if (current == trimmed) return true;
    if (name_taken_case_insensitive(*scene, trimmed, layer_id)) {
        error_message = "A layer with this name already exists in the scene";
        return false;
    }

    auto command = std::make_unique<RenameSceneLayerCommand>(
        m_doc.activeSceneId, layer_id, trimmed);
    RenameSceneLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied()) { error_message = "Failed to rename layer"; return false; }
    bumpRevision();
    return true;
}

bool EditorCoordinator::setDefaultSceneLayer(const std::string &layer_id,
                                             std::string &error_message)
{
    if (!m_has_project) { error_message = "No project open"; return false; }
    SceneDef *scene = activeScene();
    if (!scene) { error_message = "No active scene"; return false; }
    if (!sceneContainsLayer(*scene, layer_id)) { error_message = "Layer not found"; return false; }
    if (scene->defaultLayerId == layer_id) return true;

    auto command = std::make_unique<SetDefaultSceneLayerCommand>(m_doc.activeSceneId, layer_id);
    SetDefaultSceneLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied()) { error_message = "Failed to set default layer"; return false; }
    bumpRevision();
    return true;
}

bool EditorCoordinator::moveSceneLayer(const std::string &layer_id,
                                       std::size_t target_index,
                                       std::string &error_message)
{
    if (!m_has_project) { error_message = "No project open"; return false; }
    SceneDef *scene = activeScene();
    if (!scene) { error_message = "No active scene"; return false; }
    if (!sceneContainsLayer(*scene, layer_id)) { error_message = "Layer not found"; return false; }
    if (scene->layers.empty()) { error_message = "Scene has no layers"; return false; }
    const std::size_t target = std::min(target_index, scene->layers.size() - 1);
    if (sceneLayerIndex(*scene, layer_id) == target) return true;

    auto command = std::make_unique<MoveSceneLayerCommand>(m_doc.activeSceneId, layer_id, target);
    MoveSceneLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied()) { error_message = "Failed to move layer"; return false; }
    bumpRevision();
    return true;
}

} // namespace ArtCade::EditorCore

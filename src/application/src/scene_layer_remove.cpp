#include "artcade/editor_core/editor_core.h"

#include <algorithm>
#include <cstddef>
#include <memory>
#include <utility>

namespace ArtCade::EditorCore {

RemoveSceneLayerCommand::RemoveSceneLayerCommand(SceneId scene_id, std::string layer_id,
                                                 std::string transfer_target_id)
    : m_scene_id(std::move(scene_id)), m_layer_id(std::move(layer_id)),
      m_transfer_target_id(std::move(transfer_target_id))
{
}

void RemoveSceneLayerCommand::execute(ProjectDoc &doc)
{
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    SceneDef &scene = scene_it->second;
    if (m_layer_id.empty() || m_transfer_target_id.empty() || m_layer_id == m_transfer_target_id
        || scene.layers.size() <= 1 || scene.defaultLayerId == m_layer_id
        || !EditorCoordinator::sceneContainsLayer(scene, m_layer_id)
        || !EditorCoordinator::sceneContainsLayer(scene, m_transfer_target_id)) return;

    if (!m_captured) {
        m_from_index = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
        const SceneLayerDef *definition = EditorCoordinator::findSceneLayer(scene, m_layer_id);
        if (!definition) return;
        m_removed_def = *definition;
        const auto settings_it = scene.layerSettings.find(m_layer_id);
        m_had_settings = settings_it != scene.layerSettings.end();
        if (m_had_settings) m_removed_settings = settings_it->second;
        for (const SceneInstanceDef &instance : scene.instances) {
            if (instance.layerId == m_layer_id) m_transferred_ids.push_back(instance.id);
        }
        m_captured = true;
    }
    for (SceneInstanceDef &instance : scene.instances) {
        if (instance.layerId == m_layer_id) instance.layerId = m_transfer_target_id;
    }
    scene.layerSettings.erase(m_layer_id);
    const std::size_t layer_index = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
    if (layer_index >= scene.layers.size()) return;
    scene.layers.erase(scene.layers.begin() + static_cast<std::ptrdiff_t>(layer_index));
    m_applied = true;
}

void RemoveSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    SceneDef &scene = scene_it->second;
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(
                            std::min(m_from_index, scene.layers.size())),
                        m_removed_def);
    if (m_had_settings) scene.layerSettings[m_layer_id] = m_removed_settings;
    for (const EntityId entity_id : m_transferred_ids) {
        if (SceneInstanceDef *instance = project_doc_find_instance_in_scene(doc, m_scene_id, entity_id)) {
            instance->layerId = m_layer_id;
        }
    }
    m_applied = false;
}

bool EditorCoordinator::removeSceneLayer(const std::string &layer_id,
                                         const std::string &transfer_target_id,
                                         std::string &error_message)
{
    if (!m_has_project) { error_message = "No project open"; return false; }
    SceneDef *scene = activeScene();
    if (!scene) { error_message = "No active scene"; return false; }
    if (layer_id.empty() || transfer_target_id.empty()) { error_message = "Empty layer id"; return false; }
    if (layer_id == transfer_target_id) { error_message = "Transfer target must be a different layer"; return false; }
    if (scene->layers.size() <= 1) { error_message = "A scene must keep at least one layer"; return false; }
    if (scene->defaultLayerId == layer_id) {
        error_message = "Cannot delete the default layer; set another default first";
        return false;
    }
    if (!sceneContainsLayer(*scene, layer_id)) { error_message = "Layer not found"; return false; }
    if (!sceneContainsLayer(*scene, transfer_target_id)) { error_message = "Transfer target layer not found"; return false; }

    auto command = std::make_unique<RemoveSceneLayerCommand>(
        m_doc.activeSceneId, layer_id, transfer_target_id);
    RemoveSceneLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied()) { error_message = "Failed to remove layer"; return false; }
    const auto hidden_scene = m_hidden_layer_ids_by_scene.find(scene->id);
    if (hidden_scene != m_hidden_layer_ids_by_scene.end()) {
        hidden_scene->second.erase(layer_id);
        if (hidden_scene->second.empty()) m_hidden_layer_ids_by_scene.erase(hidden_scene);
    }
    if (m_active_layer_id == layer_id) reconcileActiveLayerId();
    bumpRevision();
    return true;
}

int EditorCoordinator::countInstancesOnLayer(const std::string &layer_id) const
{
    const SceneDef *scene = activeScene();
    if (!scene || layer_id.empty()) return 0;
    return static_cast<int>(std::count_if(scene->instances.begin(), scene->instances.end(),
        [&](const SceneInstanceDef &instance) { return instance.layerId == layer_id; }));
}

} // namespace ArtCade::EditorCore

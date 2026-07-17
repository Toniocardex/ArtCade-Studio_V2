/**
 * Core Commands for adding, renaming, selecting the default, and reordering SceneDef.layers.
 */
#include "artcade/editor_core/editor_core.h"
#include "scene_layer_support.h"

#include <algorithm>
#include <cstddef>
#include <utility>

namespace ArtCade::EditorCore {
using namespace SceneLayerSupport;

AddSceneLayerCommand::AddSceneLayerCommand(SceneId scene_id, std::string layer_id,
                                           std::string name, std::size_t insert_index)
    : m_scene_id(std::move(scene_id)), m_layer_id(std::move(layer_id)),
      m_name(std::move(name)), m_insert_index(insert_index)
{
}

void AddSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty() || m_name.empty()) return;
    SceneDef &scene = scene_it->second;
    if (EditorCoordinator::sceneContainsLayer(scene, m_layer_id)) return;
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(
                            std::min(m_insert_index, scene.layers.size())),
                        {m_layer_id, m_name, false});
    scene.layerSettings[m_layer_id] = SceneLayerSettings{};
    m_applied = true;
}

void AddSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied) return;
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    SceneDef &scene = scene_it->second;
    const auto layer_it = std::find_if(scene.layers.begin(), scene.layers.end(),
        [&](const SceneLayerDef &layer) { return layer.id == m_layer_id; });
    if (layer_it != scene.layers.end()) scene.layers.erase(layer_it);
    scene.layerSettings.erase(m_layer_id);
    m_applied = false;
}

RenameSceneLayerCommand::RenameSceneLayerCommand(SceneId scene_id, std::string layer_id,
                                                 std::string new_name)
    : m_scene_id(std::move(scene_id)), m_layer_id(std::move(layer_id)),
      m_new_name(std::move(new_name))
{
}

void RenameSceneLayerCommand::execute(ProjectDoc &doc)
{
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty() || m_new_name.empty()) return;
    SceneDef &scene = scene_it->second;
    SceneLayerDef *layer = EditorCoordinator::findSceneLayer(scene, m_layer_id);
    if (!layer) return;
    if (!m_captured) { m_old_name = layer->name; m_captured = true; }
    if (m_old_name == m_new_name || name_taken_case_insensitive(scene, m_new_name, m_layer_id)) return;
    layer->name = m_new_name;
    m_applied = true;
}

void RenameSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    if (SceneLayerDef *layer = EditorCoordinator::findSceneLayer(scene_it->second, m_layer_id)) {
        layer->name = m_old_name;
    }
    m_applied = false;
}

SetDefaultSceneLayerCommand::SetDefaultSceneLayerCommand(SceneId scene_id, std::string layer_id)
    : m_scene_id(std::move(scene_id)), m_layer_id(std::move(layer_id))
{
}

void SetDefaultSceneLayerCommand::execute(ProjectDoc &doc)
{
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty()) return;
    SceneDef &scene = scene_it->second;
    if (!EditorCoordinator::sceneContainsLayer(scene, m_layer_id)) return;
    if (!m_captured) { m_old_default = scene.defaultLayerId; m_captured = true; }
    if (scene.defaultLayerId == m_layer_id) return;
    scene.defaultLayerId = m_layer_id;
    m_applied = true;
}

void SetDefaultSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    scene_it->second.defaultLayerId = m_old_default;
    m_applied = false;
}

MoveSceneLayerCommand::MoveSceneLayerCommand(SceneId scene_id, std::string layer_id,
                                             std::size_t target_index)
    : m_scene_id(std::move(scene_id)), m_layer_id(std::move(layer_id)),
      m_target_index(target_index)
{
}

void MoveSceneLayerCommand::execute(ProjectDoc &doc)
{
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty()) return;
    SceneDef &scene = scene_it->second;
    const std::size_t from = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
    if (from == static_cast<std::size_t>(-1) || scene.layers.empty()) return;
    const std::size_t target = std::min(m_target_index, scene.layers.size() - 1);
    if (!m_captured) { m_from_index = from; m_captured = true; }
    if (from == target) return;
    SceneLayerDef layer = std::move(scene.layers[from]);
    scene.layers.erase(scene.layers.begin() + static_cast<std::ptrdiff_t>(from));
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(target), std::move(layer));
    m_applied = true;
}

void MoveSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    SceneDef &scene = scene_it->second;
    const std::size_t current = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
    if (current == static_cast<std::size_t>(-1)) return;
    SceneLayerDef layer = std::move(scene.layers[current]);
    scene.layers.erase(scene.layers.begin() + static_cast<std::ptrdiff_t>(current));
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(
                            std::min(m_from_index, scene.layers.size())),
                        std::move(layer));
    m_applied = false;
}

} // namespace ArtCade::EditorCore

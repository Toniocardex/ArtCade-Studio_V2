#include "artcade/editor_core/editor_core.h"
#include "scene_layer_support.h"

#include <algorithm>
#include <cstddef>
#include <memory>
#include <utility>

namespace ArtCade::EditorCore {
using namespace SceneLayerSupport;

DuplicateSceneLayerCommand::DuplicateSceneLayerCommand(SceneId scene_id, std::string source_layer_id)
    : m_scene_id(std::move(scene_id)), m_source_layer_id(std::move(source_layer_id))
{
}

void DuplicateSceneLayerCommand::execute(ProjectDoc &doc)
{
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_source_layer_id.empty()) return;
    SceneDef &scene = scene_it->second;
    if (!EditorCoordinator::sceneContainsLayer(scene, m_source_layer_id)) return;

    if (!m_planned) {
        const SceneLayerDef *source = EditorCoordinator::findSceneLayer(scene, m_source_layer_id);
        if (!source) return;
        m_new_layer_id = allocate_layer_id(scene);
        m_new_layer_name = next_copy_layer_name(scene, source->name.empty() ? source->id : source->name);
        m_insert_index = EditorCoordinator::sceneLayerIndex(scene, m_source_layer_id) + 1;
        m_new_layer_def = {m_new_layer_id, m_new_layer_name, source->locked};

        const auto settings_it = scene.layerSettings.find(m_source_layer_id);
        m_copy_settings = true;
        m_new_settings = settings_it == scene.layerSettings.end()
            ? SceneLayerSettings{} : settings_it->second;
        const auto tilemap_it = scene.tilemapLayers.find(m_source_layer_id);
        m_copy_tilemap = tilemap_it != scene.tilemapLayers.end();
        if (m_copy_tilemap) m_new_tilemap = tilemap_it->second;

        EntityId next_entity_id = allocate_next_entity_id(doc);
        SceneDef name_probe = scene;
        for (const SceneInstanceDef &instance : scene.instances) {
            if (instance.layerId != m_source_layer_id) continue;
            SceneInstanceDef copy = instance;
            copy.id = next_entity_id++;
            copy.layerId = m_new_layer_id;
            copy.instanceName = next_copy_instance_name(
                name_probe, instance.instanceName.empty() ? instance.objectTypeId : instance.instanceName);
            name_probe.instances.push_back(copy);
            m_new_instances.push_back(std::move(copy));
        }
        m_planned = true;
    }
    if (EditorCoordinator::sceneContainsLayer(scene, m_new_layer_id)) return;
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(
                            std::min(m_insert_index, scene.layers.size())),
                        m_new_layer_def);
    if (m_copy_settings) scene.layerSettings[m_new_layer_id] = m_new_settings;
    if (m_copy_tilemap) scene.tilemapLayers[m_new_layer_id] = m_new_tilemap;
    scene.instances.insert(scene.instances.end(), m_new_instances.begin(), m_new_instances.end());
    m_applied = true;
}

void DuplicateSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_planned) return;
    const auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) return;
    SceneDef &scene = scene_it->second;
    for (const SceneInstanceDef &created : m_new_instances) {
        const auto instance_it = std::find_if(scene.instances.begin(), scene.instances.end(),
            [&](const SceneInstanceDef &instance) { return instance.id == created.id; });
        if (instance_it != scene.instances.end()) scene.instances.erase(instance_it);
    }
    scene.tilemapLayers.erase(m_new_layer_id);
    scene.layerSettings.erase(m_new_layer_id);
    const auto layer_it = std::find_if(scene.layers.begin(), scene.layers.end(),
        [&](const SceneLayerDef &layer) { return layer.id == m_new_layer_id; });
    if (layer_it != scene.layers.end()) scene.layers.erase(layer_it);
    m_applied = false;
}

bool EditorCoordinator::duplicateSceneLayer(const std::string &layer_id,
                                            std::string &out_new_layer_id,
                                            std::string &error_message)
{
    out_new_layer_id.clear();
    if (!m_has_project) { error_message = "No project open"; return false; }
    SceneDef *scene = activeScene();
    if (!scene) { error_message = "No active scene"; return false; }
    if (layer_id.empty()) { error_message = "Empty layer id"; return false; }
    if (!sceneContainsLayer(*scene, layer_id)) { error_message = "Layer not found"; return false; }

    auto command = std::make_unique<DuplicateSceneLayerCommand>(m_doc.activeSceneId, layer_id);
    DuplicateSceneLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied() || result->newLayerId().empty()) {
        error_message = "Failed to duplicate layer";
        return false;
    }
    out_new_layer_id = result->newLayerId();
    m_active_layer_id = out_new_layer_id;
    bumpRevision();
    return true;
}

} // namespace ArtCade::EditorCore

#include "artcade/editor_core/editor_core.h"

#include <memory>
#include <utility>

namespace ArtCade::EditorCore {

SetEntityLayerCommand::SetEntityLayerCommand(SceneId scene_id, EntityId entity_id,
                                             std::string layer_id)
    : m_scene_id(std::move(scene_id)), m_entity_id(entity_id), m_layer_id(std::move(layer_id))
{
}

void SetEntityLayerCommand::execute(ProjectDoc &doc)
{
    if (m_entity_id == 0 || m_layer_id.empty()) return;
    SceneInstanceDef *instance = project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    auto scene_it = doc.scenes.find(m_scene_id);
    if (!instance || scene_it == doc.scenes.end()
        || !EditorCoordinator::sceneContainsLayer(scene_it->second, m_layer_id)) return;
    if (!m_captured) { m_old_layer_id = instance->layerId; m_captured = true; }
    if (instance->layerId == m_layer_id) return;
    instance->layerId = m_layer_id;
    m_applied = true;
}

void SetEntityLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    if (SceneInstanceDef *instance = project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id)) {
        instance->layerId = m_old_layer_id;
    }
    m_applied = false;
}

bool EditorCoordinator::setEntityLayer(EntityId entity_id, const std::string &layer_id,
                                       std::string &error_message)
{
    if (!m_has_project) { error_message = "No project open"; return false; }
    if (entity_id == 0) { error_message = "Invalid entity"; return false; }
    if (layer_id.empty()) { error_message = "Empty layer id"; return false; }
    SceneId scene_id;
    const SceneInstanceDef *instance = nullptr;
    if (!project_doc_locate_instance(m_doc, entity_id, scene_id, instance) || !instance) {
        error_message = "Entity not found";
        return false;
    }
    const auto scene_it = m_doc.scenes.find(scene_id);
    if (scene_it == m_doc.scenes.end() || !sceneContainsLayer(scene_it->second, layer_id)) {
        error_message = "Layer not found in entity scene";
        return false;
    }
    if (instance->layerId == layer_id) return true;

    auto command = std::make_unique<SetEntityLayerCommand>(scene_id, entity_id, layer_id);
    SetEntityLayerCommand *result = command.get();
    m_commands.execute(std::move(command), m_doc);
    if (!result->applied()) { error_message = "Failed to set entity layer"; return false; }
    bumpRevision();
    return true;
}

} // namespace ArtCade::EditorCore

#include "artcade/editor_core/editor_core.h"

namespace ArtCade::EditorCore {

bool EditorCoordinator::openProject(const std::string &project_json_path, std::string &error_message)
{
    ProjectDoc loaded;
    if (!project_file_io_load(project_json_path, loaded, error_message)) {
        return false;
    }
    m_doc = std::move(loaded);
    m_path = project_json_path;
    m_has_project = true;
    m_revision = 0;
    m_saved_revision = 0;
    m_selected_entity_id = 0;
    m_active_layer_id.clear();
    m_commands.clear();
    if (!m_doc.layers.empty()) {
        m_active_layer_id = m_doc.layers.front().id;
    }
    return true;
}

bool EditorCoordinator::saveProject(std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (m_path.empty()) {
        error_message = "No project path; use saveProjectAs";
        return false;
    }
    return saveProjectAs(m_path, error_message);
}

bool EditorCoordinator::saveProjectAs(const std::string &project_json_path, std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!project_file_io_save(project_json_path, m_doc, error_message)) {
        return false;
    }
    m_path = project_json_path;
    m_saved_revision = m_revision;
    return true;
}

bool EditorCoordinator::hasProject() const
{
    return m_has_project;
}

const ProjectDoc &EditorCoordinator::document() const
{
    return m_doc;
}

ProjectDoc &EditorCoordinator::document()
{
    return m_doc;
}

const std::string &EditorCoordinator::projectPath() const
{
    return m_path;
}

std::uint64_t EditorCoordinator::revision() const
{
    return m_revision;
}

std::uint64_t EditorCoordinator::savedRevision() const
{
    return m_saved_revision;
}

bool EditorCoordinator::isDirty() const
{
    return m_has_project && m_revision != m_saved_revision;
}

void EditorCoordinator::selectEntity(EntityId entity_id)
{
    m_selected_entity_id = entity_id;
}

void EditorCoordinator::clearSelection()
{
    m_selected_entity_id = 0;
}

EntityId EditorCoordinator::selectedEntityId() const
{
    return m_selected_entity_id;
}

void EditorCoordinator::setActiveLayerId(const std::string &layer_id)
{
    m_active_layer_id = layer_id;
}

const std::string &EditorCoordinator::activeLayerId() const
{
    return m_active_layer_id;
}

void EditorCoordinator::bumpRevision()
{
    ++m_revision;
}

SceneDef *EditorCoordinator::activeScene()
{
    if (!m_has_project || m_doc.scenes.empty()) {
        return nullptr;
    }
    auto it = m_doc.scenes.find(m_doc.activeSceneId);
    if (it != m_doc.scenes.end()) {
        return &it->second;
    }
    return &m_doc.scenes.begin()->second;
}

const SceneDef *EditorCoordinator::activeScene() const
{
    return const_cast<EditorCoordinator *>(this)->activeScene();
}

bool EditorCoordinator::layerVisible(const std::string &layer_id) const
{
    if (layer_id.empty()) {
        return true;
    }
    const SceneDef *scene = activeScene();
    if (!scene) {
        return true;
    }
    auto it = scene->layerSettings.find(layer_id);
    if (it == scene->layerSettings.end()) {
        return true;
    }
    return it->second.visible;
}

bool EditorCoordinator::layerLocked(const std::string &layer_id) const
{
    if (layer_id.empty()) {
        return false;
    }
    for (const SceneLayerDef &layer : m_doc.layers) {
        if (layer.id == layer_id) {
            return layer.locked;
        }
    }
    return false;
}

EntityId EditorCoordinator::pickEntityAt(float world_x, float world_y) const
{
    const SceneDef *scene = activeScene();
    if (!scene) {
        return 0;
    }
    // Topmost = last instance in authoring order that contains the point.
    for (auto it = scene->instances.rbegin(); it != scene->instances.rend(); ++it) {
        const SceneInstanceDef &inst = *it;
        if (!inst.visible) {
            continue;
        }
        if (!inst.layerId.empty()) {
            if (!layerVisible(inst.layerId) || layerLocked(inst.layerId)) {
                continue;
            }
        }
        const float w = kSceneViewPlaceholderExtent * inst.transform.scale.x;
        const float h = kSceneViewPlaceholderExtent * inst.transform.scale.y;
        const float left = inst.transform.position.x;
        const float top = inst.transform.position.y;
        if (world_x >= left && world_x <= left + w && world_y >= top && world_y <= top + h) {
            return inst.id;
        }
    }
    return 0;
}

bool EditorCoordinator::renameEntity(EntityId entity_id,
                                     const std::string &new_name,
                                     std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!project_doc_find_instance(m_doc, entity_id)) {
        error_message = "Entity not found";
        return false;
    }
    m_commands.execute(std::make_unique<RenameEntityCommand>(entity_id, new_name), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setEntityPosition(EntityId entity_id,
                                          float x,
                                          float y,
                                          std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!project_doc_find_instance(m_doc, entity_id)) {
        error_message = "Entity not found";
        return false;
    }
    m_commands.execute(std::make_unique<SetEntityPositionCommand>(entity_id, x, y), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLayerVisible(const std::string &layer_id,
                                        bool visible,
                                        std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (layer_id.empty()) {
        error_message = "Empty layer id";
        return false;
    }
    bool known = false;
    for (const SceneLayerDef &layer : m_doc.layers) {
        if (layer.id == layer_id) {
            known = true;
            break;
        }
    }
    if (!known) {
        error_message = "Layer not found";
        return false;
    }
    if (!activeScene()) {
        error_message = "No active scene";
        return false;
    }
    SceneId scene_id;
    auto scene_it = m_doc.scenes.find(m_doc.activeSceneId);
    if (scene_it != m_doc.scenes.end()) {
        scene_id = scene_it->first;
    } else {
        scene_id = m_doc.scenes.begin()->first;
    }
    m_commands.execute(
        std::make_unique<SetLayerVisibleCommand>(scene_id, layer_id, visible), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::renameSelected(const std::string &new_name, std::string &error_message)
{
    if (m_selected_entity_id == 0) {
        error_message = "Nothing selected";
        return false;
    }
    return renameEntity(m_selected_entity_id, new_name, error_message);
}

bool EditorCoordinator::setSelectedPosition(float x, float y, std::string &error_message)
{
    if (m_selected_entity_id == 0) {
        error_message = "Nothing selected";
        return false;
    }
    return setEntityPosition(m_selected_entity_id, x, y, error_message);
}

bool EditorCoordinator::canUndo() const
{
    return m_commands.canUndo();
}

bool EditorCoordinator::canRedo() const
{
    return m_commands.canRedo();
}

void EditorCoordinator::undo()
{
    if (!m_commands.canUndo()) {
        return;
    }
    m_commands.undo(m_doc);
    bumpRevision();
}

void EditorCoordinator::redo()
{
    if (!m_commands.canRedo()) {
        return;
    }
    m_commands.redo(m_doc);
    bumpRevision();
}

} // namespace ArtCade::EditorCore

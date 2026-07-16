#include "artcade/editor_core/editor_core.h"

#include <cmath>

namespace ArtCade::EditorCore {

bool nearly_equal(float a, float b, float epsilon)
{
    if (!std::isfinite(a) || !std::isfinite(b)) {
        return false;
    }
    return std::fabs(a - b) <= epsilon;
}

bool nearly_equal(const Vec2 &a, const Vec2 &b, float epsilon)
{
    return nearly_equal(a.x, b.x, epsilon) && nearly_equal(a.y, b.y, epsilon);
}

bool is_finite_float(float value)
{
    return std::isfinite(value);
}

bool is_valid_authored_scale(const Vec2 &scale)
{
    return is_finite_float(scale.x) && is_finite_float(scale.y) && scale.x > 0.f && scale.y > 0.f;
}

void CommandStack::execute(std::unique_ptr<ICommand> command, ProjectDoc &doc)
{
    if (!command) {
        return;
    }
    command->execute(doc);
    m_undo.push_back(std::move(command));
    m_redo.clear();
}

void CommandStack::pushExecuted(std::unique_ptr<ICommand> command)
{
    if (!command) {
        return;
    }
    m_undo.push_back(std::move(command));
    m_redo.clear();
}

bool CommandStack::canUndo() const
{
    return !m_undo.empty();
}

bool CommandStack::canRedo() const
{
    return !m_redo.empty();
}

void CommandStack::undo(ProjectDoc &doc)
{
    if (m_undo.empty()) {
        return;
    }
    std::unique_ptr<ICommand> command = std::move(m_undo.back());
    m_undo.pop_back();
    command->undo(doc);
    m_redo.push_back(std::move(command));
}

void CommandStack::redo(ProjectDoc &doc)
{
    if (m_redo.empty()) {
        return;
    }
    std::unique_ptr<ICommand> command = std::move(m_redo.back());
    m_redo.pop_back();
    command->execute(doc);
    m_undo.push_back(std::move(command));
}

void CommandStack::clear()
{
    m_undo.clear();
    m_redo.clear();
}

RenameEntityCommand::RenameEntityCommand(EntityId entity_id, std::string new_name)
    : m_entity_id(entity_id)
    , m_new_name(std::move(new_name))
{
}

void RenameEntityCommand::execute(ProjectDoc &doc)
{
    SceneInstanceDef *inst = project_doc_find_instance(doc, m_entity_id);
    if (!inst) {
        return;
    }
    if (!m_captured) {
        m_old_name = inst->instanceName;
        m_captured = true;
    }
    inst->instanceName = m_new_name;
}

void RenameEntityCommand::undo(ProjectDoc &doc)
{
    SceneInstanceDef *inst = project_doc_find_instance(doc, m_entity_id);
    if (!inst || !m_captured) {
        return;
    }
    inst->instanceName = m_old_name;
}

SetEntityPositionCommand::SetEntityPositionCommand(EntityId entity_id, float x, float y)
    : m_entity_id(entity_id)
    , m_new_x(x)
    , m_new_y(y)
{
}

void SetEntityPositionCommand::execute(ProjectDoc &doc)
{
    SceneInstanceDef *inst = project_doc_find_instance(doc, m_entity_id);
    if (!inst) {
        return;
    }
    if (!m_captured) {
        m_old_x = inst->transform.position.x;
        m_old_y = inst->transform.position.y;
        m_captured = true;
    }
    inst->transform.position.x = m_new_x;
    inst->transform.position.y = m_new_y;
}

void SetEntityPositionCommand::undo(ProjectDoc &doc)
{
    SceneInstanceDef *inst = project_doc_find_instance(doc, m_entity_id);
    if (!inst || !m_captured) {
        return;
    }
    inst->transform.position.x = m_old_x;
    inst->transform.position.y = m_old_y;
}

SetEntityScaleCommand::SetEntityScaleCommand(SceneId scene_id, EntityId entity_id, Vec2 after_scale)
    : m_scene_id(std::move(scene_id))
    , m_entity_id(entity_id)
    , m_after_scale(after_scale)
{
}

void SetEntityScaleCommand::execute(ProjectDoc &doc)
{
    if (!is_valid_authored_scale(m_after_scale)) {
        return;
    }
    SceneInstanceDef *inst =
        project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    if (!inst) {
        return;
    }
    if (!m_captured) {
        m_before_scale = inst->transform.scale;
        m_captured = true;
    }
    if (nearly_equal(inst->transform.scale, m_after_scale)) {
        return;
    }
    inst->transform.scale = m_after_scale;
    m_applied = true;
}

void SetEntityScaleCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    SceneInstanceDef *inst =
        project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    if (!inst) {
        return;
    }
    inst->transform.scale = m_before_scale;
}

SetEntityRotationCommand::SetEntityRotationCommand(SceneId scene_id,
                                                   EntityId entity_id,
                                                   float after_rotation_radians)
    : m_scene_id(std::move(scene_id))
    , m_entity_id(entity_id)
    , m_after_rotation(after_rotation_radians)
{
}

void SetEntityRotationCommand::execute(ProjectDoc &doc)
{
    if (!is_finite_float(m_after_rotation)) {
        return;
    }
    SceneInstanceDef *inst =
        project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    if (!inst) {
        return;
    }
    if (!m_captured) {
        m_before_rotation = inst->transform.rotation;
        m_captured = true;
    }
    if (nearly_equal(inst->transform.rotation, m_after_rotation)) {
        return;
    }
    inst->transform.rotation = m_after_rotation;
    m_applied = true;
}

void SetEntityRotationCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    SceneInstanceDef *inst =
        project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    if (!inst) {
        return;
    }
    inst->transform.rotation = m_before_rotation;
}

SetLayerVisibleCommand::SetLayerVisibleCommand(SceneId scene_id,
                                               std::string layer_id,
                                               bool visible)
    : m_scene_id(std::move(scene_id))
    , m_layer_id(std::move(layer_id))
    , m_new_visible(visible)
{
}

void SetLayerVisibleCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    if (!m_captured) {
        auto settings_it = scene.layerSettings.find(m_layer_id);
        m_had_entry = settings_it != scene.layerSettings.end();
        m_old_visible = m_had_entry ? settings_it->second.visible : true;
        m_captured = true;
    }
    scene.layerSettings[m_layer_id].visible = m_new_visible;
}

void SetLayerVisibleCommand::undo(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || !m_captured) {
        return;
    }
    SceneDef &scene = scene_it->second;
    if (!m_had_entry) {
        scene.layerSettings.erase(m_layer_id);
        return;
    }
    scene.layerSettings[m_layer_id].visible = m_old_visible;
}

} // namespace ArtCade::EditorCore

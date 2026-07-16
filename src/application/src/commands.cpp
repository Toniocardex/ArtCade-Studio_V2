#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <algorithm>
#include <sstream>

namespace ArtCade::EditorCore {
namespace {

LogicRuleId allocate_logic_rule_id(const LogicBoardDef &board)
{
    int max_n = 0;
    for (const LogicRuleDef &rule : board.rules) {
        if (rule.id.rfind("rule-", 0) != 0) {
            continue;
        }
        try {
            const int n = std::stoi(rule.id.substr(5));
            if (n > max_n) {
                max_n = n;
            }
        } catch (...) {
        }
    }
    std::ostringstream oss;
    oss << "rule-" << (max_n + 1);
    return oss.str();
}

} // namespace

void CommandStack::execute(std::unique_ptr<ICommand> command, ProjectDoc &doc)
{
    if (!command) {
        return;
    }
    command->execute(doc);
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

AddLogicRuleCommand::AddLogicRuleCommand(ObjectTypeId object_type_id)
    : m_object_type_id(std::move(object_type_id))
{
}

void AddLogicRuleCommand::execute(ProjectDoc &doc)
{
    auto type_it = doc.objectTypes.find(m_object_type_id);
    if (type_it == doc.objectTypes.end() || m_object_type_id.empty()) {
        return;
    }
    EntityDef &type = type_it->second;
    if (!type.logicBoard) {
        LogicBoardDef board;
        board.id = "logic:" + m_object_type_id;
        board.schemaVersion = ArtCade::Logic::kLogicBoardSchemaVersion;
        board.apiVersion = ArtCade::Logic::kLogicApiVersion;
        type.logicBoard = std::move(board);
        m_created_board = true;
    }
    LogicBoardDef &board = *type.logicBoard;
    if (board.rules.size() >= ArtCade::Logic::kMaxRulesPerBoard) {
        if (m_created_board && board.rules.empty()) {
            type.logicBoard.reset();
            m_created_board = false;
        }
        return;
    }
    if (m_rule_id.empty()) {
        m_rule_id = allocate_logic_rule_id(board);
    }
    // Avoid duplicate id if redo after external edits (should not happen in stack).
    for (const LogicRuleDef &existing : board.rules) {
        if (existing.id == m_rule_id) {
            m_applied = true;
            return;
        }
    }
    board.rules.push_back(ArtCade::Logic::makeDefaultRule(m_rule_id));
    m_applied = true;
}

void AddLogicRuleCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || m_rule_id.empty()) {
        return;
    }
    auto type_it = doc.objectTypes.find(m_object_type_id);
    if (type_it == doc.objectTypes.end() || !type_it->second.logicBoard) {
        return;
    }
    EntityDef &type = type_it->second;
    LogicBoardDef &board = *type.logicBoard;
    board.rules.erase(std::remove_if(board.rules.begin(),
                                     board.rules.end(),
                                     [&](const LogicRuleDef &r) { return r.id == m_rule_id; }),
                      board.rules.end());
    if (m_created_board && board.rules.empty()) {
        type.logicBoard.reset();
    }
}

} // namespace ArtCade::EditorCore

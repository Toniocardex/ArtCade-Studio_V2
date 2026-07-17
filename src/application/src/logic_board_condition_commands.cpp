#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <algorithm>

namespace ArtCade::EditorCore {
namespace {

EntityDef *find_object_type(ProjectDoc &doc, const ObjectTypeId &object_type_id)
{
    if (object_type_id.empty()) return nullptr;
    auto type_it = doc.objectTypes.find(object_type_id);
    return type_it == doc.objectTypes.end() ? nullptr : &type_it->second;
}

LogicRuleDef *find_rule(LogicBoardDef &board, const LogicRuleId &rule_id)
{
    for (LogicRuleDef &rule : board.rules) {
        if (rule.id == rule_id) return &rule;
    }
    return nullptr;
}

} // namespace

AddLogicConditionCommand::AddLogicConditionCommand(ObjectTypeId object_type_id,
                                                   LogicRuleId rule_id,
                                                   LogicBlockDef block)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_block(std::move(block))
{
}

void AddLogicConditionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_block.typeId.empty()) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) return;
    if (rule->conditions.size() >= ArtCade::Logic::kMaxConditionsPerRule) return;
    m_insert_index = rule->conditions.size();
    rule->conditions.push_back(m_block);
    m_applied = true;
}

void AddLogicConditionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied) return;
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule || m_insert_index >= rule->conditions.size()) return;
    rule->conditions.erase(rule->conditions.begin()
                           + static_cast<std::ptrdiff_t>(m_insert_index));
}

SetLogicConditionAtCommand::SetLogicConditionAtCommand(ObjectTypeId object_type_id,
                                                       LogicRuleId rule_id,
                                                       std::size_t index,
                                                       LogicBlockDef new_block)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_index(index)
    , m_new_block(std::move(new_block))
{
}

void SetLogicConditionAtCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_new_block.typeId.empty()) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule || m_index >= rule->conditions.size()) return;
    if (!m_captured) {
        m_old_block = rule->conditions[m_index];
        m_captured = true;
    }
    if (m_old_block.typeId == m_new_block.typeId) return; // preserve properties
    rule->conditions[m_index] = m_new_block;
    m_applied = true;
}

void SetLogicConditionAtCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule || m_index >= rule->conditions.size()) return;
    rule->conditions[m_index] = m_old_block;
}

RemoveLogicConditionAtCommand::RemoveLogicConditionAtCommand(ObjectTypeId object_type_id,
                                                             LogicRuleId rule_id,
                                                             std::size_t index)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_index(index)
{
}

void RemoveLogicConditionAtCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty()) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule || m_index >= rule->conditions.size()) return;
    if (!m_captured) {
        m_removed = rule->conditions[m_index];
        m_captured = true;
    }
    rule->conditions.erase(rule->conditions.begin() + static_cast<std::ptrdiff_t>(m_index));
    m_applied = true;
}

void RemoveLogicConditionAtCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) return;
    const std::size_t insert_at = std::min(m_index, rule->conditions.size());
    rule->conditions.insert(rule->conditions.begin() + static_cast<std::ptrdiff_t>(insert_at),
                            m_removed);
}

MoveLogicConditionCommand::MoveLogicConditionCommand(ObjectTypeId object_type_id,
                                                     LogicRuleId rule_id,
                                                     std::size_t from,
                                                     std::size_t to)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_from(from)
    , m_to(to)
{
}

void MoveLogicConditionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty()) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule || rule->conditions.size() < 2) return;
    if (m_from == m_to) return;
    if (m_from >= rule->conditions.size() || m_to >= rule->conditions.size()) return;
    if (!m_captured) {
        m_before = rule->conditions;
        m_captured = true;
    }
    LogicBlockDef moved = std::move(rule->conditions[m_from]);
    rule->conditions.erase(rule->conditions.begin() + static_cast<std::ptrdiff_t>(m_from));
    rule->conditions.insert(rule->conditions.begin() + static_cast<std::ptrdiff_t>(m_to),
                            std::move(moved));
    m_applied = true;
}

void MoveLogicConditionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) return;
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) return;
    rule->conditions = m_before;
}

} // namespace ArtCade::EditorCore

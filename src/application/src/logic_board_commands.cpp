#include "artcade/editor_core/editor_core.h"

#include "logic_board_names.h"

#include "logic-core.h"

#include <algorithm>
#include <charconv>
#include <cstddef>
#include <string>

namespace ArtCade::EditorCore {
namespace {

LogicRuleId allocate_logic_rule_id(const LogicBoardDef &board)
{
    int max_n = 0;
    for (const LogicRuleDef &rule : board.rules) {
        if (rule.id.rfind("rule-", 0) != 0) {
            continue;
        }
        const char *begin = rule.id.data() + 5;
        const char *end = rule.id.data() + rule.id.size();
        int n = 0;
        const auto parsed = std::from_chars(begin, end, n);
        if (parsed.ec != std::errc{} || parsed.ptr != end || n <= 0) {
            continue;
        }
        if (n > max_n) {
            max_n = n;
        }
    }
    return "rule-" + std::to_string(max_n + 1);
}

EntityDef *find_object_type(ProjectDoc &doc, const ObjectTypeId &object_type_id)
{
    if (object_type_id.empty()) {
        return nullptr;
    }
    auto type_it = doc.objectTypes.find(object_type_id);
    if (type_it == doc.objectTypes.end()) {
        return nullptr;
    }
    return &type_it->second;
}

LogicRuleDef *find_rule(LogicBoardDef &board, const LogicRuleId &rule_id)
{
    for (LogicRuleDef &rule : board.rules) {
        if (rule.id == rule_id) {
            return &rule;
        }
    }
    return nullptr;
}

} // namespace

AddLogicRuleCommand::AddLogicRuleCommand(ObjectTypeId object_type_id)
    : m_object_type_id(std::move(object_type_id))
{
}

void AddLogicRuleCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type) {
        return;
    }
    if (!type->logicBoard) {
        LogicBoardDef board;
        board.id = "logic:" + m_object_type_id;
        board.schemaVersion = ArtCade::Logic::kLogicBoardSchemaVersion;
        board.apiVersion = ArtCade::Logic::kLogicApiVersion;
        type->logicBoard = std::move(board);
        m_created_board = true;
    }
    LogicBoardDef &board = *type->logicBoard;
    if (board.rules.size() >= ArtCade::Logic::kMaxRulesPerBoard) {
        if (m_created_board && board.rules.empty()) {
            type->logicBoard.reset();
            m_created_board = false;
        }
        return;
    }
    if (m_rule_id.empty()) {
        m_rule_id = allocate_logic_rule_id(board);
    }
    for (const LogicRuleDef &existing : board.rules) {
        if (existing.id == m_rule_id) {
            return; // true no-op — do not mark applied
        }
    }
    LogicRuleDef rule = ArtCade::Logic::makeDefaultRule(m_rule_id);
    rule.name = logic_board_next_available_rule_name(board);
    board.rules.push_back(std::move(rule));
    m_applied = true;
}

void AddLogicRuleCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || m_rule_id.empty()) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    board.rules.erase(std::remove_if(board.rules.begin(),
                                     board.rules.end(),
                                     [&](const LogicRuleDef &r) { return r.id == m_rule_id; }),
                      board.rules.end());
    if (m_created_board && board.rules.empty() && board.sections.empty()) {
        type->logicBoard.reset();
    }
}

RemoveLogicRuleCommand::RemoveLogicRuleCommand(ObjectTypeId object_type_id, LogicRuleId rule_id)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
{
}

void RemoveLogicRuleCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty()) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    auto it = std::find_if(board.rules.begin(),
                           board.rules.end(),
                           [&](const LogicRuleDef &r) { return r.id == m_rule_id; });
    if (it == board.rules.end()) {
        return;
    }
    if (!m_captured) {
        m_index = static_cast<std::size_t>(std::distance(board.rules.begin(), it));
        m_removed_rule = *it;
        m_board_id = board.id;
        m_schema_version = board.schemaVersion;
        m_api_version = board.apiVersion;
        m_captured = true;
    }
    m_cleared_board = false;
    board.rules.erase(it);
    if (board.rules.empty() && board.sections.empty()) {
        type->logicBoard.reset();
        m_cleared_board = true;
    }
    m_applied = true;
}

void RemoveLogicRuleCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type) {
        return;
    }
    if (m_cleared_board || !type->logicBoard) {
        LogicBoardDef board;
        board.id = m_board_id.empty() ? ("logic:" + m_object_type_id) : m_board_id;
        board.schemaVersion = m_schema_version;
        board.apiVersion = m_api_version;
        board.rules.push_back(m_removed_rule);
        type->logicBoard = std::move(board);
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    for (const LogicRuleDef &existing : board.rules) {
        if (existing.id == m_removed_rule.id) {
            return;
        }
    }
    const std::size_t insert_at = std::min(m_index, board.rules.size());
    board.rules.insert(board.rules.begin() + static_cast<std::ptrdiff_t>(insert_at),
                       m_removed_rule);
}

RenameLogicRuleCommand::RenameLogicRuleCommand(ObjectTypeId object_type_id,
                                               LogicRuleId rule_id,
                                               std::string new_name)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_new_name(std::move(new_name))
{
}

void RenameLogicRuleCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_new_name.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    if (!m_captured) {
        m_old_name = rule->name;
        m_captured = true;
    }
    if (rule->name == m_new_name) {
        return;
    }
    rule->name = m_new_name;
    m_applied = true;
}

void RenameLogicRuleCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    if (LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id)) {
        rule->name = m_old_name;
    }
}

SetLogicRuleTriggerCommand::SetLogicRuleTriggerCommand(ObjectTypeId object_type_id,
                                                       LogicRuleId rule_id,
                                                       std::string block_type_id)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_block_type_id(std::move(block_type_id))
{
}

void SetLogicRuleTriggerCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_block_type_id.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    LogicBlockDef next =
        ArtCade::Logic::makeDefaultBlock(m_block_type_id, ArtCade::Logic::BlockKind::Trigger);
    if (next.typeId.empty()) {
        return;
    }
    if (!m_captured) {
        m_old_trigger = rule->trigger;
        m_captured = true;
    }
    if (rule->trigger.typeId == next.typeId) {
        return; // no-op — do not mark applied
    }
    rule->trigger = std::move(next);
    m_applied = true;
}

void SetLogicRuleTriggerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    rule->trigger = m_old_trigger;
}

SetLogicRulePrimaryActionCommand::SetLogicRulePrimaryActionCommand(ObjectTypeId object_type_id,
                                                                   LogicRuleId rule_id,
                                                                   std::string block_type_id)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_block_type_id(std::move(block_type_id))
{
}

void SetLogicRulePrimaryActionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_block_type_id.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    LogicBlockDef next =
        ArtCade::Logic::makeDefaultBlock(m_block_type_id, ArtCade::Logic::BlockKind::Action);
    if (next.typeId.empty()) {
        return;
    }
    if (!m_captured) {
        m_had_action = !rule->actions.empty();
        if (m_had_action) {
            m_old_action = rule->actions.front();
        }
        m_captured = true;
    }
    if (m_had_action && !rule->actions.empty() && rule->actions.front().typeId == next.typeId) {
        return; // no-op — same primary action type
    }
    if (rule->actions.empty()) {
        rule->actions.push_back(std::move(next));
    } else {
        rule->actions.front() = std::move(next);
    }
    m_applied = true;
}

void SetLogicRulePrimaryActionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    if (!m_had_action) {
        rule->actions.clear();
        return;
    }
    if (rule->actions.empty()) {
        rule->actions.push_back(m_old_action);
    } else {
        rule->actions.front() = m_old_action;
    }
}

SetLogicRuleEnabledCommand::SetLogicRuleEnabledCommand(ObjectTypeId object_type_id,
                                                       LogicRuleId rule_id,
                                                       bool enabled)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_new_enabled(enabled)
{
}

void SetLogicRuleEnabledCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    if (!m_captured) {
        m_old_enabled = rule->enabled;
        m_captured = true;
    }
    if (rule->enabled == m_new_enabled) {
        return; // no-op — do not mark applied
    }
    rule->enabled = m_new_enabled;
    m_applied = true;
}

void SetLogicRuleEnabledCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    rule->enabled = m_old_enabled;
}

SetLogicRulePrimaryConditionCommand::SetLogicRulePrimaryConditionCommand(
    ObjectTypeId object_type_id,
    LogicRuleId rule_id,
    std::string block_type_id)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_block_type_id(std::move(block_type_id))
{
}

void SetLogicRulePrimaryConditionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_block_type_id.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    LogicBlockDef next = ArtCade::Logic::makeDefaultBlock(
        m_block_type_id, ArtCade::Logic::BlockKind::Condition);
    if (next.typeId.empty()) {
        return;
    }
    if (!m_captured) {
        m_had_condition = !rule->conditions.empty();
        if (m_had_condition) {
            m_old_condition = rule->conditions.front();
        }
        m_captured = true;
    }
    if (m_had_condition && !rule->conditions.empty()
        && rule->conditions.front().typeId == next.typeId) {
        return; // no-op
    }
    if (rule->conditions.empty()) {
        rule->conditions.push_back(std::move(next));
    } else {
        rule->conditions.front() = std::move(next);
    }
    m_applied = true;
}

void SetLogicRulePrimaryConditionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    if (!m_had_condition) {
        rule->conditions.clear();
        return;
    }
    if (rule->conditions.empty()) {
        rule->conditions.push_back(m_old_condition);
    } else {
        rule->conditions.front() = m_old_condition;
    }
}

ClearLogicRuleConditionsCommand::ClearLogicRuleConditionsCommand(ObjectTypeId object_type_id,
                                                                 LogicRuleId rule_id)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
{
}

void ClearLogicRuleConditionsCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule || rule->conditions.empty()) {
        return;
    }
    if (!m_captured) {
        m_old_conditions = rule->conditions;
        m_captured = true;
    }
    rule->conditions.clear();
    m_applied = true;
}

void ClearLogicRuleConditionsCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    rule->conditions = m_old_conditions;
}

} // namespace ArtCade::EditorCore

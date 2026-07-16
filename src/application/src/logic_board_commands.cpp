#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <algorithm>
#include <cstddef>
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
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    board.rules.erase(std::remove_if(board.rules.begin(),
                                     board.rules.end(),
                                     [&](const LogicRuleDef &r) { return r.id == m_rule_id; }),
                      board.rules.end());
    if (m_created_board && board.rules.empty()) {
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
    board.rules.erase(it);
    if (board.rules.empty()) {
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

} // namespace ArtCade::EditorCore

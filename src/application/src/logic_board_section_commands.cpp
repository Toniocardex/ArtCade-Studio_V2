#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <algorithm>
#include <charconv>
#include <cstddef>
#include <string>

namespace ArtCade::EditorCore {
namespace {

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

LogicSectionDef *find_section(LogicBoardDef &board, const std::string &section_id)
{
    for (LogicSectionDef &section : board.sections) {
        if (section.id == section_id) {
            return &section;
        }
    }
    return nullptr;
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

std::string allocate_logic_section_id(const LogicBoardDef &board)
{
    int max_n = 0;
    for (const LogicSectionDef &section : board.sections) {
        if (section.id.rfind("section-", 0) != 0) {
            continue;
        }
        const char *begin = section.id.data() + 8;
        const char *end = section.id.data() + section.id.size();
        int n = 0;
        const auto parsed = std::from_chars(begin, end, n);
        if (parsed.ec != std::errc{} || parsed.ptr != end || n <= 0) {
            continue;
        }
        if (n > max_n) {
            max_n = n;
        }
    }
    return "section-" + std::to_string(max_n + 1);
}

} // namespace

AddLogicSectionCommand::AddLogicSectionCommand(ObjectTypeId object_type_id, std::string name)
    : m_object_type_id(std::move(object_type_id))
    , m_name(std::move(name))
{
}

void AddLogicSectionCommand::execute(ProjectDoc &doc)
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
    if (board.sections.size() >= ArtCade::Logic::kMaxSectionsPerBoard) {
        if (m_created_board && board.rules.empty() && board.sections.empty()) {
            type->logicBoard.reset();
            m_created_board = false;
        }
        return;
    }
    if (m_section_id.empty()) {
        m_section_id = allocate_logic_section_id(board);
    }
    if (find_section(board, m_section_id)) {
        return; // true no-op — do not mark applied
    }
    LogicSectionDef section;
    section.id = m_section_id;
    section.name = m_name.empty()
        ? "Section " + m_section_id.substr(m_section_id.rfind('-') + 1)
        : m_name;
    board.sections.push_back(std::move(section));
    m_applied = true;
}

void AddLogicSectionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || m_section_id.empty()) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    board.sections.erase(
        std::remove_if(board.sections.begin(),
                       board.sections.end(),
                       [&](const LogicSectionDef &s) { return s.id == m_section_id; }),
        board.sections.end());
    if (m_created_board && board.rules.empty() && board.sections.empty()) {
        type->logicBoard.reset();
    }
}

RenameLogicSectionCommand::RenameLogicSectionCommand(ObjectTypeId object_type_id,
                                                     std::string section_id,
                                                     std::string new_name)
    : m_object_type_id(std::move(object_type_id))
    , m_section_id(std::move(section_id))
    , m_new_name(std::move(new_name))
{
}

void RenameLogicSectionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_section_id.empty() || m_new_name.empty()) {
        return;
    }
    LogicSectionDef *section = find_section(*type->logicBoard, m_section_id);
    if (!section) {
        return;
    }
    if (!m_captured) {
        m_old_name = section->name;
        m_captured = true;
    }
    if (section->name == m_new_name) {
        return; // no-op — do not mark applied
    }
    section->name = m_new_name;
    m_applied = true;
}

void RenameLogicSectionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicSectionDef *section = find_section(*type->logicBoard, m_section_id);
    if (section) {
        section->name = m_old_name;
    }
}

RemoveLogicSectionCommand::RemoveLogicSectionCommand(ObjectTypeId object_type_id,
                                                     std::string section_id)
    : m_object_type_id(std::move(object_type_id))
    , m_section_id(std::move(section_id))
{
}

void RemoveLogicSectionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_section_id.empty()) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    auto it = std::find_if(board.sections.begin(),
                           board.sections.end(),
                           [&](const LogicSectionDef &s) { return s.id == m_section_id; });
    if (it == board.sections.end()) {
        return;
    }
    if (!m_captured) {
        m_index = static_cast<std::size_t>(std::distance(board.sections.begin(), it));
        m_removed_section = *it;
        m_member_rule_ids.clear();
        for (const LogicRuleDef &rule : board.rules) {
            if (rule.sectionId == m_section_id) {
                m_member_rule_ids.push_back(rule.id);
            }
        }
        m_captured = true;
    }
    board.sections.erase(it);
    for (LogicRuleDef &rule : board.rules) {
        if (rule.sectionId == m_section_id) {
            rule.sectionId.clear();
        }
    }
    m_applied = true;
}

void RemoveLogicSectionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    if (!find_section(board, m_section_id)) {
        const std::size_t insert_at = std::min(m_index, board.sections.size());
        board.sections.insert(board.sections.begin() + static_cast<std::ptrdiff_t>(insert_at),
                              m_removed_section);
    }
    for (const LogicRuleId &rule_id : m_member_rule_ids) {
        if (LogicRuleDef *rule = find_rule(board, rule_id)) {
            rule->sectionId = m_section_id;
        }
    }
}

SetLogicRuleSectionCommand::SetLogicRuleSectionCommand(ObjectTypeId object_type_id,
                                                       LogicRuleId rule_id,
                                                       std::string section_id)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_section_id(std::move(section_id))
{
}

void SetLogicRuleSectionCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty()) {
        return;
    }
    LogicBoardDef &board = *type->logicBoard;
    LogicRuleDef *rule = find_rule(board, m_rule_id);
    if (!rule) {
        return;
    }
    if (!m_section_id.empty() && !find_section(board, m_section_id)) {
        return;
    }
    if (!m_captured) {
        m_old_section_id = rule->sectionId;
        m_captured = true;
    }
    if (rule->sectionId == m_section_id) {
        return; // no-op — do not mark applied
    }
    rule->sectionId = m_section_id;
    m_applied = true;
}

void SetLogicRuleSectionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (rule) {
        rule->sectionId = m_old_section_id;
    }
}

} // namespace ArtCade::EditorCore

#include "artcade/editor_core/editor_core.h"

#include "project-global-variables-format.h"

#include <cmath>
#include <algorithm>
#include <string>
#include <variant>

namespace ArtCade::EditorCore {
namespace {

bool value_matches_type(const GameVariableValue &value, GameVariableDefinition::Type type)
{
    switch (type) {
    case GameVariableDefinition::Type::Number:
        return std::holds_alternative<double>(value)
            && std::isfinite(std::get<double>(value));
    case GameVariableDefinition::Type::Boolean:
        return std::holds_alternative<bool>(value);
    case GameVariableDefinition::Type::String:
        return std::holds_alternative<std::string>(value);
    }
    return false;
}

std::size_t find_variable_index(const ProjectDoc &doc, const GameVariableId &id)
{
    for (std::size_t i = 0; i < doc.globalVariables.size(); ++i) {
        if (doc.globalVariables[i].key == id) return i;
    }
    return doc.globalVariables.size();
}

} // namespace

bool is_valid_game_variable_key(const std::string &key, std::string &error_message)
{
    return ProjectJson::is_valid_game_variable_key(key, error_message);
}

std::size_t count_logic_variable_references(const ProjectDoc &doc, const GameVariableId &id)
{
    if (id.empty()) return 0;
    std::size_t count = 0;
    auto scan_block = [&](const LogicBlockDef &block) {
        for (const LogicPropertyDef &property : block.properties) {
            if (property.key != "key") continue;
            const auto *ref = std::get_if<LogicVariableReference>(&property.value);
            if (ref && ref->id == id) ++count;
        }
    };
    for (const auto &[unused, type] : doc.objectTypes) {
        (void)unused;
        if (!type.logicBoard) continue;
        for (const LogicRuleDef &rule : type.logicBoard->rules) {
            scan_block(rule.trigger);
            for (const LogicBlockDef &block : rule.conditions) scan_block(block);
            for (const LogicBlockDef &block : rule.actions) scan_block(block);
        }
    }
    return count;
}

AddGameVariableCommand::AddGameVariableCommand(GameVariableDefinition definition)
    : m_definition(std::move(definition))
{
}

void AddGameVariableCommand::execute(ProjectDoc &doc)
{
    std::string error;
    if (!is_valid_game_variable_key(m_definition.key, error)) return;
    if (!value_matches_type(m_definition.initialValue, m_definition.type)) return;
    if (find_variable_index(doc, m_definition.key) < doc.globalVariables.size()) return;
    doc.globalVariables.push_back(m_definition);
    m_applied = true;
}

void AddGameVariableCommand::undo(ProjectDoc &doc)
{
    if (!m_applied) return;
    const std::size_t index = find_variable_index(doc, m_definition.key);
    if (index >= doc.globalVariables.size()) return;
    doc.globalVariables.erase(doc.globalVariables.begin() + static_cast<std::ptrdiff_t>(index));
}

RemoveGameVariableCommand::RemoveGameVariableCommand(GameVariableId id)
    : m_id(std::move(id))
{
}

void RemoveGameVariableCommand::execute(ProjectDoc &doc)
{
    if (count_logic_variable_references(doc, m_id) != 0) return;
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    if (!m_captured) {
        m_removed = doc.globalVariables[index];
        m_index = index;
        m_captured = true;
    }
    doc.globalVariables.erase(doc.globalVariables.begin() + static_cast<std::ptrdiff_t>(index));
    m_applied = true;
}

void RemoveGameVariableCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    if (find_variable_index(doc, m_removed.key) < doc.globalVariables.size()) return;
    const std::size_t insert_at = std::min(m_index, doc.globalVariables.size());
    doc.globalVariables.insert(
        doc.globalVariables.begin() + static_cast<std::ptrdiff_t>(insert_at), m_removed);
}

SetGameVariableInitialValueCommand::SetGameVariableInitialValueCommand(
    GameVariableId id, GameVariableValue value)
    : m_id(std::move(id))
    , m_new_value(std::move(value))
{
}

void SetGameVariableInitialValueCommand::execute(ProjectDoc &doc)
{
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    GameVariableDefinition &def = doc.globalVariables[index];
    if (!value_matches_type(m_new_value, def.type)) return;
    if (!m_captured) {
        m_old_value = def.initialValue;
        m_captured = true;
    }
    if (m_old_value == m_new_value) return;
    def.initialValue = m_new_value;
    m_applied = true;
}

void SetGameVariableInitialValueCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    doc.globalVariables[index].initialValue = m_old_value;
}

SetGameVariableTypeCommand::SetGameVariableTypeCommand(GameVariableId id,
                                                       GameVariableDefinition::Type new_type,
                                                       GameVariableValue new_initial_value)
    : m_id(std::move(id))
    , m_new_type(new_type)
    , m_new_initial(std::move(new_initial_value))
{
}

void SetGameVariableTypeCommand::execute(ProjectDoc &doc)
{
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    GameVariableDefinition &def = doc.globalVariables[index];
    if (def.type == m_new_type || count_logic_variable_references(doc, m_id) != 0
        || !value_matches_type(m_new_initial, m_new_type)) return;
    if (!m_captured) {
        m_old_type = def.type;
        m_old_initial = def.initialValue;
        m_captured = true;
    }
    if (m_old_type == m_new_type && m_old_initial == m_new_initial) return;
    def.type = m_new_type;
    def.initialValue = m_new_initial;
    m_applied = true;
}

void SetGameVariableTypeCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    doc.globalVariables[index].type = m_old_type;
    doc.globalVariables[index].initialValue = m_old_initial;
}

SetGameVariableDescriptionCommand::SetGameVariableDescriptionCommand(GameVariableId id,
                                                                     std::string description)
    : m_id(std::move(id))
    , m_new_description(std::move(description))
{
}

void SetGameVariableDescriptionCommand::execute(ProjectDoc &doc)
{
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    GameVariableDefinition &def = doc.globalVariables[index];
    if (!m_captured) {
        m_old_description = def.description;
        m_captured = true;
    }
    if (m_old_description == m_new_description) return;
    def.description = m_new_description;
    m_applied = true;
}

void SetGameVariableDescriptionCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) return;
    const std::size_t index = find_variable_index(doc, m_id);
    if (index >= doc.globalVariables.size()) return;
    doc.globalVariables[index].description = m_old_description;
}

} // namespace ArtCade::EditorCore

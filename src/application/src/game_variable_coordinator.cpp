#include "artcade/editor_core/editor_core.h"

#include <cmath>
#include <optional>
#include <string>

namespace ArtCade::EditorCore {
namespace {

std::optional<GameVariableDefinition::Type> parse_variable_type(const std::string &type_id)
{
    if (type_id == "number") return GameVariableDefinition::Type::Number;
    if (type_id == "boolean") return GameVariableDefinition::Type::Boolean;
    if (type_id == "string") return GameVariableDefinition::Type::String;
    return std::nullopt;
}

GameVariableValue default_initial(GameVariableDefinition::Type type)
{
    switch (type) {
    case GameVariableDefinition::Type::Number:
        return 0.0;
    case GameVariableDefinition::Type::Boolean:
        return false;
    case GameVariableDefinition::Type::String:
        return std::string{};
    }
    return 0.0;
}

const GameVariableDefinition *find_game_variable(const ProjectDoc &document,
                                                 const GameVariableId &id)
{
    for (const GameVariableDefinition &definition : document.globalVariables) {
        if (definition.key == id) return &definition;
    }
    return nullptr;
}

} // namespace

bool EditorCoordinator::addGameVariable(const std::string &key,
                                        const std::string &type_id,
                                        std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!is_valid_game_variable_key(key, error_message)) return false;
    const auto type = parse_variable_type(type_id);
    if (!type) {
        error_message = "Unknown variable type";
        return false;
    }
    for (const GameVariableDefinition &existing : m_doc.globalVariables) {
        if (existing.key == key) {
            error_message = "A variable with this key already exists";
            return false;
        }
    }
    GameVariableDefinition def;
    def.key = key;
    def.type = *type;
    def.initialValue = default_initial(*type);
    auto command = std::make_unique<AddGameVariableCommand>(std::move(def));
    command->execute(m_doc);
    if (!command->applied()) {
        error_message = "Could not add variable";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::removeGameVariable(const GameVariableId &id, std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (id.empty()) {
        error_message = "Variable key is empty";
        return false;
    }
    const std::size_t references = count_logic_variable_references(m_doc, id);
    if (references != 0) {
        error_message = "Variable is referenced by " + std::to_string(references)
                        + " Logic item(s). Remove or replace those references first.";
        return false;
    }
    auto command = std::make_unique<RemoveGameVariableCommand>(id);
    command->execute(m_doc);
    if (!command->applied()) {
        error_message = "Variable not found";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setGameVariableInitialNumber(const GameVariableId &id,
                                                     double value,
                                                     std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!std::isfinite(value)) {
        error_message = "Number variables must contain finite values";
        return false;
    }
    const GameVariableDefinition *definition = find_game_variable(m_doc, id);
    if (!definition) {
        error_message = "Variable not found";
        return false;
    }
    if (definition->type != GameVariableDefinition::Type::Number) {
        error_message = "Variable is not a Number";
        return false;
    }
    if (definition->initialValue == GameVariableValue{value}) return true;
    auto command = std::make_unique<SetGameVariableInitialValueCommand>(id, value);
    command->execute(m_doc);
    if (!command->applied()) {
        error_message = "Could not set initial value";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setGameVariableInitialBoolean(const GameVariableId &id,
                                                      bool value,
                                                      std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    const GameVariableDefinition *definition = find_game_variable(m_doc, id);
    if (!definition) {
        error_message = "Variable not found";
        return false;
    }
    if (definition->type != GameVariableDefinition::Type::Boolean) {
        error_message = "Variable is not a Boolean";
        return false;
    }
    if (definition->initialValue == GameVariableValue{value}) return true;
    auto command = std::make_unique<SetGameVariableInitialValueCommand>(id, value);
    command->execute(m_doc);
    if (!command->applied()) {
        error_message = "Could not set initial value";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setGameVariableInitialString(const GameVariableId &id,
                                                     const std::string &value,
                                                     std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    const GameVariableDefinition *definition = find_game_variable(m_doc, id);
    if (!definition) {
        error_message = "Variable not found";
        return false;
    }
    if (definition->type != GameVariableDefinition::Type::String) {
        error_message = "Variable is not a String";
        return false;
    }
    if (definition->initialValue == GameVariableValue{value}) return true;
    auto command = std::make_unique<SetGameVariableInitialValueCommand>(id, value);
    command->execute(m_doc);
    if (!command->applied()) {
        error_message = "Could not set initial value";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setGameVariableType(const GameVariableId &id,
                                            const std::string &type_id,
                                            std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    const auto type = parse_variable_type(type_id);
    if (!type) {
        error_message = "Unknown variable type";
        return false;
    }
    const GameVariableDefinition *definition = find_game_variable(m_doc, id);
    if (!definition) {
        error_message = "Variable not found";
        return false;
    }
    if (definition->type == *type) return true;
    const std::size_t references = count_logic_variable_references(m_doc, id);
    if (references != 0) {
        error_message = "Variable is referenced by " + std::to_string(references)
                        + " Logic item(s). Change those references before changing its type.";
        return false;
    }
    auto command = std::make_unique<SetGameVariableTypeCommand>(
        id, *type, default_initial(*type));
    command->execute(m_doc);
    if (!command->applied()) {
        error_message = "Could not change variable type";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setGameVariableDescription(const GameVariableId &id,
                                                   const std::string &description,
                                                   std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    const GameVariableDefinition *definition = find_game_variable(m_doc, id);
    if (!definition) {
        error_message = "Variable not found";
        return false;
    }
    if (definition->description == description) return true;
    auto command = std::make_unique<SetGameVariableDescriptionCommand>(id, description);
    command->execute(m_doc);
    if (!command->applied()) {
        // No-op same description is fine.
        return true;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

std::size_t EditorCoordinator::logicReferenceCount(const GameVariableId &id) const
{
    if (!m_has_project) return 0;
    return count_logic_variable_references(m_doc, id);
}

} // namespace ArtCade::EditorCore

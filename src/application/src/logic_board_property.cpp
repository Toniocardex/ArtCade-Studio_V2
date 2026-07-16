#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <sstream>
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

LogicRuleDef *find_rule(LogicBoardDef &board, const LogicRuleId &rule_id)
{
    for (LogicRuleDef &rule : board.rules) {
        if (rule.id == rule_id) {
            return &rule;
        }
    }
    return nullptr;
}

LogicBlockDef *block_for_slot(LogicRuleDef &rule, LogicRuleBlockSlot slot)
{
    switch (slot) {
    case LogicRuleBlockSlot::Trigger:
        return &rule.trigger;
    case LogicRuleBlockSlot::PrimaryCondition:
        return rule.conditions.empty() ? nullptr : &rule.conditions.front();
    case LogicRuleBlockSlot::PrimaryAction:
        return rule.actions.empty() ? nullptr : &rule.actions.front();
    }
    return nullptr;
}

LogicPropertyDef *find_property_mut(LogicBlockDef &block, const std::string &key)
{
    for (LogicPropertyDef &prop : block.properties) {
        if (prop.key == key) {
            return &prop;
        }
    }
    return nullptr;
}

bool is_authorable_kind(ArtCade::Logic::LogicValueKind kind)
{
    using ArtCade::Logic::LogicValueKind;
    switch (kind) {
    case LogicValueKind::Bool:
    case LogicValueKind::Integer:
    case LogicValueKind::Number:
    case LogicValueKind::String:
    case LogicValueKind::Key:
        return true;
    default:
        return false;
    }
}

std::string logic_value_kind_id(ArtCade::Logic::LogicValueKind kind)
{
    using ArtCade::Logic::LogicValueKind;
    switch (kind) {
    case LogicValueKind::Bool:
        return "bool";
    case LogicValueKind::Integer:
        return "integer";
    case LogicValueKind::Number:
        return "number";
    case LogicValueKind::String:
        return "string";
    case LogicValueKind::Key:
        return "key";
    default:
        return "unknown";
    }
}

std::string logic_value_to_text(const LogicValue &value)
{
    if (std::holds_alternative<bool>(value)) {
        return std::get<bool>(value) ? "true" : "false";
    }
    if (std::holds_alternative<std::int64_t>(value)) {
        return std::to_string(std::get<std::int64_t>(value));
    }
    if (std::holds_alternative<double>(value)) {
        std::ostringstream oss;
        oss << std::get<double>(value);
        return oss.str();
    }
    if (std::holds_alternative<LogicStringValue>(value)) {
        return std::get<LogicStringValue>(value).value;
    }
    if (std::holds_alternative<LogicKey>(value)) {
        return ArtCade::Logic::logicKeyName(std::get<LogicKey>(value));
    }
    return {};
}

} // namespace

bool logic_values_equal(const LogicValue &a, const LogicValue &b)
{
    if (a.index() != b.index()) {
        return false;
    }
    if (std::holds_alternative<bool>(a)) {
        return std::get<bool>(a) == std::get<bool>(b);
    }
    if (std::holds_alternative<std::int64_t>(a)) {
        return std::get<std::int64_t>(a) == std::get<std::int64_t>(b);
    }
    if (std::holds_alternative<double>(a)) {
        return std::get<double>(a) == std::get<double>(b);
    }
    if (std::holds_alternative<LogicStringValue>(a)) {
        return std::get<LogicStringValue>(a).value == std::get<LogicStringValue>(b).value;
    }
    if (std::holds_alternative<LogicKey>(a)) {
        return std::get<LogicKey>(a) == std::get<LogicKey>(b);
    }
    return false;
}

bool logic_value_parse(ArtCade::Logic::LogicValueKind kind,
                       const std::string &text,
                       LogicValue &out,
                       std::string &error_message)
{
    using ArtCade::Logic::LogicValueKind;
    switch (kind) {
    case LogicValueKind::Bool: {
        if (text == "true" || text == "1") {
            out = true;
            return true;
        }
        if (text == "false" || text == "0") {
            out = false;
            return true;
        }
        error_message = "Expected true or false";
        return false;
    }
    case LogicValueKind::Integer: {
        try {
            size_t consumed = 0;
            const long long parsed = std::stoll(text, &consumed);
            if (consumed != text.size()) {
                error_message = "Invalid integer";
                return false;
            }
            out = static_cast<std::int64_t>(parsed);
            return true;
        } catch (...) {
            error_message = "Invalid integer";
            return false;
        }
    }
    case LogicValueKind::Number: {
        try {
            size_t consumed = 0;
            const double parsed = std::stod(text, &consumed);
            if (consumed != text.size() || !std::isfinite(parsed)) {
                error_message = "Invalid number";
                return false;
            }
            out = parsed;
            return true;
        } catch (...) {
            error_message = "Invalid number";
            return false;
        }
    }
    case LogicValueKind::String:
        out = LogicStringValue{text};
        return true;
    case LogicValueKind::Key: {
        const auto key = ArtCade::Logic::logicKeyFromName(text);
        if (!key) {
            error_message = "Unknown key name";
            return false;
        }
        out = *key;
        return true;
    }
    default:
        error_message = "Property kind is not editable yet";
        return false;
    }
}

std::vector<LogicPropertySummary> logic_block_authorable_properties(const LogicBlockDef &block)
{
    std::vector<LogicPropertySummary> out;
    if (block.typeId.empty()) {
        return out;
    }
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(block.typeId);
    if (!desc) {
        return out;
    }
    for (const ArtCade::Logic::LogicPropertyDescriptor &prop_desc : desc->properties) {
        if (!is_authorable_kind(prop_desc.valueKind)) {
            continue;
        }
        LogicPropertySummary row;
        row.key = prop_desc.key;
        row.kind = logic_value_kind_id(prop_desc.valueKind);
        const LogicPropertyDef *current = ArtCade::Logic::findProperty(block, prop_desc.key);
        row.value = logic_value_to_text(current ? current->value : prop_desc.defaultValue);
        out.push_back(std::move(row));
    }
    return out;
}

SetLogicRuleBlockPropertyCommand::SetLogicRuleBlockPropertyCommand(
    ObjectTypeId object_type_id,
    LogicRuleId rule_id,
    LogicRuleBlockSlot slot,
    std::string property_key,
    LogicValue new_value)
    : m_object_type_id(std::move(object_type_id))
    , m_rule_id(std::move(rule_id))
    , m_slot(slot)
    , m_property_key(std::move(property_key))
    , m_new_value(std::move(new_value))
{
}

void SetLogicRuleBlockPropertyCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type || !type->logicBoard || m_rule_id.empty() || m_property_key.empty()) {
        return;
    }
    LogicRuleDef *rule = find_rule(*type->logicBoard, m_rule_id);
    if (!rule) {
        return;
    }
    LogicBlockDef *block = block_for_slot(*rule, m_slot);
    if (!block) {
        return;
    }
    LogicPropertyDef *prop = find_property_mut(*block, m_property_key);
    if (!m_captured) {
        m_had_property = prop != nullptr;
        if (prop) {
            m_old_value = prop->value;
        }
        m_captured = true;
    }
    if (prop && logic_values_equal(prop->value, m_new_value)) {
        return;
    }
    if (prop) {
        prop->value = m_new_value;
    } else {
        block->properties.push_back(LogicPropertyDef{m_property_key, m_new_value});
    }
    m_applied = true;
}

void SetLogicRuleBlockPropertyCommand::undo(ProjectDoc &doc)
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
    LogicBlockDef *block = block_for_slot(*rule, m_slot);
    if (!block) {
        return;
    }
    if (m_had_property) {
        LogicPropertyDef *prop = find_property_mut(*block, m_property_key);
        if (prop) {
            prop->value = m_old_value;
        }
        return;
    }
    block->properties.erase(
        std::remove_if(block->properties.begin(),
                       block->properties.end(),
                       [this](const LogicPropertyDef &prop) {
                           return prop.key == m_property_key;
                       }),
        block->properties.end());
}

} // namespace ArtCade::EditorCore

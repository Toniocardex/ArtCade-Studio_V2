#include "../include/logic-core.h"

#include <nlohmann/json.hpp>

#include <exception>
#include <unordered_set>

namespace ArtCade::Logic {
namespace {

nlohmann::json valueToJson(const LogicValue& value) {
    if (const bool* v = std::get_if<bool>(&value)) return {{"kind", "bool"}, {"value", *v}};
    if (const int64_t* v = std::get_if<int64_t>(&value)) return {{"kind", "integer"}, {"value", *v}};
    if (const double* v = std::get_if<double>(&value)) return {{"kind", "number"}, {"value", *v}};
    if (const LogicStringValue* v = std::get_if<LogicStringValue>(&value))
        return {{"kind", "string"}, {"value", v->value}};
    if (const Vec2* v = std::get_if<Vec2>(&value))
        return {{"kind", "vec2"}, {"x", v->x}, {"y", v->y}};
    if (const LogicAssetReference* v = std::get_if<LogicAssetReference>(&value))
        return {{"kind", "asset"}, {"id", v->id}};
    if (std::holds_alternative<LogicEntityReference>(value))
        return {{"kind", "entity"}, {"target", "self"}};
    if (const LogicVariableReference* v = std::get_if<LogicVariableReference>(&value))
        return {{"kind", "variable"}, {"id", v->id}};
    return {{"kind", "key"}, {"value", logicKeyName(std::get<LogicKey>(value))}};
}

bool readString(const nlohmann::json& json, const char* key, std::string& out) {
    if (!json.contains(key) || !json[key].is_string()) return false;
    out = json[key].get<std::string>();
    return true;
}

bool valueFromJson(const nlohmann::json& json, LogicValue& out, std::string& error) {
    if (!json.is_object()) { error = "Logic property value must be an object"; return false; }
    std::string kind;
    if (!readString(json, "kind", kind)) { error = "Logic property value kind is missing"; return false; }
    if (kind == "bool" && json.contains("value") && json["value"].is_boolean()) {
        out = json["value"].get<bool>(); return true;
    }
    if (kind == "integer" && json.contains("value") && json["value"].is_number_integer()) {
        out = json["value"].get<int64_t>(); return true;
    }
    if (kind == "number" && json.contains("value") && json["value"].is_number()) {
        out = json["value"].get<double>(); return true;
    }
    if (kind == "string" && json.contains("value") && json["value"].is_string()) {
        out = LogicStringValue{json["value"].get<std::string>()}; return true;
    }
    if (kind == "vec2" && json.contains("x") && json.contains("y")
        && json["x"].is_number() && json["y"].is_number()) {
        out = Vec2{json["x"].get<float>(), json["y"].get<float>()}; return true;
    }
    if (kind == "asset") {
        std::string id;
        if (readString(json, "id", id)) { out = LogicAssetReference{std::move(id)}; return true; }
    }
    if (kind == "entity") {
        std::string target;
        if (readString(json, "target", target) && target == "self") {
            out = LogicEntityReference{}; return true;
        }
    }
    if (kind == "variable") {
        std::string id;
        if (readString(json, "id", id)) { out = LogicVariableReference{std::move(id)}; return true; }
    }
    if (kind == "key" && json.contains("value") && json["value"].is_string()) {
        const auto key = logicKeyFromName(json["value"].get<std::string>());
        if (key) { out = *key; return true; }
    }
    error = "Logic property value is invalid or unsupported";
    return false;
}

nlohmann::json blockToJson(const LogicBlockDef& block) {
    nlohmann::json properties = nlohmann::json::array();
    for (const LogicPropertyDef& property : block.properties)
        properties.push_back({{"key", property.key}, {"value", valueToJson(property.value)}});
    return {{"typeId", block.typeId}, {"properties", std::move(properties)}};
}

bool blockFromJson(const nlohmann::json& json, LogicBlockDef& out, std::string& error) {
    if (!json.is_object() || !readString(json, "typeId", out.typeId)) {
        error = "Logic block typeId is missing"; return false;
    }
    if (!json.contains("properties") || !json["properties"].is_array()) {
        error = "Logic block properties must be an array"; return false;
    }
    out.properties.clear();
    std::unordered_set<std::string> seen;
    for (const auto& item : json["properties"]) {
        LogicPropertyDef property;
        if (!item.is_object() || !readString(item, "key", property.key)
            || !item.contains("value")) {
            error = "Logic property is malformed"; return false;
        }
        if (!seen.insert(property.key).second) {
            error = "Duplicate Logic property: " + property.key; return false;
        }
        if (!valueFromJson(item["value"], property.value, error)) return false;
        out.properties.push_back(std::move(property));
    }
    return true;
}

} // namespace

nlohmann::json logicBoardToJson(const LogicBoardDef& board) {
    nlohmann::json rules = nlohmann::json::array();
    for (const LogicRuleDef& rule : board.rules) {
        nlohmann::json conditions = nlohmann::json::array();
        for (const LogicBlockDef& block : rule.conditions) conditions.push_back(blockToJson(block));
        nlohmann::json actions = nlohmann::json::array();
        for (const LogicBlockDef& block : rule.actions) actions.push_back(blockToJson(block));
        rules.push_back({
            {"id", rule.id}, {"enabled", rule.enabled},
            {"trigger", blockToJson(rule.trigger)},
            {"conditions", std::move(conditions)},
            {"actions", std::move(actions)},
        });
    }
    return {
        {"id", board.id},
        {"schemaVersion", board.schemaVersion},
        {"apiVersion", board.apiVersion},
        {"rules", std::move(rules)},
    };
}

LogicJsonResult logicBoardFromJson(const nlohmann::json& json, LogicBoardDef& out) {
    try {
        if (!json.is_object()) return {false, "Logic Board must be an object"};
        LogicBoardDef parsed;
        if (!readString(json, "id", parsed.id)) return {false, "Logic Board id is missing"};
        if (!json.contains("schemaVersion") || !json["schemaVersion"].is_number_unsigned())
            return {false, "Logic Board schemaVersion is invalid"};
        if (!json.contains("apiVersion") || !json["apiVersion"].is_number_unsigned())
            return {false, "Logic Board apiVersion is invalid"};
        parsed.schemaVersion = json["schemaVersion"].get<uint32_t>();
        parsed.apiVersion = json["apiVersion"].get<uint32_t>();
        if (!json.contains("rules") || !json["rules"].is_array())
            return {false, "Logic Board rules must be an array"};

        std::unordered_set<std::string> ruleIds;
        for (const auto& item : json["rules"]) {
            if (!item.is_object()) return {false, "Logic rule must be an object"};
            LogicRuleDef rule;
            if (!readString(item, "id", rule.id)) return {false, "Logic rule id is missing"};
            if (!ruleIds.insert(rule.id).second) return {false, "Duplicate Logic rule id"};
            if (!item.contains("enabled") || !item["enabled"].is_boolean())
                return {false, "Logic rule enabled is invalid"};
            rule.enabled = item["enabled"].get<bool>();
            std::string error;
            if (!item.contains("trigger") || !blockFromJson(item["trigger"], rule.trigger, error))
                return {false, error.empty() ? "Logic rule trigger is missing" : error};
            if (!item.contains("conditions") || !item["conditions"].is_array())
                return {false, "Logic rule conditions must be an array"};
            if (!item.contains("actions") || !item["actions"].is_array())
                return {false, "Logic rule actions must be an array"};
            for (const auto& raw : item["conditions"]) {
                LogicBlockDef block;
                if (!blockFromJson(raw, block, error)) return {false, error};
                rule.conditions.push_back(std::move(block));
            }
            for (const auto& raw : item["actions"]) {
                LogicBlockDef block;
                if (!blockFromJson(raw, block, error)) return {false, error};
                rule.actions.push_back(std::move(block));
            }
            parsed.rules.push_back(std::move(rule));
        }
        out = std::move(parsed);
        return {true, {}};
    } catch (const std::exception& e) {
        return {false, std::string("Logic Board JSON error: ") + e.what()};
    }
}

} // namespace ArtCade::Logic


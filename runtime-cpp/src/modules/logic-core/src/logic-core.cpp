#include "../include/logic-core.h"

#include <algorithm>
#include <cmath>
#include <iterator>
#include <set>
#include <sstream>
#include <unordered_set>

namespace ArtCade::Logic {
namespace {

LogicEntityReference selfReference() { return {}; }

LogicDiagnostic makeError(const ObjectTypeId& objectTypeId, const LogicBoardDef& board,
                          std::string code, std::string message,
                          const LogicRuleDef* rule = nullptr,
                          const LogicBlockDef* block = nullptr,
                          std::string property = {}) {
    LogicDiagnostic d;
    d.objectTypeId = objectTypeId;
    d.boardId = board.id;
    d.ruleId = rule ? rule->id : LogicRuleId{};
    d.blockTypeId = block ? block->typeId : std::string{};
    d.propertyKey = std::move(property);
    d.code = std::move(code);
    d.message = std::move(message);
    return d;
}

LogicValueKind kindOf(const LogicValue& value) {
    if (std::holds_alternative<bool>(value)) return LogicValueKind::Bool;
    if (std::holds_alternative<int64_t>(value)) return LogicValueKind::Integer;
    if (std::holds_alternative<double>(value)) return LogicValueKind::Number;
    if (std::holds_alternative<LogicStringValue>(value)) return LogicValueKind::String;
    if (std::holds_alternative<Vec2>(value)) return LogicValueKind::Vec2;
    if (std::holds_alternative<LogicAssetReference>(value)) return LogicValueKind::Asset;
    if (std::holds_alternative<LogicEntityReference>(value)) return LogicValueKind::Entity;
    if (std::holds_alternative<LogicVariableReference>(value)) return LogicValueKind::Variable;
    return LogicValueKind::Key;
}

bool validId(const std::string& id) {
    return !id.empty() && id.size() <= kMaxLogicIdLength;
}

bool ownerHasComponent(const EntityDef& owner, LogicRequiredComponent component) {
    switch (component) {
        case LogicRequiredComponent::PlatformerController:
            return owner.platformerController.has_value();
    }
    return false;
}

bool containsCapability(const std::vector<LogicContextCapability>& values,
                        LogicContextCapability expected) {
    return std::find(values.begin(), values.end(), expected) != values.end();
}

LogicBlockAvailability availabilityFor(const EntityDef& owner,
                                       const LogicBlockDescriptor& candidate,
                                       const LogicBlockDescriptor* trigger) {
    for (const LogicRequiredComponent component : candidate.requiredComponents) {
        if (!ownerHasComponent(owner, component)) {
            switch (component) {
                case LogicRequiredComponent::PlatformerController:
                    return {false, "Requires Platformer Controller"};
            }
        }
    }
    for (const LogicContextCapability capability : candidate.requiredContext) {
        if (!trigger || !containsCapability(trigger->providedContext, capability)) {
            return {false, "Requires a trigger that provides the required context"};
        }
    }
    return {};
}

void validateBlock(const ObjectTypeId& objectTypeId, const LogicBoardDef& board,
                   const LogicRuleDef& rule, const LogicBlockDef& block,
                   BlockKind expected, const EntityDef* owner,
                   const LogicBlockDescriptor* trigger,
                   const ProjectDoc* project,
                   std::vector<LogicDiagnostic>& out) {
    const LogicBlockDescriptor* descriptor = findDescriptor(block.typeId);
    if (!descriptor) {
        out.push_back(makeError(objectTypeId, board, "LB_UNKNOWN_BLOCK",
                                "Unknown Logic Board block type: " + block.typeId,
                                &rule, &block));
        return;
    }
    if (descriptor->kind != expected) {
        out.push_back(makeError(objectTypeId, board, "LB_WRONG_BLOCK_KIND",
                                "Block is used in the wrong rule section", &rule, &block));
        return;
    }
    if (owner) {
        const LogicBlockAvailability availability = availabilityFor(*owner, *descriptor, trigger);
        if (!availability.compatible) {
            out.push_back(makeError(objectTypeId, board, "LB_INCOMPATIBLE_BLOCK",
                                    availability.reason, &rule, &block));
        }
    }

    std::unordered_set<std::string> seen;
    for (const LogicPropertyDef& property : block.properties) {
        if (!seen.insert(property.key).second) {
            out.push_back(makeError(objectTypeId, board, "LB_DUPLICATE_PROPERTY",
                                    "Duplicate property: " + property.key,
                                    &rule, &block, property.key));
            continue;
        }
        const auto it = std::find_if(descriptor->properties.begin(), descriptor->properties.end(),
            [&](const LogicPropertyDescriptor& p) { return p.key == property.key; });
        if (it == descriptor->properties.end()) {
            out.push_back(makeError(objectTypeId, board, "LB_UNKNOWN_PROPERTY",
                                    "Unknown property: " + property.key,
                                    &rule, &block, property.key));
            continue;
        }
        if (kindOf(property.value) != it->valueKind) {
            out.push_back(makeError(objectTypeId, board, "LB_PROPERTY_TYPE",
                                    "Property has the wrong value type: " + property.key,
                                    &rule, &block, property.key));
        }
        if (const Vec2* v = std::get_if<Vec2>(&property.value)) {
            if (!std::isfinite(v->x) || !std::isfinite(v->y)) {
                out.push_back(makeError(objectTypeId, board, "LB_NON_FINITE",
                                        "Vec2 property must contain finite values",
                                        &rule, &block, property.key));
            }
        }
        if (const double* value = std::get_if<double>(&property.value)) {
            if (!std::isfinite(*value)) {
                out.push_back(makeError(objectTypeId, board, "LB_NON_FINITE",
                                        "Number property must be finite", &rule, &block,
                                        property.key));
            } else if (block.typeId == kMoveHorizontal && property.key == "axis"
                       && (*value < -1.0 || *value > 1.0)) {
                out.push_back(makeError(objectTypeId, board, "LB_AXIS_RANGE",
                                        "Platformer movement axis must be between -1 and 1",
                                        &rule, &block, property.key));
            }
        }
        if (block.typeId == kOtherIsObjectType && property.key == "objectTypeId") {
            const auto* referencedType = std::get_if<LogicStringValue>(&property.value);
            if (!referencedType || referencedType->value.empty()
                || (project && project->objectTypes.count(referencedType->value) == 0)) {
                out.push_back(makeError(objectTypeId, board, "LB_OBJECT_TYPE_REFERENCE",
                                        "Collision object type must reference an existing Object Type",
                                        &rule, &block, property.key));
            }
        }
    }
    for (const LogicPropertyDescriptor& property : descriptor->properties) {
        if (!findProperty(block, property.key)) {
            out.push_back(makeError(objectTypeId, board, "LB_MISSING_PROPERTY",
                                    "Missing property: " + property.key,
                                    &rule, &block, property.key));
        }
    }
}

std::string escapeLua(const std::string& value) {
    std::string out;
    out.reserve(value.size() + 8);
    for (char c : value) {
        switch (c) {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += c; break;
        }
    }
    return out;
}

void emitAction(std::ostringstream& lua, const LogicBlockDef& action,
                std::set<std::string>& features) {
    if (action.typeId == kSetVisible) {
        const LogicPropertyDef* p = findProperty(action, "visible");
        const bool value = std::get<bool>(p->value);
        lua << "      context.self:set_visible(" << (value ? "true" : "false") << ")\n";
    } else if (action.typeId == kSetPosition) {
        const LogicPropertyDef* p = findProperty(action, "position");
        const Vec2 value = std::get<Vec2>(p->value);
        lua << "      context.self:set_position(" << value.x << ", " << value.y << ")\n";
    } else if (action.typeId == kMoveHorizontal) {
        const LogicPropertyDef* p = findProperty(action, "axis");
        lua << "      context.self:platformer_move(" << std::get<double>(p->value) << ")\n";
    } else if (action.typeId == kJump) {
        lua << "      context.self:platformer_jump()\n";
    } else if (action.typeId == kDestroySelf) {
        lua << "      context.self:destroy_self()\n";
    }
    if (const LogicBlockDescriptor* descriptor = findDescriptor(action.typeId))
        if (!descriptor->requiredFeature.empty()) features.insert(descriptor->requiredFeature);
}

// Conditions gate the rule's actions behind a single `if ... then` guard,
// ANDed together (MVP semantics: no OR/grouping yet). Zero conditions means
// no guard is emitted and actions run unconditionally, matching the trigger
// firing with no gate at all.
bool emitConditionGuard(std::ostringstream& lua, const std::vector<LogicBlockDef>& conditions,
                        std::set<std::string>& features) {
    if (conditions.empty()) return false;
    lua << "    if ";
    for (std::size_t i = 0; i < conditions.size(); ++i) {
        if (i > 0) lua << " and ";
        const LogicBlockDef& condition = conditions[i];
        if (condition.typeId == kIsGrounded) {
            const LogicPropertyDef* p = findProperty(condition, "expected");
            const bool expected = p ? std::get<bool>(p->value) : true;
            lua << "context.self:is_grounded() == " << (expected ? "true" : "false");
        } else if (condition.typeId == kOtherIsObjectType) {
            const LogicPropertyDef* p = findProperty(condition, "objectTypeId");
            const auto* type = p ? std::get_if<LogicStringValue>(&p->value) : nullptr;
            lua << "context:other_is_object_type(other, \""
                << escapeLua(type ? type->value : std::string{}) << "\")";
        }
        if (const LogicBlockDescriptor* descriptor = findDescriptor(condition.typeId))
            if (!descriptor->requiredFeature.empty()) features.insert(descriptor->requiredFeature);
    }
    lua << " then\n";
    return true;
}

} // namespace

bool LogicCompileResult::ok() const {
    return std::none_of(diagnostics.begin(), diagnostics.end(),
        [](const LogicDiagnostic& d) { return d.severity == DiagnosticSeverity::Error; });
}

const std::vector<LogicBlockDescriptor>& registry() {
    static const std::vector<LogicBlockDescriptor> value{
        {kOnStart, "system", "On Start", "Runs once when Play begins.",
            BlockKind::Trigger, {}, {}, {}, {LogicContextCapability::Self}, "event.start"},
        {kKeyPressed, "input", "Key Pressed", "Runs when the selected key is pressed.",
            BlockKind::Trigger, {{"key", LogicValueKind::Key, LogicKey::Space}}, {}, {},
            {LogicContextCapability::Self}, "input.key_pressed"},
        {kKeyReleased, "input", "Key Released", "Runs when the selected key is released.",
            BlockKind::Trigger, {{"key", LogicValueKind::Key, LogicKey::Space}}, {}, {},
            {LogicContextCapability::Self}, "input.key_released"},
        {kKeyHeld, "input", "While Key Held", "Runs once per tick while the selected key is held.",
            BlockKind::Trigger, {{"key", LogicValueKind::Key, LogicKey::Space}}, {}, {},
            {LogicContextCapability::Self}, "input.key_held", true},
        {kSetVisible, "entity", "Set Visible", "Shows or hides Self.",
            BlockKind::Action,
            {{"target", LogicValueKind::Entity, selfReference()},
             {"visible", LogicValueKind::Bool, true}},
            {}, {LogicContextCapability::Self}, {}, "entity.visibility"},
        {kSetPosition, "entity", "Set Position", "Moves Self to a world position.",
            BlockKind::Action,
            {{"target", LogicValueKind::Entity, selfReference()},
             {"position", LogicValueKind::Vec2, Vec2{}}},
            {}, {LogicContextCapability::Self}, {}, "entity.transform"},
        {kIsGrounded, "platformer", "Is Grounded", "Checks whether Self is touching valid ground.",
            BlockKind::Condition, {{"expected", LogicValueKind::Bool, true}},
            {LogicRequiredComponent::PlatformerController}, {LogicContextCapability::Self}, {},
            "platformer.grounded"},
        {kMoveHorizontal, "platformer", "Move Horizontal", "Requests horizontal platformer movement.",
            BlockKind::Action, {{"axis", LogicValueKind::Number, 0.0}},
            {LogicRequiredComponent::PlatformerController}, {LogicContextCapability::Self}, {},
            "platformer.move"},
        {kJump, "platformer", "Jump", "Requests a platformer jump.",
            BlockKind::Action, {}, {LogicRequiredComponent::PlatformerController},
            {LogicContextCapability::Self}, {}, "platformer.jump"},
        {kCollisionEnter, "collision", "On Collision Enter", "Runs once when Self begins overlapping another collider.",
            BlockKind::Trigger, {}, {}, {},
            {LogicContextCapability::Self, LogicContextCapability::EventOther,
             LogicContextCapability::CollisionContact}, "collision.enter"},
        {kCollisionExit, "collision", "On Collision Exit", "Runs once when Self stops overlapping another collider.",
            BlockKind::Trigger, {}, {}, {},
            {LogicContextCapability::Self, LogicContextCapability::EventOther,
             LogicContextCapability::CollisionContact}, "collision.exit"},
        {kOtherIsObjectType, "collision", "Other Is Object Type", "Checks the Object Type of collision Other.",
            BlockKind::Condition,
            {{"objectTypeId", LogicValueKind::String, LogicStringValue{}}},
            {}, {LogicContextCapability::EventOther}, {}, "collision.other_type"},
        {kDestroySelf, "entity", "Destroy Self", "Removes Self from the runtime world after event dispatch.",
            BlockKind::Action, {}, {}, {LogicContextCapability::Self}, {}, "entity.destroy"},
    };
    return value;
}

const LogicBlockDescriptor* findDescriptor(const std::string& typeId) {
    const auto& all = registry();
    const auto it = std::find_if(all.begin(), all.end(),
        [&](const LogicBlockDescriptor& d) { return d.typeId == typeId; });
    return it == all.end() ? nullptr : &*it;
}

const LogicPropertyDef* findProperty(const LogicBlockDef& block, const std::string& key) {
    const auto it = std::find_if(block.properties.begin(), block.properties.end(),
        [&](const LogicPropertyDef& p) { return p.key == key; });
    return it == block.properties.end() ? nullptr : &*it;
}

LogicBlockDef makeDefaultBlock(const LogicBlockTypeId& typeId, BlockKind expected) {
    const LogicBlockDescriptor* descriptor = findDescriptor(typeId);
    if (!descriptor || descriptor->kind != expected) return {};
    LogicBlockDef block;
    block.typeId = descriptor->typeId;
    for (const LogicPropertyDescriptor& property : descriptor->properties)
        block.properties.push_back({property.key, property.defaultValue});
    return block;
}

LogicBlockAvailability blockAvailability(const EntityDef& owner,
                                         const LogicBlockDescriptor& candidate,
                                         const LogicBlockDescriptor* trigger) {
    return availabilityFor(owner, candidate, trigger);
}

LogicBlockDef makeDefaultTrigger() { return makeDefaultBlock(kOnStart, BlockKind::Trigger); }

LogicBlockDef makeDefaultAction() { return makeDefaultBlock(kSetVisible, BlockKind::Action); }

LogicBlockDef makeDefaultCondition() { return makeDefaultBlock(kIsGrounded, BlockKind::Condition); }

LogicRuleDef makeDefaultRule(LogicRuleId id) {
    LogicRuleDef rule;
    rule.id = std::move(id);
    rule.trigger = makeDefaultTrigger();
    rule.actions.push_back(makeDefaultAction());
    return rule;
}

std::vector<LogicKey> supportedLogicKeys() {
    std::vector<LogicKey> keys;
    for (int i = static_cast<int>(LogicKey::A); i <= static_cast<int>(LogicKey::Enter); ++i)
        keys.push_back(static_cast<LogicKey>(i));
    return keys;
}

std::string logicKeyName(LogicKey key) {
    const int v = static_cast<int>(key);
    if (v >= static_cast<int>(LogicKey::A) && v <= static_cast<int>(LogicKey::Z))
        return std::string(1, static_cast<char>('A' + v));
    if (v >= static_cast<int>(LogicKey::Num0) && v <= static_cast<int>(LogicKey::Num9))
        return std::string(1, static_cast<char>('0' + v - static_cast<int>(LogicKey::Num0)));
    switch (key) {
        case LogicKey::ArrowLeft: return "ArrowLeft";
        case LogicKey::ArrowRight: return "ArrowRight";
        case LogicKey::ArrowUp: return "ArrowUp";
        case LogicKey::ArrowDown: return "ArrowDown";
        case LogicKey::Space: return "Space";
        case LogicKey::Enter: return "Enter";
        default: return {};
    }
}

std::optional<LogicKey> logicKeyFromName(const std::string& name) {
    for (LogicKey key : supportedLogicKeys())
        if (logicKeyName(key) == name) return key;
    return std::nullopt;
}

std::vector<LogicDiagnostic> validateBoard(const ObjectTypeId& objectTypeId,
                                           const LogicBoardDef& board,
                                           const EntityDef* owner,
                                           const ProjectDoc* project) {
    std::vector<LogicDiagnostic> out;
    if (!validId(board.id)) out.push_back(makeError(objectTypeId, board, "LB_BOARD_ID", "Invalid board id"));
    if (board.schemaVersion != kLogicBoardSchemaVersion)
        out.push_back(makeError(objectTypeId, board, "LB_SCHEMA_VERSION", "Unsupported Logic Board schema version"));
    if (board.apiVersion != kLogicApiVersion)
        out.push_back(makeError(objectTypeId, board, "LB_API_VERSION", "Unsupported Logic API version"));
    if (board.rules.size() > kMaxRulesPerBoard)
        out.push_back(makeError(objectTypeId, board, "LB_RULE_LIMIT", "Logic Board exceeds the rule limit"));

    std::unordered_set<std::string> ids;
    for (const LogicRuleDef& rule : board.rules) {
        if (!validId(rule.id) || !ids.insert(rule.id).second)
            out.push_back(makeError(objectTypeId, board, "LB_RULE_ID", "Invalid or duplicate rule id", &rule));
        if (rule.actions.empty())
            out.push_back(makeError(objectTypeId, board, "LB_ACTION_REQUIRED", "A rule needs at least one action", &rule));
        if (rule.actions.size() > kMaxActionsPerRule)
            out.push_back(makeError(objectTypeId, board, "LB_ACTION_LIMIT", "Rule exceeds the action limit", &rule));
        if (rule.conditions.size() > kMaxConditionsPerRule)
            out.push_back(makeError(objectTypeId, board, "LB_CONDITION_LIMIT", "Rule exceeds the condition limit", &rule));
        const LogicBlockDescriptor* trigger = findDescriptor(rule.trigger.typeId);
        validateBlock(objectTypeId, board, rule, rule.trigger, BlockKind::Trigger, owner,
                      nullptr, project, out);
        for (const LogicBlockDef& condition : rule.conditions)
            validateBlock(objectTypeId, board, rule, condition, BlockKind::Condition, owner,
                          trigger, project, out);
        for (const LogicBlockDef& action : rule.actions)
            validateBlock(objectTypeId, board, rule, action, BlockKind::Action, owner,
                          trigger, project, out);
    }
    return out;
}

LogicCompileResult compileBoard(const ObjectTypeId& objectTypeId,
                                const LogicBoardDef& board,
                                const EntityDef* owner,
                                const ProjectDoc* project) {
    LogicCompileResult result;
    result.diagnostics = validateBoard(objectTypeId, board, owner, project);
    if (!result.ok()) return result;

    std::set<std::string> features;
    std::ostringstream lua;
    lua << "logic.require_api_version(" << kLogicApiVersion << ")\n";
    lua << "logic.define_board(\"" << escapeLua(board.id) << "\", \""
        << escapeLua(objectTypeId) << "\", function(context)\n";
    for (const LogicRuleDef& rule : board.rules) {
        if (!rule.enabled) continue;
        if (rule.trigger.typeId == kOnStart) {
            lua << "  context:on_start(\"" << escapeLua(rule.id) << "\", function()\n";
        } else if (rule.trigger.typeId == kCollisionEnter || rule.trigger.typeId == kCollisionExit) {
            const char* registerMethod = rule.trigger.typeId == kCollisionEnter
                ? "on_collision_enter" : "on_collision_exit";
            lua << "  context:" << registerMethod << "(\"" << escapeLua(rule.id)
                << "\", function(other)\n";
        } else {
            const LogicPropertyDef* key = findProperty(rule.trigger, "key");
            const char* registerMethod = rule.trigger.typeId == kKeyReleased ? "on_key_released"
                : rule.trigger.typeId == kKeyHeld ? "on_key_held" : "on_key_pressed";
            lua << "  context:" << registerMethod << "(\"" << escapeLua(rule.id) << "\", \""
                << logicKeyName(std::get<LogicKey>(key->value)) << "\", function()\n";
        }
        if (const LogicBlockDescriptor* descriptor = findDescriptor(rule.trigger.typeId)) {
            if (!descriptor->requiredFeature.empty()) features.insert(descriptor->requiredFeature);
            result.requiresTick = result.requiresTick || descriptor->requiresTick;
        }
        const bool guarded = emitConditionGuard(lua, rule.conditions, features);
        for (const LogicBlockDef& action : rule.actions) emitAction(lua, action, features);
        if (guarded) lua << "    end\n";
        lua << "  end)\n";
    }
    lua << "end)\n";

    LogicProgram program;
    program.objectTypeId = objectTypeId;
    program.boardId = board.id;
    program.source = lua.str();
    program.requiresTick = result.requiresTick;
    program.requiredFeatures.assign(features.begin(), features.end());
    result.programs.push_back(std::move(program));
    return result;
}

LogicCompileResult compileProjectLogic(const ProjectDoc& project) {
    LogicCompileResult result;
    std::vector<ObjectTypeId> ids;
    ids.reserve(project.objectTypes.size());
    for (const auto& [id, unused] : project.objectTypes) {
        (void)unused;
        ids.push_back(id);
    }
    std::sort(ids.begin(), ids.end());
    std::size_t blocks = 0;
    for (const ObjectTypeId& id : ids) {
        const EntityDef& type = project.objectTypes.at(id);
        if (!type.logicBoard) continue;
        for (const LogicRuleDef& rule : type.logicBoard->rules)
            blocks += 1 + rule.conditions.size() + rule.actions.size();
        LogicCompileResult one = compileBoard(id, *type.logicBoard, &type, &project);
        result.programs.insert(result.programs.end(),
            std::make_move_iterator(one.programs.begin()), std::make_move_iterator(one.programs.end()));
        result.diagnostics.insert(result.diagnostics.end(),
            std::make_move_iterator(one.diagnostics.begin()), std::make_move_iterator(one.diagnostics.end()));
        result.requiresTick = result.requiresTick || one.requiresTick;
    }
    if (blocks > kMaxBlocksPerProject) {
        LogicDiagnostic d;
        d.code = "LB_PROJECT_BLOCK_LIMIT";
        d.message = "Project exceeds the Logic Board block limit";
        result.diagnostics.push_back(std::move(d));
        result.programs.clear();
    }
    return result;
}

} // namespace ArtCade::Logic


#pragma once

#include "../../../core/types.h"

#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

namespace ArtCade::Logic {

inline constexpr uint32_t kLogicBoardSchemaVersion = 1;
inline constexpr uint32_t kLogicApiVersion = 2;
inline constexpr std::size_t kMaxRulesPerBoard = 128;
inline constexpr std::size_t kMaxConditionsPerRule = 16;
inline constexpr std::size_t kMaxActionsPerRule = 16;
inline constexpr std::size_t kMaxBlocksPerProject = 8192;
inline constexpr std::size_t kMaxLogicIdLength = 128;

inline constexpr const char* kOnStart = "event.on_start";
inline constexpr const char* kKeyPressed = "input.key_pressed";
inline constexpr const char* kSetVisible = "entity.set_visible";
inline constexpr const char* kSetPosition = "entity.set_position";

enum class BlockKind { Trigger, Condition, Action };
enum class LogicValueKind { Bool, Integer, Number, String, Vec2, Asset, Entity, Variable, Key };

struct LogicPropertyDescriptor {
    std::string    key;
    LogicValueKind valueKind = LogicValueKind::Bool;
    LogicValue     defaultValue = false;
};

struct LogicBlockDescriptor {
    std::string                          typeId;
    std::string                          displayName;
    BlockKind                            kind = BlockKind::Trigger;
    std::vector<LogicPropertyDescriptor> properties;
};

enum class DiagnosticSeverity { Warning, Error };

struct LogicDiagnostic {
    DiagnosticSeverity severity = DiagnosticSeverity::Error;
    std::string code;
    std::string message;
    ObjectTypeId objectTypeId;
    LogicBoardId boardId;
    LogicRuleId ruleId;
    std::string blockTypeId;
    std::string propertyKey;
};

struct LogicProgram {
    ObjectTypeId objectTypeId;
    LogicBoardId boardId;
    std::string  source;
    bool         requiresTick = false;
    std::vector<std::string> requiredFeatures;
};

struct LogicCompileResult {
    std::vector<LogicProgram>    programs;
    std::vector<LogicDiagnostic> diagnostics;
    bool                         requiresTick = false;

    bool ok() const;
};

struct LogicJsonResult {
    bool ok = false;
    std::string error;
};

const std::vector<LogicBlockDescriptor>& registry();
const LogicBlockDescriptor* findDescriptor(const std::string& typeId);
const LogicPropertyDef* findProperty(const LogicBlockDef& block, const std::string& key);

LogicBlockDef makeDefaultTrigger();
LogicBlockDef makeDefaultAction();
LogicRuleDef makeDefaultRule(LogicRuleId id);

std::string logicKeyName(LogicKey key);
std::optional<LogicKey> logicKeyFromName(const std::string& name);
std::vector<LogicKey> supportedLogicKeys();

std::vector<LogicDiagnostic> validateBoard(const ObjectTypeId& objectTypeId,
                                           const LogicBoardDef& board);
LogicCompileResult compileBoard(const ObjectTypeId& objectTypeId,
                                const LogicBoardDef& board);
LogicCompileResult compileProjectLogic(const ProjectDoc& project);

nlohmann::json logicBoardToJson(const LogicBoardDef& board);
LogicJsonResult logicBoardFromJson(const nlohmann::json& json, LogicBoardDef& out);

} // namespace ArtCade::Logic

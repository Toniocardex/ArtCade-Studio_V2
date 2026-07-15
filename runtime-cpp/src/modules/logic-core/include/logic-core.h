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
inline constexpr const char* kKeyReleased = "input.key_released";
inline constexpr const char* kKeyHeld = "input.key_held";
inline constexpr const char* kSetVisible = "entity.set_visible";
inline constexpr const char* kSetPosition = "entity.set_position";
inline constexpr const char* kIsGrounded = "platformer.is_grounded";
inline constexpr const char* kMoveHorizontal = "platformer.move_horizontal";
inline constexpr const char* kJump = "platformer.jump";
inline constexpr const char* kCollisionEnter = "collision.enter";
inline constexpr const char* kCollisionExit = "collision.exit";
inline constexpr const char* kOtherIsObjectType = "collision.other_is_object_type";
inline constexpr const char* kDestroySelf = "entity.destroy_self";
inline constexpr const char* kAnimationPlayClip = "animation.play_clip";
inline constexpr const char* kAnimationStop = "animation.stop";
inline constexpr const char* kAnimationSetPlaybackSpeed = "animation.set_playback_speed";
inline constexpr const char* kAudioPlaySound = "audio.play_sound";

using LogicBlockTypeId = std::string;
using LogicCategoryId = std::string;

enum class BlockKind { Trigger, Condition, Action };
enum class LogicValueKind { Bool, Integer, Number, String, Vec2, Asset, Entity, Variable, Key };
enum class LogicRequiredComponent { PlatformerController, SpriteAnimator };
enum class LogicContextCapability {
    Self,
    EventOther,
    DeltaTime,
    CollisionContact,
    MessagePayload,
};

struct LogicPropertyDescriptor {
    std::string    key;
    LogicValueKind valueKind = LogicValueKind::Bool;
    LogicValue     defaultValue = false;
};

struct LogicBlockDescriptor {
    LogicBlockTypeId                     typeId;
    LogicCategoryId                      categoryId;
    std::string                          displayName;
    std::string                          description;
    BlockKind                            kind = BlockKind::Trigger;
    std::vector<LogicPropertyDescriptor> properties;
    std::vector<LogicRequiredComponent>  requiredComponents;
    std::vector<LogicContextCapability>  requiredContext;
    std::vector<LogicContextCapability>  providedContext;
    std::string                          requiredFeature;
    bool                                 requiresTick = false;
};

struct LogicBlockAvailability {
    bool compatible = true;
    std::string reason;
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
LogicBlockDef makeDefaultBlock(const LogicBlockTypeId& typeId, BlockKind expected);
LogicBlockAvailability blockAvailability(const EntityDef& owner,
                                         const LogicBlockDescriptor& candidate,
                                         const LogicBlockDescriptor* trigger = nullptr);

LogicBlockDef makeDefaultTrigger();
LogicBlockDef makeDefaultAction();
LogicBlockDef makeDefaultCondition();
LogicRuleDef makeDefaultRule(LogicRuleId id);

std::string logicKeyName(LogicKey key);
std::optional<LogicKey> logicKeyFromName(const std::string& name);
std::vector<LogicKey> supportedLogicKeys();

std::vector<LogicDiagnostic> validateBoard(const ObjectTypeId& objectTypeId,
                                           const LogicBoardDef& board,
                                           const EntityDef* owner = nullptr,
                                           const ProjectDoc* project = nullptr);
LogicCompileResult compileBoard(const ObjectTypeId& objectTypeId,
                                const LogicBoardDef& board,
                                const EntityDef* owner = nullptr,
                                const ProjectDoc* project = nullptr);
LogicCompileResult compileProjectLogic(const ProjectDoc& project);

nlohmann::json logicBoardToJson(const LogicBoardDef& board);
LogicJsonResult logicBoardFromJson(const nlohmann::json& json, LogicBoardDef& out);

} // namespace ArtCade::Logic

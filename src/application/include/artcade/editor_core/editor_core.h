#pragma once

#include "logic-core.h"
#include "project-current-format.h"
#include "types.h"

#include <cstdint>
#include <memory>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace ArtCade::EditorCore {

/**
 * Undoable authoring mutation against the single in-memory ProjectDoc.
 */
class ICommand {
public:
    virtual ~ICommand() = default;
    virtual void execute(ProjectDoc &doc) = 0;
    virtual void undo(ProjectDoc &doc) = 0;
};

class CommandStack {
public:
    void execute(std::unique_ptr<ICommand> command, ProjectDoc &doc);
    /** Push a command already applied to @p doc (does not call execute again). */
    void pushExecuted(std::unique_ptr<ICommand> command);
    bool canUndo() const;
    bool canRedo() const;
    void undo(ProjectDoc &doc);
    void redo(ProjectDoc &doc);
    void clear();

private:
    std::vector<std::unique_ptr<ICommand>> m_undo;
    std::vector<std::unique_ptr<ICommand>> m_redo;
};

class RenameEntityCommand final : public ICommand {
public:
    RenameEntityCommand(EntityId entity_id, std::string new_name);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    EntityId m_entity_id = 0;
    std::string m_new_name;
    std::string m_old_name;
    bool m_captured = false;
};

class SetEntityPositionCommand final : public ICommand {
public:
    SetEntityPositionCommand(EntityId entity_id, float x, float y);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    EntityId m_entity_id = 0;
    float m_new_x = 0.f;
    float m_new_y = 0.f;
    float m_old_x = 0.f;
    float m_old_y = 0.f;
    bool m_captured = false;
};

/**
 * Sets instance scale (SceneId + EntityId). Rejects non-finite or non-positive scale.
 */
class SetEntityScaleCommand final : public ICommand {
public:
    SetEntityScaleCommand(SceneId scene_id, EntityId entity_id, Vec2 after_scale);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    SceneId m_scene_id;
    EntityId m_entity_id = 0;
    Vec2 m_after_scale{1.f, 1.f};
    Vec2 m_before_scale{1.f, 1.f};
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Sets instance rotation in radians (SceneId + EntityId). Rejects non-finite values.
 */
class SetEntityRotationCommand final : public ICommand {
public:
    SetEntityRotationCommand(SceneId scene_id, EntityId entity_id, float after_rotation_radians);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    SceneId m_scene_id;
    EntityId m_entity_id = 0;
    float m_after_rotation = 0.f;
    float m_before_rotation = 0.f;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Sets per-scene Play/export visibility (layerSettings[layerId].visible).
 * Editor eye hide is workspace-only — use EditorCoordinator::setLayerHiddenInEditor.
 */
class SetLayerVisibleCommand final : public ICommand {
public:
    SetLayerVisibleCommand(SceneId scene_id, std::string layer_id, bool visible);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    bool m_new_visible = true;
    bool m_old_visible = true;
    bool m_had_entry = false;
    bool m_captured = false;
};

/**
 * Sets SceneLayerDef.locked on a scene layer (persistent authoring).
 * Locked layers block editor pick/drag; not used by exported runtime gameplay.
 */
class SetLayerLockedCommand final : public ICommand {
public:
    SetLayerLockedCommand(SceneId scene_id, std::string layer_id, bool locked);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    bool m_new_locked = false;
    bool m_old_locked = false;
    bool m_captured = false;
    bool m_applied = false;
};

class AddSceneLayerCommand final : public ICommand {
public:
    AddSceneLayerCommand(SceneId scene_id,
                         std::string layer_id,
                         std::string name,
                         std::size_t insert_index);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    std::string m_name;
    std::size_t m_insert_index = 0;
    bool m_applied = false;
};

class RenameSceneLayerCommand final : public ICommand {
public:
    RenameSceneLayerCommand(SceneId scene_id, std::string layer_id, std::string new_name);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    std::string m_new_name;
    std::string m_old_name;
    bool m_captured = false;
    bool m_applied = false;
};

class SetDefaultSceneLayerCommand final : public ICommand {
public:
    SetDefaultSceneLayerCommand(SceneId scene_id, std::string layer_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    std::string m_old_default;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Moves a layer within SceneDef.layers so it ends at @p target_index.
 * index 0 = background, last = foreground. No-op when already there.
 */
class MoveSceneLayerCommand final : public ICommand {
public:
    MoveSceneLayerCommand(SceneId scene_id, std::string layer_id, std::size_t target_index);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    std::size_t m_target_index = 0;
    std::size_t m_from_index = 0;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Assigns an instance to a layer in the same scene.
 * Target is SceneId + EntityId (not current selection).
 */
class SetEntityLayerCommand final : public ICommand {
public:
    SetEntityLayerCommand(SceneId scene_id, EntityId entity_id, std::string layer_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    EntityId m_entity_id = 0;
    std::string m_layer_id;
    std::string m_old_layer_id;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Removes a layer from SceneDef.layers and transfers its instances to @p transfer_target_id.
 * Rejected when the scene would be left with zero layers, or when deleting the default.
 */
class RemoveSceneLayerCommand final : public ICommand {
public:
    RemoveSceneLayerCommand(SceneId scene_id,
                            std::string layer_id,
                            std::string transfer_target_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    SceneId m_scene_id;
    std::string m_layer_id;
    std::string m_transfer_target_id;
    std::size_t m_from_index = 0;
    SceneLayerDef m_removed_def{};
    SceneLayerSettings m_removed_settings{};
    bool m_had_settings = false;
    std::vector<EntityId> m_transferred_ids;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Duplicates a scene layer and its instances (and optional tilemapLayers entry).
 * Inserts the copy immediately toward the foreground of the source; one undo step.
 */
class DuplicateSceneLayerCommand final : public ICommand {
public:
    DuplicateSceneLayerCommand(SceneId scene_id, std::string source_layer_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }
    [[nodiscard]] const std::string &newLayerId() const { return m_new_layer_id; }

private:
    SceneId m_scene_id;
    std::string m_source_layer_id;
    std::string m_new_layer_id;
    std::string m_new_layer_name;
    std::size_t m_insert_index = 0;
    SceneLayerDef m_new_layer_def{};
    SceneLayerSettings m_new_settings{};
    bool m_copy_settings = false;
    bool m_copy_tilemap = false;
    TilemapData m_new_tilemap{};
    std::vector<SceneInstanceDef> m_new_instances;
    bool m_planned = false;
    bool m_applied = false;
};

/**
 * Ensures an Object Type has a required gameplay component (Platformer / Sprite Animator).
 * No-op when already present. Undo restores the previous optional component state.
 */
class EnsureObjectTypeComponentCommand final : public ICommand {
public:
    EnsureObjectTypeComponentCommand(ObjectTypeId object_type_id,
                                     Logic::LogicRequiredComponent component);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

    [[nodiscard]] bool applied() const { return m_applied; }

private:
    ObjectTypeId m_object_type_id;
    Logic::LogicRequiredComponent m_component;
    bool m_had_platformer = false;
    bool m_had_sprite_renderer = false;
    bool m_had_sprite_animator = false;
    PlatformerControllerComponent m_old_platformer{};
    SpriteRendererComponent m_old_sprite_renderer{};
    SpriteAnimatorComponent m_old_sprite_animator{};
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Appends a default Logic Rule to objectTypes[typeId].logicBoard.
 * Creates the board on first rule. Undo removes the rule (and the board if created empty).
 */
class AddLogicRuleCommand final : public ICommand {
public:
    explicit AddLogicRuleCommand(ObjectTypeId object_type_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

    [[nodiscard]] const LogicRuleId &ruleId() const { return m_rule_id; }
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    bool m_created_board = false;
    bool m_applied = false;
};

/**
 * Removes a Logic Rule by id from objectTypes[typeId].logicBoard.
 * Clears the board when the last rule is removed. Undo restores rule (+ board if needed).
 */
class RemoveLogicRuleCommand final : public ICommand {
public:
    RemoveLogicRuleCommand(ObjectTypeId object_type_id, LogicRuleId rule_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    LogicRuleDef m_removed_rule;
    LogicBoardId m_board_id;
    std::uint32_t m_schema_version = 1;
    std::uint32_t m_api_version = 2;
    std::size_t m_index = 0;
    bool m_cleared_board = false;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Renames one Logic Rule authoring label. The rule remains addressed by stable id.
 */
class RenameLogicRuleCommand final : public ICommand {
public:
    RenameLogicRuleCommand(ObjectTypeId object_type_id,
                           LogicRuleId rule_id,
                           std::string new_name);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::string m_new_name;
    std::string m_old_name;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Replaces the When (trigger) block on a Logic Rule with a default block of @p block_type_id.
 */
class SetLogicRuleTriggerCommand final : public ICommand {
public:
    SetLogicRuleTriggerCommand(ObjectTypeId object_type_id,
                               LogicRuleId rule_id,
                               std::string block_type_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::string m_block_type_id;
    LogicBlockDef m_old_trigger;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Replaces the first Then (action) block on a Logic Rule (or inserts one if empty).
 */
class SetLogicRulePrimaryActionCommand final : public ICommand {
public:
    SetLogicRulePrimaryActionCommand(ObjectTypeId object_type_id,
                                     LogicRuleId rule_id,
                                     std::string block_type_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::string m_block_type_id;
    LogicBlockDef m_old_action;
    bool m_had_action = false;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Enables or disables a Logic Rule. Disabled rules persist but are skipped
 * by logic compilation (Play and export).
 */
class SetLogicRuleEnabledCommand final : public ICommand {
public:
    SetLogicRuleEnabledCommand(ObjectTypeId object_type_id, LogicRuleId rule_id, bool enabled);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    bool m_new_enabled = true;
    bool m_old_enabled = true;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Clears all conditions on a Logic Rule (optional block → none).
 */
class ClearLogicRuleConditionsCommand final : public ICommand {
public:
    ClearLogicRuleConditionsCommand(ObjectTypeId object_type_id, LogicRuleId rule_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::vector<LogicBlockDef> m_old_conditions;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Which block on a rule owns a property edit.
 * Trigger ignores index (always the single trigger). Condition/Action use vector index.
 */
enum class LogicRuleBlockSlot { Trigger, Condition, Action };

struct LogicRuleBlockAddress {
    LogicRuleBlockSlot slot = LogicRuleBlockSlot::Trigger;
    std::size_t index = 0;
};

/** Appends one condition (materialized + deterministic variable defaults). */
class AddLogicConditionCommand final : public ICommand {
public:
    AddLogicConditionCommand(ObjectTypeId object_type_id,
                             LogicRuleId rule_id,
                             LogicBlockDef block);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }
    [[nodiscard]] std::size_t insertIndex() const { return m_insert_index; }

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    LogicBlockDef m_block;
    std::size_t m_insert_index = 0;
    bool m_applied = false;
};

/** Replaces conditions[index] with a new materialized block (same typeId = no-op). */
class SetLogicConditionAtCommand final : public ICommand {
public:
    SetLogicConditionAtCommand(ObjectTypeId object_type_id,
                               LogicRuleId rule_id,
                               std::size_t index,
                               LogicBlockDef new_block);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::size_t m_index = 0;
    LogicBlockDef m_new_block;
    LogicBlockDef m_old_block;
    bool m_captured = false;
    bool m_applied = false;
};

/** Removes conditions[index]; undo reinserts at the same index. */
class RemoveLogicConditionAtCommand final : public ICommand {
public:
    RemoveLogicConditionAtCommand(ObjectTypeId object_type_id,
                                  LogicRuleId rule_id,
                                  std::size_t index);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::size_t m_index = 0;
    LogicBlockDef m_removed;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Moves a condition so it ends at @p to (final index after the move).
 * Example: [A,B,C,D] move 0→2 → [B,C,A,D]. History stores full before/after vectors.
 */
class MoveLogicConditionCommand final : public ICommand {
public:
    MoveLogicConditionCommand(ObjectTypeId object_type_id,
                              LogicRuleId rule_id,
                              std::size_t from,
                              std::size_t to);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::size_t m_from = 0;
    std::size_t m_to = 0;
    std::vector<LogicBlockDef> m_before;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Sets one authorable property on a rule block addressed by slot + index.
 * Authorable kinds: Bool, Integer, Number, String, Key, Vec2 ("x,y"), Asset, Variable.
 */
class SetLogicRuleBlockPropertyCommand final : public ICommand {
public:
    SetLogicRuleBlockPropertyCommand(ObjectTypeId object_type_id,
                                     LogicRuleId rule_id,
                                     LogicRuleBlockAddress address,
                                     std::string property_key,
                                     LogicValue new_value);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    LogicRuleBlockAddress m_address;
    std::string m_property_key;
    LogicValue m_old_value = false;
    LogicValue m_new_value = false;
    bool m_had_property = false;
    bool m_captured = false;
    bool m_applied = false;
};

/** Summary row for property editors (text-encoded values). */
struct LogicPropertySummary {
    std::string key;
    std::string displayName;
    std::string kind;
    std::string value;
};

[[nodiscard]] bool logic_values_equal(const LogicValue &a, const LogicValue &b);
bool logic_value_parse(ArtCade::Logic::LogicValueKind kind,
                       const std::string &text,
                       LogicValue &out,
                       std::string &error_message);
[[nodiscard]] std::vector<LogicPropertySummary> logic_block_authorable_properties(
    const LogicBlockDef &block);

/**
 * Appends a display section to the board (board created on demand).
 * Sections group rules visually and never affect execution order.
 */
class AddLogicSectionCommand final : public ICommand {
public:
    AddLogicSectionCommand(ObjectTypeId object_type_id, std::string name);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

    [[nodiscard]] const std::string &sectionId() const { return m_section_id; }
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    ObjectTypeId m_object_type_id;
    std::string m_name;
    std::string m_section_id;
    bool m_created_board = false;
    bool m_applied = false;
};

/**
 * Renames a display section. Same name is a no-op.
 */
class RenameLogicSectionCommand final : public ICommand {
public:
    RenameLogicSectionCommand(ObjectTypeId object_type_id,
                              std::string section_id,
                              std::string new_name);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    std::string m_section_id;
    std::string m_new_name;
    std::string m_old_name;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Removes a display section and clears membership on its rules.
 * Undo restores the section at its index and the rule membership.
 */
class RemoveLogicSectionCommand final : public ICommand {
public:
    RemoveLogicSectionCommand(ObjectTypeId object_type_id, std::string section_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    std::string m_section_id;
    LogicSectionDef m_removed_section;
    std::vector<LogicRuleId> m_member_rule_ids;
    std::size_t m_index = 0;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Assigns a rule to a display section (empty section id = unsectioned).
 */
class SetLogicRuleSectionCommand final : public ICommand {
public:
    SetLogicRuleSectionCommand(ObjectTypeId object_type_id,
                               LogicRuleId rule_id,
                               std::string section_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::string m_section_id;
    std::string m_old_section_id;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Validates an immutable GameVariableId key: [A-Za-z_][A-Za-z0-9_.-]{0,63}.
 * Does not trim; rejects whitespace and control characters.
 */
[[nodiscard]] bool is_valid_game_variable_key(const std::string &key, std::string &error_message);

/**
 * Counts Logic Board properties that reference @p id via LogicVariableReference.
 */
[[nodiscard]] std::size_t count_logic_variable_references(const ProjectDoc &doc,
                                                          const GameVariableId &id);

/** Adds one validated global variable to ProjectDoc and supports undo. */
class AddGameVariableCommand final : public ICommand {
public:
    explicit AddGameVariableCommand(GameVariableDefinition definition);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    GameVariableDefinition m_definition;
    bool m_applied = false;
};

/** Removes one unreferenced global variable from ProjectDoc and supports undo. */
class RemoveGameVariableCommand final : public ICommand {
public:
    explicit RemoveGameVariableCommand(GameVariableId id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    GameVariableId m_id;
    GameVariableDefinition m_removed;
    std::size_t m_index = 0;
    bool m_captured = false;
    bool m_applied = false;
};

/** Changes one global variable initial value and supports undo. */
class SetGameVariableInitialValueCommand final : public ICommand {
public:
    SetGameVariableInitialValueCommand(GameVariableId id, GameVariableValue value);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    GameVariableId m_id;
    GameVariableValue m_new_value;
    GameVariableValue m_old_value;
    bool m_captured = false;
    bool m_applied = false;
};

/** Changes one unreferenced global variable type and initial value with undo. */
class SetGameVariableTypeCommand final : public ICommand {
public:
    SetGameVariableTypeCommand(GameVariableId id,
                               GameVariableDefinition::Type new_type,
                               GameVariableValue new_initial_value);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    GameVariableId m_id;
    GameVariableDefinition::Type m_new_type = GameVariableDefinition::Type::Number;
    GameVariableValue m_new_initial = 0.0;
    GameVariableDefinition::Type m_old_type = GameVariableDefinition::Type::Number;
    GameVariableValue m_old_initial = 0.0;
    bool m_captured = false;
    bool m_applied = false;
};

/** Changes one global variable authoring description and supports undo. */
class SetGameVariableDescriptionCommand final : public ICommand {
public:
    SetGameVariableDescriptionCommand(GameVariableId id, std::string description);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;
    [[nodiscard]] bool applied() const { return m_applied; }

private:
    GameVariableId m_id;
    std::string m_new_description;
    std::string m_old_description;
    bool m_captured = false;
    bool m_applied = false;
};

/** C++-owned editor project format. */
inline constexpr int kCurrentProjectFormatVersion = ProjectJson::kCurrentProjectFormatVersion;

/** Floating-point no-op tolerance for transform compares (~1e-6). */
inline constexpr float kTransformEpsilon = 1e-6f;

[[nodiscard]] bool nearly_equal(float a, float b, float epsilon = kTransformEpsilon);
[[nodiscard]] bool nearly_equal(const Vec2 &a, const Vec2 &b, float epsilon = kTransformEpsilon);
[[nodiscard]] bool is_valid_authored_scale(const Vec2 &scale);
[[nodiscard]] bool is_finite_float(float value);

bool project_file_io_load(const std::string &project_json_path,
                          ProjectDoc &out,
                          std::string &error_message);

bool project_file_io_save(const std::string &project_json_path,
                          const ProjectDoc &doc,
                          std::string &error_message);

SceneInstanceDef *project_doc_find_instance(ProjectDoc &doc, EntityId entity_id);
const SceneInstanceDef *project_doc_find_instance(const ProjectDoc &doc, EntityId entity_id);

/**
 * Locates an instance within a specific scene (stable Command targeting).
 */
SceneInstanceDef *project_doc_find_instance_in_scene(ProjectDoc &doc,
                                                     const SceneId &scene_id,
                                                     EntityId entity_id);
const SceneInstanceDef *project_doc_find_instance_in_scene(const ProjectDoc &doc,
                                                           const SceneId &scene_id,
                                                           EntityId entity_id);

/**
 * Resolves which scene owns @p entity_id. Returns false if not found.
 */
bool project_doc_locate_instance(const ProjectDoc &doc,
                                 EntityId entity_id,
                                 SceneId &out_scene_id,
                                 const SceneInstanceDef *&out_instance);

/**
 * Sole in-memory ProjectDocument authority.
 * Selection / active layer are workspace state (do not bump revision).
 */
class EditorCoordinator {
public:
    bool openProject(const std::string &project_json_path, std::string &error_message);
    /**
     * Creates a minimal formatVersion-current project at @p project_json_path and
     * loads it as the active document. Does not record undo history.
     */
    bool createNewProject(const std::string &project_json_path,
                          const std::string &project_name,
                          std::string &error_message);
    bool saveProject(std::string &error_message);
    bool saveProjectAs(const std::string &project_json_path, std::string &error_message);

    [[nodiscard]] bool hasProject() const;
    [[nodiscard]] const ProjectDoc &document() const;
    [[nodiscard]] ProjectDoc &document();
    [[nodiscard]] const std::string &projectPath() const;

    [[nodiscard]] std::uint64_t revision() const;
    [[nodiscard]] std::uint64_t savedRevision() const;
    [[nodiscard]] bool isDirty() const;

    void selectEntity(EntityId entity_id);
    void clearSelection();
    [[nodiscard]] EntityId selectedEntityId() const;

    void setActiveLayerId(const std::string &layer_id);
    [[nodiscard]] const std::string &activeLayerId() const;

    /**
     * Workspace-only: hide/show a layer in the Scene View (eye toggle).
     * Does not dirty, does not undo, does not touch layerSettings.visible.
     */
    void setLayerHiddenInEditor(const std::string &layer_id, bool hidden);
    [[nodiscard]] bool layerHiddenInEditor(const std::string &layer_id) const;

    bool renameSelected(const std::string &new_name, std::string &error_message);
    bool setSelectedPosition(float x, float y, std::string &error_message);
    bool setSelectedScale(float scale_x, float scale_y, std::string &error_message);
    bool setSelectedRotation(float radians, std::string &error_message);
    bool renameEntity(EntityId entity_id, const std::string &new_name, std::string &error_message);
    bool setEntityPosition(EntityId entity_id, float x, float y, std::string &error_message);
    bool setEntityScale(const SceneId &scene_id,
                        EntityId entity_id,
                        float scale_x,
                        float scale_y,
                        std::string &error_message);
    bool setEntityRotation(const SceneId &scene_id,
                           EntityId entity_id,
                           float radians,
                           std::string &error_message);
    bool setLayerVisible(const std::string &layer_id, bool visible, std::string &error_message);
    /**
     * Sets SceneLayerDef.locked on the active scene (undoable, dirties).
     */
    bool setLayerLocked(const std::string &layer_id, bool locked, std::string &error_message);
    bool addSceneLayer(std::string &out_layer_id, std::string &error_message);
    bool renameSceneLayer(const std::string &layer_id,
                          const std::string &new_name,
                          std::string &error_message);
    bool setDefaultSceneLayer(const std::string &layer_id, std::string &error_message);

    /**
     * Moves a layer in the active scene to @p target_index (0 = background, last = foreground).
     * No-op when already at that index.
     */
    bool moveSceneLayer(const std::string &layer_id,
                        std::size_t target_index,
                        std::string &error_message);

    /**
     * Moves an instance onto a layer of its owning scene.
     * @p entity_id is the stable target (not the current selection).
     */
    bool setEntityLayer(EntityId entity_id,
                        const std::string &layer_id,
                        std::string &error_message);

    /**
     * Removes a layer from the active scene, moving its instances to @p transfer_target_id.
     * Fails if the layer is the scene default or the last remaining layer.
     */
    bool removeSceneLayer(const std::string &layer_id,
                          const std::string &transfer_target_id,
                          std::string &error_message);

    /**
     * Duplicates @p layer_id and its instances in the active scene.
     * The copy is inserted toward the foreground of the source and becomes active.
     */
    bool duplicateSceneLayer(const std::string &layer_id,
                             std::string &out_new_layer_id,
                             std::string &error_message);

    /** Count of instances on @p layer_id in the active scene (for delete dialog copy). */
    [[nodiscard]] int countInstancesOnLayer(const std::string &layer_id) const;

    /**
     * Adds a default When/Then rule on the object type's Logic Board.
     * @param object_type_id stable object type id (not instance id)
     * @param out_rule_id filled with the new rule id on success
     */
    bool addLogicRule(const ObjectTypeId &object_type_id,
                      LogicRuleId &out_rule_id,
                      std::string &error_message);

    /**
     * Removes a Logic Rule from the object type's board.
     * @param object_type_id stable object type id
     * @param rule_id rule to remove
     */
    bool removeLogicRule(const ObjectTypeId &object_type_id,
                         const LogicRuleId &rule_id,
                         std::string &error_message);

    /**
     * Renames a rule authoring label. Trimmed, unique names are required per board.
     */
    bool renameLogicRule(const ObjectTypeId &object_type_id,
                         const LogicRuleId &rule_id,
                         const std::string &new_name,
                         std::string &error_message);

    /**
     * Sets the When trigger type on a rule (default properties for that block type).
     */
    bool setLogicRuleTrigger(const ObjectTypeId &object_type_id,
                             const LogicRuleId &rule_id,
                             const std::string &block_type_id,
                             std::string &error_message);

    /**
     * Sets the primary Then action type on a rule (index 0).
     */
    bool setLogicRulePrimaryAction(const ObjectTypeId &object_type_id,
                                   const LogicRuleId &rule_id,
                                   const std::string &block_type_id,
                                   std::string &error_message);

    /**
     * Enables or disables a rule. Same value is a no-op (does not dirty).
     */
    bool setLogicRuleEnabled(const ObjectTypeId &object_type_id,
                             const LogicRuleId &rule_id,
                             bool enabled,
                             std::string &error_message);

    /**
     * Adds a display section ("Section N" when @p name is empty).
     * @param out_section_id filled with the new stable section id on success
     */
    bool addLogicSection(const ObjectTypeId &object_type_id,
                         const std::string &name,
                         std::string &out_section_id,
                         std::string &error_message);

    /**
     * Renames a display section. Empty (trimmed) names are rejected.
     */
    bool renameLogicSection(const ObjectTypeId &object_type_id,
                            const std::string &section_id,
                            const std::string &new_name,
                            std::string &error_message);

    /**
     * Removes a display section; member rules become unsectioned.
     */
    bool removeLogicSection(const ObjectTypeId &object_type_id,
                            const std::string &section_id,
                            std::string &error_message);

    /**
     * Assigns a rule to a section (empty @p section_id clears membership).
     * The section must exist; same assignment is a no-op.
     */
    bool setLogicRuleSection(const ObjectTypeId &object_type_id,
                             const LogicRuleId &rule_id,
                             const std::string &section_id,
                             std::string &error_message);

    /**
     * Clears all conditions on a rule (no-op if already empty).
     */
    bool clearLogicRuleConditions(const ObjectTypeId &object_type_id,
                                  const LogicRuleId &rule_id,
                                  std::string &error_message);

    /** Appends a condition block; refuses at kMaxConditionsPerRule. */
    bool addLogicCondition(const ObjectTypeId &object_type_id,
                           const LogicRuleId &rule_id,
                           const std::string &block_type_id,
                           std::string &error_message);

    /** Replaces conditions[index]; same typeId preserves properties (no-op). */
    bool setLogicConditionAt(const ObjectTypeId &object_type_id,
                             const LogicRuleId &rule_id,
                             std::size_t index,
                             const std::string &block_type_id,
                             std::string &error_message);

    /** Removes conditions[index]. */
    bool removeLogicConditionAt(const ObjectTypeId &object_type_id,
                                const LogicRuleId &rule_id,
                                std::size_t index,
                                std::string &error_message);

    /**
     * Moves a condition to final index @p to.
     * Example: [A,B,C,D] from=0 to=2 → [B,C,A,D].
     */
    bool moveLogicCondition(const ObjectTypeId &object_type_id,
                            const LogicRuleId &rule_id,
                            std::size_t from,
                            std::size_t to,
                            std::string &error_message);

    /**
     * Sets one authorable property on a rule block addressed by slot + index.
     * Same value is a no-op (does not dirty).
     */
    bool setLogicRuleBlockProperty(const ObjectTypeId &object_type_id,
                                   const LogicRuleId &rule_id,
                                   LogicRuleBlockAddress address,
                                   const std::string &property_key,
                                   const std::string &value_text,
                                   std::string &error_message);

    /**
     * Ensures the Object Type owns a required component used by Logic Catalog blocks.
     * Supported ids: "platformerController", "spriteAnimator".
     * Already-present components are a no-op (no dirty / revision).
     */
    bool ensureObjectTypeComponent(const ObjectTypeId &object_type_id,
                                   const std::string &component_id,
                                   std::string &error_message);

    /** Adds a validated project global variable with its type default; undoable. */
    bool addGameVariable(const std::string &key,
                         const std::string &type_id,
                         std::string &error_message);
    /** Removes an unreferenced project global variable; undoable. */
    bool removeGameVariable(const GameVariableId &id, std::string &error_message);
    /** Sets the finite initial Number value; same value is a no-op. */
    bool setGameVariableInitialNumber(const GameVariableId &id,
                                      double value,
                                      std::string &error_message);
    /** Sets the initial Boolean value; same value is a no-op. */
    bool setGameVariableInitialBoolean(const GameVariableId &id,
                                       bool value,
                                       std::string &error_message);
    /** Sets the initial String value; same value is a no-op. */
    bool setGameVariableInitialString(const GameVariableId &id,
                                      const std::string &value,
                                      std::string &error_message);
    /** Changes an unreferenced variable type and resets its initial value; undoable. */
    bool setGameVariableType(const GameVariableId &id,
                             const std::string &type_id,
                             std::string &error_message);
    /** Sets authoring description text; same value is a no-op. */
    bool setGameVariableDescription(const GameVariableId &id,
                                    const std::string &description,
                                    std::string &error_message);
    /** Counts current Logic Board references to a stable variable identifier. */
    [[nodiscard]] std::size_t logicReferenceCount(const GameVariableId &id) const;

    /**
     * Compiles all objectTypes[].logicBoard with Executable validation.
     * Used before Play so editor and game.exe share the same gate.
     * Does not mutate ProjectDoc or scripts/main.lua.
     */
    bool validateLogicForPlay(std::string &error_message) const;

    /**
     * Play/export visibility from SceneDef.layerSettings[layerId].visible.
     * Editor Scene View eye uses layerHiddenInEditor instead.
     */
    [[nodiscard]] bool layerVisible(const std::string &layer_id) const;
    [[nodiscard]] bool layerLocked(const std::string &layer_id) const;

    /**
     * Picks the topmost editor-visible, unlocked instance whose placeholder AABB contains
     * the world point. Placeholder size is kSceneViewPlaceholderExtent * scale.
     * @returns entity id, or 0 if none
     */
    [[nodiscard]] EntityId pickEntityAt(float world_x, float world_y) const;

    /**
     * Topmost editor-visible, unlocked instance whose placeholder AABB intersects the
     * axis-aligned world rectangle (any order of corners).
     * @returns entity id, or 0 if none
     */
    [[nodiscard]] EntityId pickEntityInRect(float x0, float y0, float x1, float y1) const;

    /** World AABB for scene-view placeholders (authoring preview, not runtime sprite size). */
    static constexpr float kSceneViewPlaceholderExtent = 32.f;

    /** Active scene for the validated ProjectDoc.activeSceneId. */
    [[nodiscard]] SceneDef *activeScene();
    [[nodiscard]] const SceneDef *activeScene() const;

    [[nodiscard]] static const SceneLayerDef *findSceneLayer(const SceneDef &scene,
                                                             const std::string &layer_id);
    [[nodiscard]] static SceneLayerDef *findSceneLayer(SceneDef &scene,
                                                       const std::string &layer_id);
    [[nodiscard]] static std::size_t sceneLayerIndex(const SceneDef &scene,
                                                    const std::string &layer_id);
    [[nodiscard]] static bool sceneContainsLayer(const SceneDef &scene,
                                                 const std::string &layer_id);

    bool canUndo() const;
    bool canRedo() const;
    void undo();
    void redo();

private:
    void bumpRevision();
    /** If activeLayerId is missing from the active scene, fall back to default/first. */
    void reconcileActiveLayerId();

    ProjectDoc m_doc{};
    std::string m_path;
    bool m_has_project = false;
    std::uint64_t m_revision = 0;
    std::uint64_t m_saved_revision = 0;
    EntityId m_selected_entity_id = 0;
    std::string m_active_layer_id;
    /** Workspace-only hidden layer ids, partitioned by stable SceneId. */
    std::unordered_map<SceneId, std::unordered_set<std::string>> m_hidden_layer_ids_by_scene;
    CommandStack m_commands;
};

} // namespace ArtCade::EditorCore

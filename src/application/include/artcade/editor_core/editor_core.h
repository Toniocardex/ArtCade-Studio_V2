#pragma once

#include "logic-core.h"
#include "types.h"

#include <cstdint>
#include <memory>
#include <string>
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
 * Sets per-scene layer visibility for the active scene (layerSettings[layerId].visible).
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
 * Replaces the first Also-require (condition) block on a Logic Rule (or inserts one if empty).
 */
class SetLogicRulePrimaryConditionCommand final : public ICommand {
public:
    SetLogicRulePrimaryConditionCommand(ObjectTypeId object_type_id,
                                        LogicRuleId rule_id,
                                        std::string block_type_id);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    std::string m_block_type_id;
    LogicBlockDef m_old_condition;
    bool m_had_condition = false;
    bool m_captured = false;
    bool m_applied = false;
};

/**
 * Clears all Also-require conditions on a Logic Rule (optional block → none).
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

/** Which primary block on a rule owns a property edit. */
enum class LogicRuleBlockSlot { Trigger, PrimaryCondition, PrimaryAction };

/**
 * Sets one authorable property on a rule's primary trigger / condition / action.
 * Authorable kinds: Bool, Integer, Number, String, Key.
 */
class SetLogicRuleBlockPropertyCommand final : public ICommand {
public:
    SetLogicRuleBlockPropertyCommand(ObjectTypeId object_type_id,
                                     LogicRuleId rule_id,
                                     LogicRuleBlockSlot slot,
                                     std::string property_key,
                                     LogicValue new_value);
    void execute(ProjectDoc &doc) override;
    void undo(ProjectDoc &doc) override;

private:
    ObjectTypeId m_object_type_id;
    LogicRuleId m_rule_id;
    LogicRuleBlockSlot m_slot = LogicRuleBlockSlot::Trigger;
    std::string m_property_key;
    LogicValue m_old_value = false;
    LogicValue m_new_value = false;
    bool m_had_property = false;
    bool m_captured = false;
    bool m_applied = false;
};

/** Summary row for QML property editors (text-encoded values). */
struct LogicPropertySummary {
    std::string key;
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

/** C++-owned editor project format. */
inline constexpr int kCurrentProjectFormatVersion = 5;

bool project_file_io_load(const std::string &project_json_path,
                          ProjectDoc &out,
                          std::string &error_message);

bool project_file_io_save(const std::string &project_json_path,
                          const ProjectDoc &doc,
                          std::string &error_message);

SceneInstanceDef *project_doc_find_instance(ProjectDoc &doc, EntityId entity_id);
const SceneInstanceDef *project_doc_find_instance(const ProjectDoc &doc, EntityId entity_id);

/**
 * Sole in-memory ProjectDocument authority.
 * Selection / active layer are workspace state (do not bump revision).
 */
class EditorCoordinator {
public:
    bool openProject(const std::string &project_json_path, std::string &error_message);
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

    bool renameSelected(const std::string &new_name, std::string &error_message);
    bool setSelectedPosition(float x, float y, std::string &error_message);
    bool renameEntity(EntityId entity_id, const std::string &new_name, std::string &error_message);
    bool setEntityPosition(EntityId entity_id, float x, float y, std::string &error_message);
    bool setLayerVisible(const std::string &layer_id, bool visible, std::string &error_message);

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
     * Sets the primary Also-require condition type on a rule (index 0).
     */
    bool setLogicRulePrimaryCondition(const ObjectTypeId &object_type_id,
                                      const LogicRuleId &rule_id,
                                      const std::string &block_type_id,
                                      std::string &error_message);

    /**
     * Clears all Also-require conditions on a rule (no-op if already empty).
     */
    bool clearLogicRuleConditions(const ObjectTypeId &object_type_id,
                                  const LogicRuleId &rule_id,
                                  std::string &error_message);

    /**
     * Sets one authorable property on a rule block (Bool / Integer / Number / String / Key).
     * Same value is a no-op (does not dirty).
     */
    bool setLogicRuleBlockProperty(const ObjectTypeId &object_type_id,
                                   const LogicRuleId &rule_id,
                                   LogicRuleBlockSlot slot,
                                   const std::string &property_key,
                                   const std::string &value_text,
                                   std::string &error_message);

    /**
     * Compiles all objectTypes[].logicBoard with Executable validation.
     * Used before Play so editor and game.exe share the same gate.
     * Does not mutate ProjectDoc or scripts/main.lua.
     */
    bool validateLogicForPlay(std::string &error_message) const;

    [[nodiscard]] bool layerVisible(const std::string &layer_id) const;
    [[nodiscard]] bool layerLocked(const std::string &layer_id) const;

    /**
     * Picks the topmost visible, unlocked instance whose placeholder AABB contains
     * the world point. Placeholder size is kSceneViewPlaceholderExtent * scale.
     * @returns entity id, or 0 if none
     */
    [[nodiscard]] EntityId pickEntityAt(float world_x, float world_y) const;

    /**
     * Topmost visible, unlocked instance whose placeholder AABB intersects the
     * axis-aligned world rectangle (any order of corners).
     * @returns entity id, or 0 if none
     */
    [[nodiscard]] EntityId pickEntityInRect(float x0, float y0, float x1, float y1) const;

    /** World AABB for scene-view placeholders (authoring preview, not runtime sprite size). */
    static constexpr float kSceneViewPlaceholderExtent = 32.f;

    bool canUndo() const;
    bool canRedo() const;
    void undo();
    void redo();

private:
    void bumpRevision();
    [[nodiscard]] SceneDef *activeScene();
    [[nodiscard]] const SceneDef *activeScene() const;

    ProjectDoc m_doc{};
    std::string m_path;
    bool m_has_project = false;
    std::uint64_t m_revision = 0;
    std::uint64_t m_saved_revision = 0;
    EntityId m_selected_entity_id = 0;
    std::string m_active_layer_id;
    CommandStack m_commands;
};

} // namespace ArtCade::EditorCore

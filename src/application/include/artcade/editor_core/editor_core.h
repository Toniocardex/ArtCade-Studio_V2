#pragma once

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

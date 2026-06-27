#pragma once

#include "core/types.h"
#include "editor-native/commands/editor_command.h"

#include <string>

namespace ArtCade::EditorNative {

// =============================================================================
// Entity authoring commands — operate on a SceneInstanceDef in the active scene.
// =============================================================================

/** Move one instance. Invalidates Inspector | Viewport (prompt §24.4). */
class SetEntityPositionCommand final : public EditorCommand {
public:
    SetEntityPositionCommand(EntityId id, Vec2 position);

    EditorOperationResult apply(ProjectDocument& document) override;
    EditorOperationResult undo(ProjectDocument& document) override;
    const char* name() const override { return "SetEntityPosition"; }

private:
    EntityId id_;
    Vec2     newPosition_;
    Vec2     oldPosition_{};
    bool     captured_ = false;
};

/** Rename one instance. Invalidates Hierarchy | Inspector. */
class RenameEntityCommand final : public EditorCommand {
public:
    RenameEntityCommand(EntityId id, std::string name);

    EditorOperationResult apply(ProjectDocument& document) override;
    EditorOperationResult undo(ProjectDocument& document) override;
    const char* name() const override { return "RenameEntity"; }

private:
    EntityId    id_;
    std::string newName_;
    std::string oldName_;
    bool        captured_ = false;
};

} // namespace ArtCade::EditorNative

#include "editor-native/commands/entity_commands.h"

#include "editor-native/model/project_document.h"

#include <utility>

namespace ArtCade::EditorNative {

namespace {
constexpr EditorInvalidation kPositionInvalidation =
    EditorInvalidation::Inspector | EditorInvalidation::Viewport;
constexpr EditorInvalidation kRenameInvalidation =
    EditorInvalidation::Hierarchy | EditorInvalidation::Inspector;
} // namespace

// ----------------------------------------------------------------------------
// SetEntityPositionCommand
// ----------------------------------------------------------------------------
SetEntityPositionCommand::SetEntityPositionCommand(EntityId id, Vec2 position)
    : id_(id), newPosition_(position) {}

EditorOperationResult SetEntityPositionCommand::apply(ProjectDocument& document) {
    const SceneInstanceDef* current = document.findInstanceInActiveScene(id_);
    if (!current) {
        return EditorOperationResult::failure("No instance with that id in the active scene");
    }
    if (!captured_) {
        oldPosition_ = current->transform.position;
        captured_ = true;
    }
    if (!document.setInstancePosition(id_, newPosition_)) {
        return EditorOperationResult::failure("Failed to set instance position");
    }
    return EditorOperationResult::success(kPositionInvalidation);
}

EditorOperationResult SetEntityPositionCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setInstancePosition(id_, oldPosition_)) {
        return EditorOperationResult::failure("Cannot undo position change");
    }
    return EditorOperationResult::success(kPositionInvalidation);
}

// ----------------------------------------------------------------------------
// RenameEntityCommand
// ----------------------------------------------------------------------------
RenameEntityCommand::RenameEntityCommand(EntityId id, std::string name)
    : id_(id), newName_(std::move(name)) {}

EditorOperationResult RenameEntityCommand::apply(ProjectDocument& document) {
    const SceneInstanceDef* current = document.findInstanceInActiveScene(id_);
    if (!current) {
        return EditorOperationResult::failure("No instance with that id in the active scene");
    }
    if (newName_.empty()) {
        return EditorOperationResult::failure("Name cannot be empty");
    }
    if (!captured_) {
        oldName_ = current->instanceName;
        captured_ = true;
    }
    if (!document.setInstanceName(id_, newName_)) {
        return EditorOperationResult::failure("Failed to rename instance");
    }
    return EditorOperationResult::success(kRenameInvalidation);
}

EditorOperationResult RenameEntityCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setInstanceName(id_, oldName_)) {
        return EditorOperationResult::failure("Cannot undo rename");
    }
    return EditorOperationResult::success(kRenameInvalidation);
}

} // namespace ArtCade::EditorNative

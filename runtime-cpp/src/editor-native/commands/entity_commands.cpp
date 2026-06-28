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
SetEntityPositionCommand::SetEntityPositionCommand(SceneId sceneId, EntityId id,
                                                   Vec2 position)
    : sceneId_(std::move(sceneId)), id_(id), newPosition_(position) {}

EditorOperationResult SetEntityPositionCommand::apply(ProjectDocument& document) {
    const SceneInstanceDef* current = document.findInstanceInScene(sceneId_, id_);
    if (!current) {
        return EditorOperationResult::failure("No instance with that id in the target scene");
    }
    if (!captured_) {
        oldPosition_ = current->transform.position;
        captured_ = true;
    }
    if (!document.setInstancePosition(sceneId_, id_, newPosition_)) {
        return EditorOperationResult::failure("Failed to set instance position");
    }
    return EditorOperationResult::success(
        kPositionInvalidation, DomainChange::entityChanged(sceneId_, id_));
}

EditorOperationResult SetEntityPositionCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setInstancePosition(sceneId_, id_, oldPosition_)) {
        return EditorOperationResult::failure("Cannot undo position change");
    }
    return EditorOperationResult::success(
        kPositionInvalidation, DomainChange::entityChanged(sceneId_, id_));
}

// ----------------------------------------------------------------------------
// RenameEntityCommand
// ----------------------------------------------------------------------------
RenameEntityCommand::RenameEntityCommand(SceneId sceneId, EntityId id, std::string name)
    : sceneId_(std::move(sceneId)), id_(id), newName_(std::move(name)) {}

EditorOperationResult RenameEntityCommand::apply(ProjectDocument& document) {
    const SceneInstanceDef* current = document.findInstanceInScene(sceneId_, id_);
    if (!current) {
        return EditorOperationResult::failure("No instance with that id in the target scene");
    }
    if (newName_.empty()) {
        return EditorOperationResult::failure("Name cannot be empty");
    }
    if (!captured_) {
        oldName_ = current->instanceName;
        captured_ = true;
    }
    if (!document.setInstanceName(sceneId_, id_, newName_)) {
        return EditorOperationResult::failure("Failed to rename instance");
    }
    return EditorOperationResult::success(
        kRenameInvalidation, DomainChange::entityChanged(sceneId_, id_));
}

EditorOperationResult RenameEntityCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setInstanceName(sceneId_, id_, oldName_)) {
        return EditorOperationResult::failure("Cannot undo rename");
    }
    return EditorOperationResult::success(
        kRenameInvalidation, DomainChange::entityChanged(sceneId_, id_));
}

} // namespace ArtCade::EditorNative

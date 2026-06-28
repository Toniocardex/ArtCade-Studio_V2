#include "editor-native/commands/scene_commands.h"

#include "editor-native/model/project_document.h"

#include <utility>

namespace ArtCade::EditorNative {

// ----------------------------------------------------------------------------
// CreateSceneCommand
// ----------------------------------------------------------------------------
CreateSceneCommand::CreateSceneCommand(SceneId id, std::string name)
    : id_(std::move(id)), name_(std::move(name)) {}

EditorOperationResult CreateSceneCommand::apply(ProjectDocument& document) {
    if (id_.empty()) {
        return EditorOperationResult::failure("Scene id cannot be empty");
    }
    if (document.hasScene(id_)) {
        return EditorOperationResult::failure("A scene with that id already exists");
    }
    if (!document.createScene(id_, name_)) {
        return EditorOperationResult::failure("Failed to create scene");
    }
    return EditorOperationResult::success(EditorInvalidation::Hierarchy
                                          | EditorInvalidation::Project,
                                          DomainChange::sceneAdded(id_));
}

EditorOperationResult CreateSceneCommand::undo(ProjectDocument& document) {
    if (!document.deleteScene(id_)) {
        return EditorOperationResult::failure("Cannot undo scene creation");
    }
    return EditorOperationResult::success(EditorInvalidation::Hierarchy
                                          | EditorInvalidation::Project,
                                          DomainChange::sceneRemoved(id_));
}

// ----------------------------------------------------------------------------
// SetSceneBackgroundCommand
// ----------------------------------------------------------------------------
SetSceneBackgroundCommand::SetSceneBackgroundCommand(SceneId sceneId, Vec4 color)
    : sceneId_(std::move(sceneId)), newColor_(color) {}

EditorOperationResult SetSceneBackgroundCommand::apply(ProjectDocument& document) {
    const SceneDef* scene = document.findScene(sceneId_);
    if (!scene) {
        return EditorOperationResult::failure("No target scene");
    }
    if (!captured_) {
        oldColor_ = scene->backgroundColor;
        captured_ = true;
    }
    if (!document.setSceneBackground(sceneId_, newColor_)) {
        return EditorOperationResult::failure("Failed to set background");
    }
    return EditorOperationResult::success(
        EditorInvalidation::Viewport, DomainChange::sceneChanged(sceneId_));
}

EditorOperationResult SetSceneBackgroundCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setSceneBackground(sceneId_, oldColor_)) {
        return EditorOperationResult::failure("Cannot undo background change");
    }
    return EditorOperationResult::success(
        EditorInvalidation::Viewport, DomainChange::sceneChanged(sceneId_));
}

} // namespace ArtCade::EditorNative

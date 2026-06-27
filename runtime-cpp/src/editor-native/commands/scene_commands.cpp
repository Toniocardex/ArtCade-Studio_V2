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
                                          | EditorInvalidation::Project);
}

EditorOperationResult CreateSceneCommand::undo(ProjectDocument& document) {
    if (!document.deleteScene(id_)) {
        return EditorOperationResult::failure("Cannot undo scene creation");
    }
    return EditorOperationResult::success(EditorInvalidation::Hierarchy
                                          | EditorInvalidation::Project);
}

// ----------------------------------------------------------------------------
// SetSceneBackgroundCommand
// ----------------------------------------------------------------------------
SetSceneBackgroundCommand::SetSceneBackgroundCommand(Vec4 color)
    : newColor_(color) {}

EditorOperationResult SetSceneBackgroundCommand::apply(ProjectDocument& document) {
    const SceneDef* scene = document.activeScene();
    if (!scene) {
        return EditorOperationResult::failure("No active scene");
    }
    if (!captured_) {
        oldColor_ = scene->backgroundColor;
        captured_ = true;
    }
    if (!document.setActiveSceneBackground(newColor_)) {
        return EditorOperationResult::failure("Failed to set background");
    }
    return EditorOperationResult::success(EditorInvalidation::Viewport);
}

EditorOperationResult SetSceneBackgroundCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setActiveSceneBackground(oldColor_)) {
        return EditorOperationResult::failure("Cannot undo background change");
    }
    return EditorOperationResult::success(EditorInvalidation::Viewport);
}

} // namespace ArtCade::EditorNative

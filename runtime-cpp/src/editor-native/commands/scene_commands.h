#pragma once

#include "core/types.h"
#include "editor-native/commands/editor_command.h"

#include <string>

namespace ArtCade::EditorNative {

// =============================================================================
// Scene authoring commands.
// =============================================================================

/** Create an empty scene. Invalidates Hierarchy | Project. */
class CreateSceneCommand final : public EditorCommand {
public:
    CreateSceneCommand(SceneId id, std::string name);

    EditorOperationResult apply(ProjectDocument& document) override;
    EditorOperationResult undo(ProjectDocument& document) override;
    const char* name() const override { return "CreateScene"; }

private:
    SceneId     id_;
    std::string name_;
};

/** Set one scene's background colour. Invalidates Viewport. */
class SetSceneBackgroundCommand final : public EditorCommand {
public:
    SetSceneBackgroundCommand(SceneId sceneId, Vec4 color);

    EditorOperationResult apply(ProjectDocument& document) override;
    EditorOperationResult undo(ProjectDocument& document) override;
    const char* name() const override { return "SetSceneBackground"; }

private:
    SceneId sceneId_;
    Vec4 newColor_;
    Vec4 oldColor_{};
    bool captured_ = false;
};

} // namespace ArtCade::EditorNative

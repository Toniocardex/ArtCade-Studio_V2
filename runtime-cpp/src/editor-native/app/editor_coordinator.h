#pragma once

#include "core/types.h"
#include "editor-native/app/command_stack.h"
#include "editor-native/commands/editor_command.h"
#include "editor-native/commands/editor_intent.h"
#include "editor-native/commands/editor_operation_result.h"
#include "editor-native/model/editor_ui_state.h"
#include "editor-native/model/project_document.h"
#include "editor-native/model/selection_state.h"

#include <memory>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace ArtCade::EditorNative {

struct ConsoleMessage {
    enum class Level { Info, Warning, Error };
    Level       level = Level::Info;
    std::string text;
};

// =============================================================================
// EditorCoordinator — the one and only coordinator (prompt §5).
//
// Owns the ProjectDocument, SelectionState, EditorUiState and per-scene view
// state. Executes commands, applies intents, accumulates explicit invalidation
// and exposes read-only queries to the panels. It draws nothing, contains no
// RML/RCSS, owns no renderer, and is not a service locator.
//
// Communication between panels passes through here:
//   Hierarchy click → apply(SelectEntityIntent) → SelectionState updated
//                   → invalidate Hierarchy | Inspector | Viewport
// =============================================================================
class EditorCoordinator {
public:
    EditorCoordinator() = default;
    explicit EditorCoordinator(ProjectDoc doc) : document_(std::move(doc)) {}

    // ---- queries -------------------------------------------------------------
    const ProjectDocument& document()  const { return document_; }
    ProjectDocument&       document()        { return document_; }
    const SelectionState&  selection() const { return selection_; }
    const EditorUiState&   uiState()   const { return uiState_; }
    const EditorSceneViewState& sceneView(const SceneId& id) const;
    const std::vector<ConsoleMessage>& consoleLog() const { return console_; }

    // ---- command path (authoring; undoable) ---------------------------------
    /** Run a command by value, e.g. execute(SetEntityPositionCommand{id, pos}). */
    template <class CommandT>
    EditorOperationResult execute(CommandT command) {
        return executeOwned(std::make_unique<CommandT>(std::move(command)));
    }

    bool                  canUndo() const { return history_.canUndo(); }
    EditorOperationResult undo();

    // ---- intent path (workspace/editor state) -------------------------------
    EditorOperationResult apply(const SelectEntityIntent& intent);
    EditorOperationResult apply(const SelectSceneIntent& intent);
    EditorOperationResult apply(const SetViewportZoomIntent& intent);
    EditorOperationResult apply(const PanViewportIntent& intent);
    EditorOperationResult apply(const SetHierarchyFilterIntent& intent);
    EditorOperationResult apply(const ResizePanelIntent& intent);

    // ---- console -------------------------------------------------------------
    void logInfo(std::string text);
    void logWarning(std::string text);
    void logError(std::string text);

    // ---- frame ---------------------------------------------------------------
    /** Returns the accumulated invalidation and clears it (once per frame). */
    EditorInvalidation consumeInvalidations();
    EditorInvalidation pendingInvalidations() const { return pending_; }

private:
    EditorOperationResult executeOwned(std::unique_ptr<EditorCommand> command);
    void accumulate(EditorInvalidation invalidation) { pending_ |= invalidation; }
    void appendConsole(ConsoleMessage::Level level, std::string text);

    ProjectDocument                                  document_;
    SelectionState                                   selection_;
    EditorUiState                                    uiState_;
    std::unordered_map<SceneId, EditorSceneViewState> sceneViews_;
    EditorSceneViewState                             defaultSceneView_{};
    CommandStack                                     history_;
    std::vector<ConsoleMessage>                      console_;
    EditorInvalidation                               pending_ = EditorInvalidation::None;
};

} // namespace ArtCade::EditorNative

#pragma once

#include "core/types.h"
#include "editor-native/app/command_stack.h"
#include "editor-native/commands/editor_command.h"
#include "editor-native/commands/editor_intent.h"
#include "editor-native/commands/editor_operation_result.h"
#include "editor-native/model/editor_state.h"
#include "editor-native/model/editor_ui_state.h"
#include "editor-native/model/play_session.h"
#include "editor-native/model/project_document.h"

#include <memory>
#include <optional>
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
// Owns the ProjectDocument, EditorState, SelectionState, EditorUiState and per-scene view
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
    explicit EditorCoordinator(ProjectDoc doc);

    // ---- queries -------------------------------------------------------------
    const ProjectDocument& document()  const { return document_; }
    const SelectionState&  selection() const { return state_.selection; }
    const EditorUiState&   uiState()   const { return uiState_; }
    const EditorState&     state()     const { return state_; }
    const EditorSceneViewState& sceneView(const SceneId& id) const;
    const std::vector<ConsoleMessage>& consoleLog() const { return console_; }

    // ---- command path (authoring; undoable) ---------------------------------
    /** Run a command by value, e.g. execute(SetEntityPositionCommand{scene, id, pos}). */
    template <class CommandT>
    EditorOperationResult execute(CommandT command) {
        return executeOwned(std::make_unique<CommandT>(std::move(command)));
    }

    bool                  canUndo() const { return history_.canUndo(); }
    std::size_t           undoSize() const { return history_.size(); }
    EditorOperationResult undo();
    EditorOperationResult replaceProject(ProjectDocument replacement);
    EditorOperationResult markProjectSaved();

    // ---- Play / Stop (runtime session; the document is never mutated) --------
    // The two modes have distinct targets: Play Project uses the document's
    // start scene, Play Current Scene uses the editor's active scene. Each is
    // available only when its target identifies an existing scene; the guard
    // lives here, not only in the toolbar, so a shortcut, menu or programmatic
    // call cannot bypass it. A rejected Play mutates nothing and invalidates
    // nothing (no session, no revision, no dirty, no invalidation).
    bool isPlaying()            const { return playSession_.has_value(); }
    bool canPlayProject()       const;
    bool canPlayCurrentScene()  const;
    const PlaySession* playSession() const {
        return playSession_ ? &*playSession_ : nullptr;
    }
    EditorOperationResult playProject();
    EditorOperationResult playCurrentScene();
    EditorOperationResult stopPlaying();

    // ---- intent path (workspace/editor state) -------------------------------
    EditorOperationResult apply(const SelectEntityIntent& intent);
    EditorOperationResult apply(const SelectSceneIntent& intent);
    EditorOperationResult apply(const SetViewportZoomIntent& intent);
    EditorOperationResult apply(const PanViewportIntent& intent);
    EditorOperationResult apply(const SetHierarchyFilterIntent& intent);
    EditorOperationResult apply(const SetActiveToolIntent& intent);
    EditorOperationResult apply(const ToggleConsoleIntent& intent);
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

    // After a structural command (or its undo) mutates the document, the
    // workspace may reference a scene or entity that no longer exists. This
    // brings EditorState back to a valid state in the same operation — it
    // normalizes the active scene, clears a dangling selection and prunes
    // per-scene view state — and returns the extra invalidation that change
    // implies. It restores the document's validity in the workspace, never the
    // UI history: an undone delete does not re-select what it brings back.
    EditorInvalidation reconcileWorkspace();

    ProjectDocument                                  document_;
    EditorState                                      state_;
    EditorUiState                                    uiState_;
    EditorSceneViewState                             defaultSceneView_{};
    CommandStack                                     history_;
    std::vector<ConsoleMessage>                      console_;
    std::optional<PlaySession>                       playSession_;
    EditorInvalidation                               pending_ = EditorInvalidation::None;
};

} // namespace ArtCade::EditorNative

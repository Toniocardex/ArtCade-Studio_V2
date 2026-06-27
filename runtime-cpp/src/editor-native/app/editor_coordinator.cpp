#include "editor-native/app/editor_coordinator.h"

#include <utility>

namespace ArtCade::EditorNative {

namespace {
// Selecting an entity refreshes the tree highlight, the inspector contents and
// the viewport gizmo — nothing else.
constexpr EditorInvalidation kSelectionInvalidation =
    EditorInvalidation::Hierarchy | EditorInvalidation::Inspector
    | EditorInvalidation::Viewport;

// A scene change additionally refreshes the toolbar (scene name / play state).
constexpr EditorInvalidation kSceneChangeInvalidation =
    kSelectionInvalidation | EditorInvalidation::Toolbar;
} // namespace

const EditorSceneViewState& EditorCoordinator::sceneView(const SceneId& id) const {
    const auto it = sceneViews_.find(id);
    return it == sceneViews_.end() ? defaultSceneView_ : it->second;
}

// ----------------------------------------------------------------------------
// Command path
// ----------------------------------------------------------------------------
EditorOperationResult EditorCoordinator::executeOwned(
    std::unique_ptr<EditorCommand> command) {
    EditorOperationResult result = command->apply(document_);
    if (!result.ok) {
        // A failed command must leave no trace: no invalidation, no undo entry.
        appendConsole(ConsoleMessage::Level::Error, result.error);
        return result;
    }
    accumulate(result.invalidation);
    history_.push(std::move(command));
    return result;
}

EditorOperationResult EditorCoordinator::undo() {
    if (!history_.canUndo()) {
        return EditorOperationResult::failure("Nothing to undo");
    }
    std::unique_ptr<EditorCommand> command = history_.popForUndo();
    EditorOperationResult result = command->undo(document_);
    if (result.ok) accumulate(result.invalidation);
    else appendConsole(ConsoleMessage::Level::Error, result.error);
    return result;
}

// ----------------------------------------------------------------------------
// Intent path — workspace state only; never the ProjectDocument, never undo.
// ----------------------------------------------------------------------------
EditorOperationResult EditorCoordinator::apply(const SelectEntityIntent& intent) {
    selection_.primaryEntity = intent.entityId;
    accumulate(kSelectionInvalidation);
    return EditorOperationResult::success(kSelectionInvalidation);
}

EditorOperationResult EditorCoordinator::apply(const SelectSceneIntent& intent) {
    if (!document_.hasScene(intent.sceneId)) {
        return EditorOperationResult::failure("Unknown scene id");
    }
    // Editorial focus only — Select, not Replace. No serialization, no reload.
    document_.setActiveScene(intent.sceneId);
    selection_.clear();
    // Ensure a per-scene view state exists (restored on return to this scene).
    sceneViews_.try_emplace(intent.sceneId);
    accumulate(kSceneChangeInvalidation);
    return EditorOperationResult::success(kSceneChangeInvalidation);
}

EditorOperationResult EditorCoordinator::apply(const SetViewportZoomIntent& intent) {
    sceneViews_[intent.sceneId].zoom = clampZoom(intent.zoom);
    accumulate(EditorInvalidation::Viewport);
    return EditorOperationResult::success(EditorInvalidation::Viewport);
}

EditorOperationResult EditorCoordinator::apply(const PanViewportIntent& intent) {
    EditorSceneViewState& view = sceneViews_[intent.sceneId];
    view.pan.x += intent.delta.x;
    view.pan.y += intent.delta.y;
    accumulate(EditorInvalidation::Viewport);
    return EditorOperationResult::success(EditorInvalidation::Viewport);
}

EditorOperationResult EditorCoordinator::apply(const SetHierarchyFilterIntent& intent) {
    uiState_.hierarchyFilter = intent.filter;
    accumulate(EditorInvalidation::Hierarchy);
    return EditorOperationResult::success(EditorInvalidation::Hierarchy);
}

EditorOperationResult EditorCoordinator::apply(const ResizePanelIntent& intent) {
    switch (intent.panel) {
        case ResizePanelIntent::Panel::Left:
            uiState_.leftPanelWidth = clampLeftPanel(intent.size);
            break;
        case ResizePanelIntent::Panel::Right:
            uiState_.rightPanelWidth = clampRightPanel(intent.size);
            break;
        case ResizePanelIntent::Panel::Console:
            uiState_.consoleHeight = clampConsole(intent.size);
            break;
    }
    // A splitter drag relays out the shell but refreshes no panel content.
    return EditorOperationResult::success(EditorInvalidation::None);
}

// ----------------------------------------------------------------------------
// Console
// ----------------------------------------------------------------------------
void EditorCoordinator::appendConsole(ConsoleMessage::Level level, std::string text) {
    console_.push_back(ConsoleMessage{level, std::move(text)});
    accumulate(EditorInvalidation::Console);
}

void EditorCoordinator::logInfo(std::string text) {
    appendConsole(ConsoleMessage::Level::Info, std::move(text));
}
void EditorCoordinator::logWarning(std::string text) {
    appendConsole(ConsoleMessage::Level::Warning, std::move(text));
}
void EditorCoordinator::logError(std::string text) {
    appendConsole(ConsoleMessage::Level::Error, std::move(text));
}

// ----------------------------------------------------------------------------
// Frame
// ----------------------------------------------------------------------------
EditorInvalidation EditorCoordinator::consumeInvalidations() {
    const EditorInvalidation snapshot = pending_;
    pending_ = EditorInvalidation::None;
    return snapshot;
}

} // namespace ArtCade::EditorNative

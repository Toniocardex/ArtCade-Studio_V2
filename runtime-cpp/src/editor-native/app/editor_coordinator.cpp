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

constexpr EditorInvalidation kProjectReplaceInvalidation =
    EditorInvalidation::Hierarchy | EditorInvalidation::Inspector
    | EditorInvalidation::Viewport | EditorInvalidation::Assets
    | EditorInvalidation::Toolbar | EditorInvalidation::Project;

SceneId normalizedSceneId(const ProjectDocument& document) {
    if (!document.startSceneId().empty() && document.hasScene(document.startSceneId())) {
        return document.startSceneId();
    }
    if (!document.data().scenes.empty()) {
        return document.data().scenes.begin()->first;
    }
    return {};
}
} // namespace

EditorCoordinator::EditorCoordinator(ProjectDoc doc)
    : document_(std::move(doc)) {
    state_.activeSceneId = document_.startSceneId();
    if (state_.activeSceneId.empty() && !document_.data().scenes.empty()) {
        state_.activeSceneId = document_.data().scenes.begin()->first;
    }
}

const EditorSceneViewState& EditorCoordinator::sceneView(const SceneId& id) const {
    const auto it = state_.sceneViews.find(id);
    return it == state_.sceneViews.end() ? defaultSceneView_ : it->second;
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

EditorOperationResult EditorCoordinator::replaceProject(ProjectDocument replacement) {
    document_.replaceClean(std::move(replacement));

    state_.activeSceneId = normalizedSceneId(document_);
    state_.selection.clear();
    state_.sceneViews.clear();
    if (!state_.activeSceneId.empty()) {
        state_.sceneViews.try_emplace(state_.activeSceneId);
    }
    history_.clear();

    accumulate(kProjectReplaceInvalidation);
    return EditorOperationResult::success(
        kProjectReplaceInvalidation, DomainChange::projectReplaced());
}

EditorOperationResult EditorCoordinator::markProjectSaved() {
    document_.markSaved();
    accumulate(EditorInvalidation::Toolbar);
    return EditorOperationResult::success(EditorInvalidation::Toolbar);
}

// ----------------------------------------------------------------------------
// Intent path — workspace state only; never the ProjectDocument, never undo.
// ----------------------------------------------------------------------------
EditorOperationResult EditorCoordinator::apply(const SelectEntityIntent& intent) {
    if (intent.entityId != INVALID_ENTITY
        && !document_.findInstanceInScene(state_.activeSceneId, intent.entityId)) {
        return EditorOperationResult::failure("Unknown entity id in active scene");
    }
    state_.selection.primaryEntity = intent.entityId;
    accumulate(kSelectionInvalidation);
    return EditorOperationResult::success(kSelectionInvalidation);
}

EditorOperationResult EditorCoordinator::apply(const SelectSceneIntent& intent) {
    if (!document_.hasScene(intent.sceneId)) {
        return EditorOperationResult::failure("Unknown scene id");
    }
    // Editorial focus only — workspace state, not ProjectDocument.
    state_.activeSceneId = intent.sceneId;
    state_.selection.clear();
    // Ensure a per-scene view state exists (restored on return to this scene).
    state_.sceneViews.try_emplace(intent.sceneId);
    accumulate(kSceneChangeInvalidation);
    return EditorOperationResult::success(kSceneChangeInvalidation);
}

EditorOperationResult EditorCoordinator::apply(const SetViewportZoomIntent& intent) {
    state_.sceneViews[intent.sceneId].zoom = clampZoom(intent.zoom);
    accumulate(EditorInvalidation::Viewport);
    return EditorOperationResult::success(EditorInvalidation::Viewport);
}

EditorOperationResult EditorCoordinator::apply(const PanViewportIntent& intent) {
    EditorSceneViewState& view = state_.sceneViews[intent.sceneId];
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

EditorOperationResult EditorCoordinator::apply(const SetActiveToolIntent& intent) {
    state_.activeTool = intent.tool;
    return EditorOperationResult::success(EditorInvalidation::Toolbar);
}

EditorOperationResult EditorCoordinator::apply(const ToggleConsoleIntent&) {
    uiState_.consoleVisible = !uiState_.consoleVisible;
    const EditorInvalidation inv = EditorInvalidation::Layout | EditorInvalidation::Viewport;
    accumulate(inv);
    return EditorOperationResult::success(inv);
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
    const EditorInvalidation inv = EditorInvalidation::Layout | EditorInvalidation::Viewport;
    accumulate(inv);
    return EditorOperationResult::success(inv);
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

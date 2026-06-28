#pragma once

#include "core/types.h"
#include "editor-native/commands/editor_operation_result.h"

namespace ArtCade::EditorNative {

class EditorCoordinator;
class ProjectDocument;

// =============================================================================
// Hierarchy actions — the editorial operations wired from the Hierarchy panel,
// kept UI-free so they are unit-testable without RmlUi (like inspector_commit).
//
// Each action reads authoritative state through const queries, builds exactly
// one EditorCommand, and forwards it to the coordinator. It never mutates the
// ProjectDocument or the selection directly, never decides which panels refresh
// (the coordinator accumulates invalidation), and produces at most one command.
// When a precondition is not met it returns a failure WITHOUT running a command,
// so nothing is mutated and nothing is invalidated.
// =============================================================================

// ---- Identity allocation (deterministic; consults the authoritative doc) ----

/**
 * Next free instance id for @p sceneId: one past the largest id already placed
 * in that scene (>= 1, never INVALID_ENTITY). Per-scene uniqueness matches what
 * ProjectValidator enforces; there is no duplicate counter held anywhere.
 */
EntityId nextAvailableEntityId(const ProjectDocument& document, const SceneId& sceneId);

/** A scene id of the form "scene-N" not already present in @p document. */
SceneId makeUniqueSceneId(const ProjectDocument& document);

// ---- Actions ----------------------------------------------------------------

/** Create a new, uniquely-id'd scene. Does not change the active scene. */
EditorOperationResult addScene(EditorCoordinator& coordinator);

/** Delete @p sceneId. The coordinator reconciles the workspace afterwards. */
EditorOperationResult deleteScene(EditorCoordinator& coordinator, const SceneId& sceneId);

/** Make @p sceneId the gameplay start scene (no-op if it already is). */
EditorOperationResult setStartScene(EditorCoordinator& coordinator, const SceneId& sceneId);

/** Place a new instance in the active scene. Does not change the selection. */
EditorOperationResult addEntity(EditorCoordinator& coordinator);

/** Delete the selected instance from the active scene. No selection → no-op. */
EditorOperationResult deleteSelectedEntity(EditorCoordinator& coordinator);

} // namespace ArtCade::EditorNative

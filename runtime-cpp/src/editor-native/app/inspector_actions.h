#pragma once

#include "core/types.h"
#include "editor-native/commands/editor_operation_result.h"

namespace ArtCade::EditorNative {

class EditorCoordinator;

// =============================================================================
// Inspector actions — the component edits wired from the Inspector, kept UI-free
// so they are unit-testable without RmlUi (like hierarchy_actions). Each reads
// the authoritative selection and active scene, builds exactly one command for
// that explicit (scene, entity), and forwards it to the coordinator. No generic
// property bag, no component registry; one typed action per operation.
// =============================================================================

/** Add a sprite renderer to the selected instance. No selection → no-op. */
EditorOperationResult addSpriteRenderer(EditorCoordinator& coordinator);

/** Remove the sprite renderer from the selected instance. */
EditorOperationResult removeSpriteRenderer(EditorCoordinator& coordinator);

/** Set the selected sprite renderer's visibility. */
EditorOperationResult setSpriteRendererVisible(EditorCoordinator& coordinator, bool visible);

/** Set the selected sprite renderer's image asset ("" clears it). */
EditorOperationResult setSpriteRendererAsset(EditorCoordinator& coordinator, const AssetId& assetId);

} // namespace ArtCade::EditorNative

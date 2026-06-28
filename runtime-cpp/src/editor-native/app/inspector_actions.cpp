#include "editor-native/app/inspector_actions.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/commands/sprite_commands.h"

namespace ArtCade::EditorNative {

namespace {
// Resolve the authoritative (active scene, selected entity) target, or report a
// readable failure when there is nothing to edit. Returns false on no target.
bool selectedTarget(const EditorCoordinator& coordinator, SceneId& sceneId, EntityId& id) {
    sceneId = coordinator.state().activeSceneId;
    id      = coordinator.selection().primaryEntity;
    return !sceneId.empty() && id != INVALID_ENTITY;
}
} // namespace

EditorOperationResult addSpriteRenderer(EditorCoordinator& coordinator) {
    SceneId sceneId; EntityId id;
    if (!selectedTarget(coordinator, sceneId, id)) {
        return EditorOperationResult::failure("No selected entity");
    }
    return coordinator.execute(AddSpriteRendererCommand{sceneId, id});
}

EditorOperationResult removeSpriteRenderer(EditorCoordinator& coordinator) {
    SceneId sceneId; EntityId id;
    if (!selectedTarget(coordinator, sceneId, id)) {
        return EditorOperationResult::failure("No selected entity");
    }
    return coordinator.execute(RemoveSpriteRendererCommand{sceneId, id});
}

EditorOperationResult setSpriteRendererVisible(EditorCoordinator& coordinator, bool visible) {
    SceneId sceneId; EntityId id;
    if (!selectedTarget(coordinator, sceneId, id)) {
        return EditorOperationResult::failure("No selected entity");
    }
    return coordinator.execute(SetSpriteRendererVisibleCommand{sceneId, id, visible});
}

EditorOperationResult setSpriteRendererAsset(EditorCoordinator& coordinator, const AssetId& assetId) {
    SceneId sceneId; EntityId id;
    if (!selectedTarget(coordinator, sceneId, id)) {
        return EditorOperationResult::failure("No selected entity");
    }
    return coordinator.execute(SetSpriteRendererAssetCommand{sceneId, id, assetId});
}

} // namespace ArtCade::EditorNative

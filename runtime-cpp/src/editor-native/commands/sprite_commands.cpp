#include "editor-native/commands/sprite_commands.h"

#include "editor-native/model/project_document.h"

#include <utility>

namespace ArtCade::EditorNative {

namespace {
constexpr EditorInvalidation kSpriteInvalidation =
    EditorInvalidation::Inspector | EditorInvalidation::Viewport;

const SpriteRendererComponent* spriteOf(const ProjectDocument& document,
                                        const SceneId& sceneId, EntityId id) {
    const SceneInstanceDef* inst = document.findInstanceInScene(sceneId, id);
    return (inst && inst->spriteRenderer) ? &*inst->spriteRenderer : nullptr;
}
} // namespace

// ----------------------------------------------------------------------------
// AddSpriteRendererCommand
// ----------------------------------------------------------------------------
AddSpriteRendererCommand::AddSpriteRendererCommand(SceneId sceneId, EntityId id)
    : sceneId_(std::move(sceneId)), id_(id) {}

EditorOperationResult AddSpriteRendererCommand::apply(ProjectDocument& document) {
    const SceneInstanceDef* inst = document.findInstanceInScene(sceneId_, id_);
    if (!inst) {
        return EditorOperationResult::failure("No instance with that id in the target scene");
    }
    if (inst->spriteRenderer.has_value()) {
        return EditorOperationResult::failure("Instance already has a sprite renderer");
    }
    if (!document.addSpriteRenderer(sceneId_, id_, SpriteRendererComponent{})) {
        return EditorOperationResult::failure("Failed to add sprite renderer");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentAdded(sceneId_, id_, ComponentKind::SpriteRenderer));
}

EditorOperationResult AddSpriteRendererCommand::undo(ProjectDocument& document) {
    if (!document.removeSpriteRenderer(sceneId_, id_)) {
        return EditorOperationResult::failure("Cannot undo sprite renderer add");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentRemoved(sceneId_, id_, ComponentKind::SpriteRenderer));
}

// ----------------------------------------------------------------------------
// RemoveSpriteRendererCommand
// ----------------------------------------------------------------------------
RemoveSpriteRendererCommand::RemoveSpriteRendererCommand(SceneId sceneId, EntityId id)
    : sceneId_(std::move(sceneId)), id_(id) {}

EditorOperationResult RemoveSpriteRendererCommand::apply(ProjectDocument& document) {
    const SpriteRendererComponent* current = spriteOf(document, sceneId_, id_);
    if (!current) {
        return EditorOperationResult::failure("Instance has no sprite renderer");
    }
    if (!captured_) {
        removed_  = *current;   // snapshot for an exact undo
        captured_ = true;
    }
    if (!document.removeSpriteRenderer(sceneId_, id_)) {
        return EditorOperationResult::failure("Failed to remove sprite renderer");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentRemoved(sceneId_, id_, ComponentKind::SpriteRenderer));
}

EditorOperationResult RemoveSpriteRendererCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.addSpriteRenderer(sceneId_, id_, removed_)) {
        return EditorOperationResult::failure("Cannot undo sprite renderer removal");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentAdded(sceneId_, id_, ComponentKind::SpriteRenderer));
}

// ----------------------------------------------------------------------------
// SetSpriteRendererVisibleCommand
// ----------------------------------------------------------------------------
SetSpriteRendererVisibleCommand::SetSpriteRendererVisibleCommand(SceneId sceneId, EntityId id,
                                                                 bool visible)
    : sceneId_(std::move(sceneId)), id_(id), next_(visible) {}

EditorOperationResult SetSpriteRendererVisibleCommand::apply(ProjectDocument& document) {
    const SpriteRendererComponent* current = spriteOf(document, sceneId_, id_);
    if (!current) {
        return EditorOperationResult::failure("Instance has no sprite renderer");
    }
    if (current->visible == next_) {
        return EditorOperationResult::success(EditorInvalidation::None); // no-op, not undoable
    }
    if (!captured_) {
        previous_ = current->visible;
        captured_ = true;
    }
    if (!document.setSpriteRendererVisible(sceneId_, id_, next_)) {
        return EditorOperationResult::failure("Failed to set sprite visibility");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentChanged(sceneId_, id_, ComponentKind::SpriteRenderer));
}

EditorOperationResult SetSpriteRendererVisibleCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setSpriteRendererVisible(sceneId_, id_, previous_)) {
        return EditorOperationResult::failure("Cannot undo sprite visibility change");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentChanged(sceneId_, id_, ComponentKind::SpriteRenderer));
}

// ----------------------------------------------------------------------------
// SetSpriteRendererAssetCommand
// ----------------------------------------------------------------------------
SetSpriteRendererAssetCommand::SetSpriteRendererAssetCommand(SceneId sceneId, EntityId id,
                                                             AssetId assetId)
    : sceneId_(std::move(sceneId)), id_(id), next_(std::move(assetId)) {}

EditorOperationResult SetSpriteRendererAssetCommand::apply(ProjectDocument& document) {
    const SpriteRendererComponent* current = spriteOf(document, sceneId_, id_);
    if (!current) {
        return EditorOperationResult::failure("Instance has no sprite renderer");
    }
    // Empty clears the image; a non-empty id must reference an existing image asset.
    if (!next_.empty() && !document.hasImageAsset(next_)) {
        return EditorOperationResult::failure("Unknown image asset: " + next_);
    }
    if (current->imageAssetId == next_) {
        return EditorOperationResult::success(EditorInvalidation::None); // no-op, not undoable
    }
    if (!captured_) {
        previous_ = current->imageAssetId;
        captured_ = true;
    }
    if (!document.setSpriteRendererAsset(sceneId_, id_, next_)) {
        return EditorOperationResult::failure("Failed to set sprite asset");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentChanged(sceneId_, id_, ComponentKind::SpriteRenderer));
}

EditorOperationResult SetSpriteRendererAssetCommand::undo(ProjectDocument& document) {
    if (!captured_ || !document.setSpriteRendererAsset(sceneId_, id_, previous_)) {
        return EditorOperationResult::failure("Cannot undo sprite asset change");
    }
    return EditorOperationResult::success(
        kSpriteInvalidation,
        DomainChange::componentChanged(sceneId_, id_, ComponentKind::SpriteRenderer));
}

} // namespace ArtCade::EditorNative

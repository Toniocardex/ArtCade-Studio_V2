#pragma once

#include "core/types.h"

#include <cstddef>
#include <cstdint>
#include <string>

namespace ArtCade::EditorNative {

class AddBoxColliderCommand;
class AddSpriteRendererCommand;
class CreateEntityCommand;
class CreateSceneCommand;
class DeleteEntityCommand;
class DeleteSceneCommand;
class EditorCoordinator;
class AddLinearMoverCommand;
class RemoveBoxColliderCommand;
class RemoveLinearMoverCommand;
class RemoveSpriteRendererCommand;
class RenameEntityCommand;
class SetEntityPositionCommand;
class SetBoxColliderEnabledCommand;
class SetLinearMoverDirectionCommand;
class SetLinearMoverSpeedCommand;
class SetBoxColliderOffsetCommand;
class SetBoxColliderSizeCommand;
class SetBoxColliderTriggerCommand;
class SetSceneBackgroundCommand;
class SetSpriteRendererAssetCommand;
class SetSpriteRendererVisibleCommand;
class SetStartSceneCommand;

// =============================================================================
// ProjectDocument — the single authoring authority of the native editor.
//
// It OWNS the canonical ProjectDoc (runtime-cpp/src/core/types.h). There is no
// parallel UiProjectModel / InspectorProjectModel / RuntimeProjectCopy: panels
// query this object and mutate it only through commands (prompt §3).
//
// Three structural verbs map to the runtime projection (prompt §7):
//   replace()        — Replace: open / recovery / import / full swap
//   setInstance*()   — Patch  : local mutation of one instance in an explicit scene
//
// `replaceCount()` and `revision()` are observable spies so tests can prove a
// selection or editor scene change performs neither a Replace nor a serialization.
// =============================================================================
class ProjectDocument {
public:
    ProjectDocument() = default;
    explicit ProjectDocument(ProjectDoc doc);

    // ---- queries (read-only) -------------------------------------------------
    const ProjectDoc&        data() const { return doc_; }
    const SceneId&           startSceneId() const { return doc_.activeSceneId; }
    const SceneDef*          findScene(const SceneId& id) const;
    bool                     hasScene(const SceneId& id) const;
    const SceneInstanceDef*  findInstanceInScene(const SceneId& sceneId, EntityId id) const;
    /** True if @p id is a known image asset (ProjectDoc.imageAssets). */
    bool                     hasImageAsset(const AssetId& id) const;

    bool      isDirty()      const { return revision_ != savedRevision_; }
    uint64_t  revision()     const { return revision_; }
    uint64_t  savedRevision() const { return savedRevision_; }
    uint32_t  replaceCount() const { return replaceCount_; }

    // ---- Replace (structural) -----------------------------------------------
    /** Full document swap. The only place replaceCount is bumped. */
    void replace(ProjectDoc doc);

private:
    friend class AddBoxColliderCommand;
    friend class AddLinearMoverCommand;
    friend class AddSpriteRendererCommand;
    friend class CreateEntityCommand;
    friend class CreateSceneCommand;
    friend class DeleteEntityCommand;
    friend class DeleteSceneCommand;
    friend class EditorCoordinator;
    friend class RemoveBoxColliderCommand;
    friend class RemoveLinearMoverCommand;
    friend class RemoveSpriteRendererCommand;
    friend class RenameEntityCommand;
    friend class SetEntityPositionCommand;
    friend class SetBoxColliderEnabledCommand;
    friend class SetBoxColliderOffsetCommand;
    friend class SetBoxColliderSizeCommand;
    friend class SetBoxColliderTriggerCommand;
    friend class SetLinearMoverDirectionCommand;
    friend class SetLinearMoverSpeedCommand;
    friend class SetSceneBackgroundCommand;
    friend class SetSpriteRendererAssetCommand;
    friend class SetSpriteRendererVisibleCommand;
    friend class SetStartSceneCommand;

    // ---- Patch (authoring mutations; called by commands) --------------------
    bool setInstancePosition(const SceneId& sceneId, EntityId id, Vec2 position);
    bool setInstanceName(const SceneId& sceneId, EntityId id, std::string name);
    bool setSceneBackground(const SceneId& sceneId, Vec4 color);
    // The persisted gameplay start scene. Empty is allowed only when there are
    // no scenes; a non-empty id must reference an existing scene.
    bool setStartSceneId(const SceneId& sceneId);
    bool createScene(const SceneId& id, const std::string& name);
    bool deleteScene(const SceneId& id);
    // Restore a previously deleted scene with its instances and the start-scene
    // id that was active before deletion — the exact inverse of deleteScene.
    bool restoreScene(SceneDef scene, const SceneId& startSceneId);
    // Instance structural verbs. createInstance appends; insertInstance places at
    // a captured index so DeleteEntityCommand undo restores the original order.
    bool createInstance(const SceneId& sceneId, SceneInstanceDef instance);
    bool insertInstance(const SceneId& sceneId, std::size_t index, SceneInstanceDef instance);
    bool deleteInstance(const SceneId& sceneId, EntityId id);
    // Sprite-renderer component patch verbs (explicit, no property bag).
    bool addSpriteRenderer(const SceneId& sceneId, EntityId id, SpriteRendererComponent component);
    bool removeSpriteRenderer(const SceneId& sceneId, EntityId id);
    bool setSpriteRendererVisible(const SceneId& sceneId, EntityId id, bool visible);
    bool setSpriteRendererAsset(const SceneId& sceneId, EntityId id, AssetId assetId);
    // BoxCollider2D is authored on the object type only; instances never store it.
    bool addBoxCollider(const std::string& objectTypeId, BoxCollider2DComponent component);
    bool removeBoxCollider(const std::string& objectTypeId);
    bool setBoxColliderOffset(const std::string& objectTypeId, Vec2 offset);
    bool setBoxColliderSize(const std::string& objectTypeId, Vec2 size);
    bool setBoxColliderEnabled(const std::string& objectTypeId, bool enabled);
    bool setBoxColliderTrigger(const std::string& objectTypeId, bool isTrigger);
    // LinearMover is authored on the object type only (canonical gameplay
    // component); instances never store it. Pause is a runtime flag, not edited.
    bool addLinearMover(const std::string& objectTypeId, LinearMoverComponent component);
    bool removeLinearMover(const std::string& objectTypeId);
    bool setLinearMoverDirection(const std::string& objectTypeId, Vec2 direction);
    bool setLinearMoverSpeed(const std::string& objectTypeId, float speed);
    void replaceClean(ProjectDocument replacement);
    void markSaved();

    SceneDef*         mutableScene(const SceneId& id);
    SceneInstanceDef* mutableInstanceInScene(const SceneId& sceneId, EntityId id);
    void              markDirty();

    ProjectDoc doc_{};
    uint64_t   revision_     = 0;
    uint64_t   savedRevision_ = 0;
    uint32_t   replaceCount_ = 0;
};

} // namespace ArtCade::EditorNative

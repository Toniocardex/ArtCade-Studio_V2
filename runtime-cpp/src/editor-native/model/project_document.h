#pragma once

#include "core/types.h"

#include <cstddef>
#include <cstdint>
#include <string>

namespace ArtCade::EditorNative {

class CreateEntityCommand;
class CreateSceneCommand;
class DeleteEntityCommand;
class DeleteSceneCommand;
class EditorCoordinator;
class RenameEntityCommand;
class SetEntityPositionCommand;
class SetSceneBackgroundCommand;
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

    bool      isDirty()      const { return revision_ != savedRevision_; }
    uint64_t  revision()     const { return revision_; }
    uint64_t  savedRevision() const { return savedRevision_; }
    uint32_t  replaceCount() const { return replaceCount_; }

    // ---- Replace (structural) -----------------------------------------------
    /** Full document swap. The only place replaceCount is bumped. */
    void replace(ProjectDoc doc);

private:
    friend class CreateEntityCommand;
    friend class CreateSceneCommand;
    friend class DeleteEntityCommand;
    friend class DeleteSceneCommand;
    friend class EditorCoordinator;
    friend class RenameEntityCommand;
    friend class SetEntityPositionCommand;
    friend class SetSceneBackgroundCommand;
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

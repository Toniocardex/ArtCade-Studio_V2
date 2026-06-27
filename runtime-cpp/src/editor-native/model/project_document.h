#pragma once

#include "core/types.h"

#include <cstdint>
#include <string>

namespace ArtCade::EditorNative {

// =============================================================================
// ProjectDocument — the single authoring authority of the native editor.
//
// It OWNS the canonical ProjectDoc (runtime-cpp/src/core/types.h). There is no
// parallel UiProjectModel / InspectorProjectModel / RuntimeProjectCopy: panels
// query this object and mutate it only through commands (prompt §3).
//
// Three structural verbs map to the runtime projection (prompt §7):
//   replace()        — Replace: open / recovery / import / full swap
//   setActiveScene() — Select : editorial focus, NOT an authoring mutation
//   setInstance*()   — Patch  : local mutation of one instance
//
// `replaceCount()` and `revision()` are observable spies so tests can prove a
// selection or scene change performs neither a Replace nor a serialization.
// =============================================================================
class ProjectDocument {
public:
    ProjectDocument() = default;
    explicit ProjectDocument(ProjectDoc doc);

    // ---- queries (read-only) -------------------------------------------------
    const ProjectDoc&        data() const { return doc_; }
    const SceneId&           activeSceneId() const { return activeSceneId_; }
    const SceneDef*          activeScene() const;
    const SceneDef*          findScene(const SceneId& id) const;
    bool                     hasScene(const SceneId& id) const;
    const SceneInstanceDef*  findInstanceInActiveScene(EntityId id) const;

    bool      isDirty()      const { return dirty_; }
    uint64_t  revision()     const { return revision_; }
    uint32_t  replaceCount() const { return replaceCount_; }

    // ---- Replace (structural) -----------------------------------------------
    /** Full document swap. The only place replaceCount is bumped. */
    void replace(ProjectDoc doc);

    // ---- Select (editorial focus; no authoring mutation) --------------------
    /** Switch the edited scene. Returns false for an unknown id. Never Replaces,
     *  never serializes, never marks the document dirty. */
    bool setActiveScene(const SceneId& id);

    // ---- Patch (authoring mutations; called by commands) --------------------
    bool setInstancePosition(EntityId id, Vec2 position);
    bool setInstanceName(EntityId id, std::string name);
    bool setActiveSceneBackground(Vec4 color);
    bool createScene(const SceneId& id, const std::string& name);
    bool deleteScene(const SceneId& id);

private:
    SceneDef*         activeSceneMutable();
    SceneInstanceDef* mutableInstanceInActiveScene(EntityId id);
    void              markDirty();

    ProjectDoc doc_{};
    SceneId    activeSceneId_{};
    bool       dirty_        = false;
    uint64_t   revision_     = 0;
    uint32_t   replaceCount_ = 0;
};

} // namespace ArtCade::EditorNative

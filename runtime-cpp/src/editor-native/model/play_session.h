#pragma once

#include "core/types.h"

#include <vector>

namespace ArtCade::EditorNative {

class ProjectDocument;

// =============================================================================
// PlaySession — the runtime side of Play/Stop (prompt §8).
//
// Built FROM the authoring document by copying an explicit editor/play scene's instances
// into a mutable runtime list. The simulation mutates the session freely; the
// document is never touched. Stop is just destroying the session (RAII) and
// returning to the untouched document — no JSON reload, no scene sync, no
// readiness wait.
//
// In the full app this seed drives RuntimeEntityGateway::replaceProject once at
// Play start (Replace); live editing during Play is out of scope for the spike.
// =============================================================================
class PlaySession {
public:
    /** Snapshot the gameplay start scene from @p document into an independent session. */
    static PlaySession startProject(const ProjectDocument& document);

    /** Snapshot the editor-selected scene from @p document into an independent session. */
    static PlaySession startActiveScene(const ProjectDocument& document, const SceneId& sceneId);

    const SceneId& sceneId() const { return sceneId_; }

    std::vector<SceneInstanceDef>&       instances()       { return instances_; }
    const std::vector<SceneInstanceDef>& instances() const { return instances_; }

private:
    SceneId                       sceneId_;
    std::vector<SceneInstanceDef> instances_;
};

} // namespace ArtCade::EditorNative

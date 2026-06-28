#include "editor-native/model/play_session.h"

#include "editor-native/model/project_document.h"

namespace ArtCade::EditorNative {

PlaySession PlaySession::startProject(const ProjectDocument& document) {
    PlaySession session;
    session.sceneId_ = document.startSceneId();
    if (const SceneDef* scene = document.findScene(session.sceneId_)) {
        session.instances_ = scene->instances;   // deep copy — independent of the document
    }
    return session;
}

PlaySession PlaySession::startActiveScene(const ProjectDocument& document,
                                          const SceneId& sceneId) {
    PlaySession session;
    session.sceneId_ = sceneId;
    if (const SceneDef* scene = document.findScene(sceneId)) {
        session.instances_ = scene->instances;   // deep copy — independent of the document
    }
    return session;
}

} // namespace ArtCade::EditorNative

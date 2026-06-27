#include "editor-native/model/play_session.h"

#include "editor-native/model/project_document.h"

namespace ArtCade::EditorNative {

PlaySession PlaySession::fromDocument(const ProjectDocument& document) {
    PlaySession session;
    session.sceneId_ = document.activeSceneId();
    if (const SceneDef* scene = document.activeScene()) {
        session.instances_ = scene->instances;   // deep copy — independent of the document
    }
    return session;
}

} // namespace ArtCade::EditorNative

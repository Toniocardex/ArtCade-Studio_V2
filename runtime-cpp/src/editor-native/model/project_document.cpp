#include "editor-native/model/project_document.h"

#include <utility>

namespace ArtCade::EditorNative {

ProjectDocument::ProjectDocument(ProjectDoc doc)
    : doc_(std::move(doc)) {}

const SceneDef* ProjectDocument::findScene(const SceneId& id) const {
    const auto it = doc_.scenes.find(id);
    return it == doc_.scenes.end() ? nullptr : &it->second;
}

bool ProjectDocument::hasScene(const SceneId& id) const {
    return doc_.scenes.find(id) != doc_.scenes.end();
}

SceneDef* ProjectDocument::mutableScene(const SceneId& id) {
    const auto it = doc_.scenes.find(id);
    return it == doc_.scenes.end() ? nullptr : &it->second;
}

const SceneInstanceDef* ProjectDocument::findInstanceInScene(const SceneId& sceneId,
                                                             EntityId id) const {
    const SceneDef* scene = findScene(sceneId);
    if (!scene) return nullptr;
    for (const auto& instance : scene->instances) {
        if (instance.id == id) return &instance;
    }
    return nullptr;
}

SceneInstanceDef* ProjectDocument::mutableInstanceInScene(const SceneId& sceneId,
                                                          EntityId id) {
    SceneDef* scene = mutableScene(sceneId);
    if (!scene) return nullptr;
    for (auto& instance : scene->instances) {
        if (instance.id == id) return &instance;
    }
    return nullptr;
}

void ProjectDocument::markDirty() {
    ++revision_;
}

void ProjectDocument::replace(ProjectDoc doc) {
    doc_ = std::move(doc);
    ++replaceCount_;
    markDirty();
}

void ProjectDocument::replaceClean(ProjectDocument replacement) {
    doc_ = std::move(replacement.doc_);
    ++replaceCount_;
    ++revision_;
    savedRevision_ = revision_;
}

void ProjectDocument::markSaved() {
    savedRevision_ = revision_;
}

bool ProjectDocument::setInstancePosition(const SceneId& sceneId, EntityId id, Vec2 position) {
    SceneInstanceDef* instance = mutableInstanceInScene(sceneId, id);
    if (!instance) return false;
    instance->transform.position = position;
    markDirty();
    return true;
}

bool ProjectDocument::setInstanceName(const SceneId& sceneId, EntityId id, std::string name) {
    SceneInstanceDef* instance = mutableInstanceInScene(sceneId, id);
    if (!instance) return false;
    instance->instanceName = std::move(name);
    markDirty();
    return true;
}

bool ProjectDocument::setSceneBackground(const SceneId& sceneId, Vec4 color) {
    SceneDef* scene = mutableScene(sceneId);
    if (!scene) return false;
    scene->backgroundColor = color;
    markDirty();
    return true;
}

bool ProjectDocument::createScene(const SceneId& id, const std::string& name) {
    if (id.empty() || hasScene(id)) return false;
    SceneDef scene;
    scene.id = id;
    scene.name = name;
    doc_.scenes.emplace(id, std::move(scene));
    markDirty();
    return true;
}

bool ProjectDocument::deleteScene(const SceneId& id) {
    const auto it = doc_.scenes.find(id);
    if (it == doc_.scenes.end()) return false;
    doc_.scenes.erase(it);
    if (doc_.activeSceneId == id) {
        doc_.activeSceneId = doc_.scenes.empty() ? SceneId{} : doc_.scenes.begin()->first;
    }
    markDirty();
    return true;
}

} // namespace ArtCade::EditorNative

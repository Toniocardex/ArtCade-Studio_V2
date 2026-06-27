#include "editor-native/model/project_document.h"

#include <utility>

namespace ArtCade::EditorNative {

ProjectDocument::ProjectDocument(ProjectDoc doc)
    : doc_(std::move(doc)), activeSceneId_(doc_.activeSceneId) {
    // If the document declares no active scene, focus the first available one so
    // the viewport always has something to show.
    if (activeSceneId_.empty() && !doc_.scenes.empty()) {
        activeSceneId_ = doc_.scenes.begin()->first;
    }
}

const SceneDef* ProjectDocument::findScene(const SceneId& id) const {
    const auto it = doc_.scenes.find(id);
    return it == doc_.scenes.end() ? nullptr : &it->second;
}

bool ProjectDocument::hasScene(const SceneId& id) const {
    return doc_.scenes.find(id) != doc_.scenes.end();
}

const SceneDef* ProjectDocument::activeScene() const {
    return findScene(activeSceneId_);
}

SceneDef* ProjectDocument::activeSceneMutable() {
    const auto it = doc_.scenes.find(activeSceneId_);
    return it == doc_.scenes.end() ? nullptr : &it->second;
}

const SceneInstanceDef* ProjectDocument::findInstanceInActiveScene(EntityId id) const {
    const SceneDef* scene = activeScene();
    if (!scene) return nullptr;
    for (const auto& instance : scene->instances) {
        if (instance.id == id) return &instance;
    }
    return nullptr;
}

SceneInstanceDef* ProjectDocument::mutableInstanceInActiveScene(EntityId id) {
    SceneDef* scene = activeSceneMutable();
    if (!scene) return nullptr;
    for (auto& instance : scene->instances) {
        if (instance.id == id) return &instance;
    }
    return nullptr;
}

void ProjectDocument::markDirty() {
    dirty_ = true;
    ++revision_;
}

void ProjectDocument::replace(ProjectDoc doc) {
    doc_ = std::move(doc);
    activeSceneId_ = doc_.activeSceneId;
    if (activeSceneId_.empty() && !doc_.scenes.empty()) {
        activeSceneId_ = doc_.scenes.begin()->first;
    }
    ++replaceCount_;
    markDirty();
}

bool ProjectDocument::setActiveScene(const SceneId& id) {
    if (!hasScene(id)) return false;
    activeSceneId_ = id;   // editorial focus only — no Replace, no dirty
    return true;
}

bool ProjectDocument::setInstancePosition(EntityId id, Vec2 position) {
    SceneInstanceDef* instance = mutableInstanceInActiveScene(id);
    if (!instance) return false;
    instance->transform.position = position;
    markDirty();
    return true;
}

bool ProjectDocument::setInstanceName(EntityId id, std::string name) {
    SceneInstanceDef* instance = mutableInstanceInActiveScene(id);
    if (!instance) return false;
    instance->instanceName = std::move(name);
    markDirty();
    return true;
}

bool ProjectDocument::setActiveSceneBackground(Vec4 color) {
    SceneDef* scene = activeSceneMutable();
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
    if (activeSceneId_ == id) {
        activeSceneId_ = doc_.scenes.empty() ? SceneId{} : doc_.scenes.begin()->first;
    }
    markDirty();
    return true;
}

} // namespace ArtCade::EditorNative

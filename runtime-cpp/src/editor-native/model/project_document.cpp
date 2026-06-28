#include "editor-native/model/project_document.h"

#include <algorithm>
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

bool ProjectDocument::hasImageAsset(const AssetId& id) const {
    for (const ImageAssetDef& asset : doc_.imageAssets) {
        if (asset.assetId == id) return true;
    }
    return false;
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

bool ProjectDocument::setStartSceneId(const SceneId& sceneId) {
    // startSceneId is the persisted doc.activeSceneId (legacy field name).
    if (!sceneId.empty() && !hasScene(sceneId)) return false;
    doc_.activeSceneId = sceneId;
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

bool ProjectDocument::restoreScene(SceneDef scene, const SceneId& startSceneId) {
    if (scene.id.empty() || hasScene(scene.id)) return false;
    const SceneId id = scene.id;
    doc_.scenes.emplace(id, std::move(scene));
    doc_.activeSceneId = startSceneId;
    markDirty();
    return true;
}

bool ProjectDocument::createInstance(const SceneId& sceneId, SceneInstanceDef instance) {
    SceneDef* scene = mutableScene(sceneId);
    if (!scene) return false;
    for (const auto& existing : scene->instances) {
        if (existing.id == instance.id) return false; // id unique within scene
    }
    scene->instances.push_back(std::move(instance));
    markDirty();
    return true;
}

bool ProjectDocument::insertInstance(const SceneId& sceneId, std::size_t index,
                                     SceneInstanceDef instance) {
    SceneDef* scene = mutableScene(sceneId);
    if (!scene) return false;
    for (const auto& existing : scene->instances) {
        if (existing.id == instance.id) return false;
    }
    const std::size_t clamped = std::min(index, scene->instances.size());
    scene->instances.insert(scene->instances.begin() + static_cast<std::ptrdiff_t>(clamped),
                            std::move(instance));
    markDirty();
    return true;
}

bool ProjectDocument::deleteInstance(const SceneId& sceneId, EntityId id) {
    SceneDef* scene = mutableScene(sceneId);
    if (!scene) return false;
    for (auto it = scene->instances.begin(); it != scene->instances.end(); ++it) {
        if (it->id == id) {
            scene->instances.erase(it);
            markDirty();
            return true;
        }
    }
    return false;
}

bool ProjectDocument::addSpriteRenderer(const SceneId& sceneId, EntityId id,
                                        SpriteRendererComponent component) {
    SceneInstanceDef* instance = mutableInstanceInScene(sceneId, id);
    if (!instance || instance->spriteRenderer.has_value()) return false;
    instance->spriteRenderer = std::move(component);
    markDirty();
    return true;
}

bool ProjectDocument::removeSpriteRenderer(const SceneId& sceneId, EntityId id) {
    SceneInstanceDef* instance = mutableInstanceInScene(sceneId, id);
    if (!instance || !instance->spriteRenderer.has_value()) return false;
    instance->spriteRenderer.reset();
    markDirty();
    return true;
}

bool ProjectDocument::setSpriteRendererVisible(const SceneId& sceneId, EntityId id, bool visible) {
    SceneInstanceDef* instance = mutableInstanceInScene(sceneId, id);
    if (!instance || !instance->spriteRenderer.has_value()) return false;
    instance->spriteRenderer->visible = visible;
    markDirty();
    return true;
}

bool ProjectDocument::setSpriteRendererAsset(const SceneId& sceneId, EntityId id, AssetId assetId) {
    SceneInstanceDef* instance = mutableInstanceInScene(sceneId, id);
    if (!instance || !instance->spriteRenderer.has_value()) return false;
    instance->spriteRenderer->imageAssetId = std::move(assetId);
    markDirty();
    return true;
}

bool ProjectDocument::addBoxCollider(const std::string& objectTypeId,
                                     BoxCollider2DComponent component) {
    auto it = doc_.objectTypes.find(objectTypeId);
    if (it == doc_.objectTypes.end() || it->second.boxCollider2D.has_value()) return false;
    it->second.boxCollider2D = component;
    markDirty();
    return true;
}

bool ProjectDocument::removeBoxCollider(const std::string& objectTypeId) {
    auto it = doc_.objectTypes.find(objectTypeId);
    if (it == doc_.objectTypes.end() || !it->second.boxCollider2D.has_value()) return false;
    it->second.boxCollider2D.reset();
    markDirty();
    return true;
}

bool ProjectDocument::setBoxColliderOffset(const std::string& objectTypeId, Vec2 offset) {
    auto it = doc_.objectTypes.find(objectTypeId);
    if (it == doc_.objectTypes.end() || !it->second.boxCollider2D.has_value()) return false;
    it->second.boxCollider2D->offset = offset;
    markDirty();
    return true;
}

bool ProjectDocument::setBoxColliderSize(const std::string& objectTypeId, Vec2 size) {
    auto it = doc_.objectTypes.find(objectTypeId);
    if (it == doc_.objectTypes.end() || !it->second.boxCollider2D.has_value()) return false;
    it->second.boxCollider2D->size = size;
    markDirty();
    return true;
}

bool ProjectDocument::setBoxColliderEnabled(const std::string& objectTypeId, bool enabled) {
    auto it = doc_.objectTypes.find(objectTypeId);
    if (it == doc_.objectTypes.end() || !it->second.boxCollider2D.has_value()) return false;
    it->second.boxCollider2D->enabled = enabled;
    markDirty();
    return true;
}

bool ProjectDocument::setBoxColliderTrigger(const std::string& objectTypeId, bool isTrigger) {
    auto it = doc_.objectTypes.find(objectTypeId);
    if (it == doc_.objectTypes.end() || !it->second.boxCollider2D.has_value()) return false;
    it->second.boxCollider2D->isTrigger = isTrigger;
    markDirty();
    return true;
}

} // namespace ArtCade::EditorNative

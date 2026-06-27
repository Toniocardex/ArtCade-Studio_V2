#include "../include/scene-mutation-service.h"

#include "../include/scene-manager.h"

namespace ArtCade::Modules {

namespace {

bool vec2_positive(const Vec2& v) {
    return v.x > 0.f && v.y > 0.f;
}

bool vec2_equal(const Vec2& a, const Vec2& b) {
    return a.x == b.x && a.y == b.y;
}

bool vec4_equal(const Vec4& a, const Vec4& b) {
    return a.r == b.r && a.g == b.g && a.b == b.b && a.a == b.a;
}

SceneInvalidation invalidations_for_patch(const ScenePatch& patch) {
    SceneInvalidation flags = SceneInvalidation::None;
    if (patch.hasWorldSize || patch.hasViewportSize) {
        flags |= SceneInvalidation::Geometry;
        flags |= SceneInvalidation::Presentation;
        flags |= SceneInvalidation::TilemapGeometry;
        flags |= SceneInvalidation::Collision;
        flags |= SceneInvalidation::RenderData;
    }
    if (patch.hasBackground || patch.hasName || patch.hasLayerSettings)
        flags |= SceneInvalidation::Metadata;
    if (patch.hasBackground || patch.hasLayerSettings)
        flags |= SceneInvalidation::RenderData;
    return flags;
}

} // namespace

SceneMutationService::SceneMutationService(SceneManager& scenes)
    : scenes_(scenes) {}

uint64_t SceneMutationService::bump_revision() {
    return ++revision_;
}

void SceneMutationService::begin_batch() {
    batchOpen_ = true;
    batchChanged_ = false;
    batchInvalidations_ = SceneInvalidation::None;
    batchSceneId_.clear();
}

SceneMutationResult SceneMutationService::commit_batch() {
    SceneMutationResult result{};
    batchOpen_ = false;

    if (!batchChanged_ && batchInvalidations_ == SceneInvalidation::None)
        return result;

    result.changed = true;
    result.sceneId = batchSceneId_;
    result.invalidations = batchInvalidations_;
    result.sceneRevision = bump_revision();

    batchChanged_ = false;
    batchInvalidations_ = SceneInvalidation::None;
    batchSceneId_.clear();
    return result;
}

SceneMutationResult SceneMutationService::apply(
    const SceneId& sceneId,
    const ScenePatch& patch,
    SceneMutationOrigin /*origin*/)
{
    SceneMutationResult result{};
    result.sceneId = sceneId;

    SceneDef* scene = scenes_.getSceneMutable(sceneId);
    if (!scene) {
        result.error = SceneMutationError::SceneNotFound;
        return result;
    }

    if (patch.hasWorldSize && !vec2_positive(patch.worldSize)) {
        result.error = SceneMutationError::InvalidPatch;
        return result;
    }
    if (patch.hasViewportSize && !vec2_positive(patch.viewportSize)) {
        result.error = SceneMutationError::InvalidPatch;
        return result;
    }

    bool changed = false;

    if (patch.hasWorldSize && !vec2_equal(scene->worldSize, patch.worldSize)) {
        scene->worldSize = patch.worldSize;
        changed = true;
    }
    if (patch.hasViewportSize && !vec2_equal(scene->viewportSize, patch.viewportSize)) {
        scene->viewportSize = patch.viewportSize;
        changed = true;
    }
    if (patch.hasBackground && !vec4_equal(scene->backgroundColor, patch.backgroundColor)) {
        scene->backgroundColor = patch.backgroundColor;
        changed = true;
    }
    if (patch.hasName && scene->name != patch.name) {
        scene->name = patch.name;
        changed = true;
    }
    if (patch.hasLayerSettings) {
        scene->layerSettings = patch.layerSettings;
        changed = true;
    }

    if (!changed) {
        result.sceneRevision = revision_;
        return result;
    }

    const SceneInvalidation patchFlags = invalidations_for_patch(patch);

    if (batchOpen_) {
        batchChanged_ = true;
        batchSceneId_ = sceneId;
        batchInvalidations_ |= patchFlags;
        result.changed = true;
        result.sceneRevision = revision_;
        result.invalidations = patchFlags;
        return result;
    }

    result.changed = true;
    result.sceneRevision = bump_revision();
    result.invalidations = patchFlags;
    return result;
}

} // namespace ArtCade::Modules

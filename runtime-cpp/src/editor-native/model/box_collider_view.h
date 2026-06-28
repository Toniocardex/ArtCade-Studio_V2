#pragma once

#include "core/types.h"

#include <vector>

namespace ArtCade::EditorNative {

class ProjectDocument;

struct WorldRect {
    float x = 0.f;
    float y = 0.f;
    float width = 0.f;
    float height = 0.f;
};

struct SceneFrameCollider {
    EntityId entityId = INVALID_ENTITY;
    WorldRect worldBounds;
    bool enabled = false;
    bool isTrigger = false;
    bool selected = false;
};

std::vector<SceneFrameCollider> collectBoxColliderBounds(const ProjectDocument& document,
                                                         const SceneId& sceneId,
                                                         EntityId selectedEntity);

} // namespace ArtCade::EditorNative

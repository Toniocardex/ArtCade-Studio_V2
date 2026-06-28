#pragma once

#include "core/types.h"

#include <utility>

namespace ArtCade::EditorNative {

enum class DomainChangeKind {
    None,
    ProjectReplaced,
    SceneAdded,
    SceneRemoved,
    SceneChanged,
    EntityAdded,
    EntityRemoved,
    EntityChanged,
    AssetChanged,
};

struct DomainChange {
    DomainChangeKind kind = DomainChangeKind::None;
    SceneId          sceneId;
    EntityId         entityId = INVALID_ENTITY;

    static DomainChange none() { return {}; }
    static DomainChange sceneAdded(SceneId scene) {
        DomainChange change;
        change.kind = DomainChangeKind::SceneAdded;
        change.sceneId = std::move(scene);
        return change;
    }
    static DomainChange projectReplaced() {
        DomainChange change;
        change.kind = DomainChangeKind::ProjectReplaced;
        return change;
    }
    static DomainChange sceneRemoved(SceneId scene) {
        DomainChange change;
        change.kind = DomainChangeKind::SceneRemoved;
        change.sceneId = std::move(scene);
        return change;
    }
    static DomainChange sceneChanged(SceneId scene) {
        DomainChange change;
        change.kind = DomainChangeKind::SceneChanged;
        change.sceneId = std::move(scene);
        return change;
    }
    static DomainChange entityChanged(SceneId scene, EntityId entity) {
        DomainChange change;
        change.kind = DomainChangeKind::EntityChanged;
        change.sceneId = std::move(scene);
        change.entityId = entity;
        return change;
    }
    static DomainChange entityAdded(SceneId scene, EntityId entity) {
        DomainChange change;
        change.kind = DomainChangeKind::EntityAdded;
        change.sceneId = std::move(scene);
        change.entityId = entity;
        return change;
    }
    static DomainChange entityRemoved(SceneId scene, EntityId entity) {
        DomainChange change;
        change.kind = DomainChangeKind::EntityRemoved;
        change.sceneId = std::move(scene);
        change.entityId = entity;
        return change;
    }
};

} // namespace ArtCade::EditorNative

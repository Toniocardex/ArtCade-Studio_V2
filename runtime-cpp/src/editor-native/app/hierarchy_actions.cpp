#include "editor-native/app/hierarchy_actions.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/commands/entity_commands.h"
#include "editor-native/commands/scene_commands.h"
#include "editor-native/model/project_document.h"

#include <string>

namespace ArtCade::EditorNative {

namespace {

// Object type a freshly placed instance references. The Hierarchy "Add Entity"
// gate does not yet pick a type, so prefer a real one (lexicographically first
// for determinism) and fall back to a placeholder when the catalog is empty. A
// proper object-type picker is Inspector/asset work.
std::string defaultObjectTypeId(const ProjectDocument& document) {
    const std::string* best = nullptr;
    for (const auto& [id, def] : document.data().objectTypes) {
        (void)def;
        if (!best || id < *best) best = &id;
    }
    return best ? *best : std::string("Entity");
}

} // namespace

EntityId nextAvailableEntityId(const ProjectDocument& document, const SceneId& sceneId) {
    EntityId maxId = 0;
    if (const SceneDef* scene = document.findScene(sceneId)) {
        for (const SceneInstanceDef& inst : scene->instances) {
            if (inst.id > maxId) maxId = inst.id;
        }
    }
    return maxId + 1;   // >= 1, so never INVALID_ENTITY
}

SceneId makeUniqueSceneId(const ProjectDocument& document) {
    for (int n = 1;; ++n) {
        SceneId candidate = "scene-" + std::to_string(n);
        if (!document.hasScene(candidate)) return candidate;
    }
}

EditorOperationResult addScene(EditorCoordinator& coordinator) {
    const SceneId id = makeUniqueSceneId(coordinator.document());
    // Display name mirrors the id's ordinal: "scene-3" -> "Scene 3".
    const std::string name = "Scene " + id.substr(std::string("scene-").size());
    return coordinator.execute(CreateSceneCommand{id, name});
}

EditorOperationResult deleteScene(EditorCoordinator& coordinator, const SceneId& sceneId) {
    if (!coordinator.document().hasScene(sceneId)) {
        return EditorOperationResult::failure("No scene to delete");
    }
    return coordinator.execute(DeleteSceneCommand{sceneId});
}

EditorOperationResult addEntity(EditorCoordinator& coordinator) {
    const SceneId& sceneId = coordinator.state().activeSceneId;
    if (sceneId.empty() || !coordinator.document().hasScene(sceneId)) {
        return EditorOperationResult::failure("No active scene to add an entity to");
    }
    const EntityId id = nextAvailableEntityId(coordinator.document(), sceneId);
    const std::string type = defaultObjectTypeId(coordinator.document());
    return coordinator.execute(
        CreateEntityCommand{sceneId, id, type, "Entity " + std::to_string(id)});
}

EditorOperationResult deleteSelectedEntity(EditorCoordinator& coordinator) {
    const EditorState& state = coordinator.state();
    if (state.activeSceneId.empty() || !state.selection.hasEntity()) {
        return EditorOperationResult::failure("No selected entity to delete");
    }
    return coordinator.execute(
        DeleteEntityCommand{state.activeSceneId, state.selection.primaryEntity});
}

} // namespace ArtCade::EditorNative

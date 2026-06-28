#include "editor-native/model/project_io.h"

#include <nlohmann/json.hpp>

#include <unordered_set>
#include <utility>

namespace ArtCade::EditorNative {

namespace {

constexpr int kCurrentSchemaVersion = 1;

nlohmann::json vec2ToJson(const Vec2& v) {
    return nlohmann::json{{"x", v.x}, {"y", v.y}};
}

std::string readString(const nlohmann::json& object, const char* camel,
                       const char* snake = nullptr,
                       const std::string& fallback = {}) {
    if (object.contains(camel) && object[camel].is_string()) {
        return object[camel].get<std::string>();
    }
    if (snake && object.contains(snake) && object[snake].is_string()) {
        return object[snake].get<std::string>();
    }
    return fallback;
}

float readFloat(const nlohmann::json& object, const char* key, float fallback) {
    if (object.contains(key) && object[key].is_number()) {
        return object[key].get<float>();
    }
    return fallback;
}

Vec2 readVec2(const nlohmann::json& value, Vec2 fallback = {}) {
    if (!value.is_object()) return fallback;
    return Vec2{
        readFloat(value, "x", fallback.x),
        readFloat(value, "y", fallback.y),
    };
}

Vec4 readVec4(const nlohmann::json& value, Vec4 fallback = {}) {
    if (!value.is_object()) return fallback;
    return Vec4{
        readFloat(value, "r", fallback.r),
        readFloat(value, "g", fallback.g),
        readFloat(value, "b", fallback.b),
        readFloat(value, "a", fallback.a),
    };
}

Transform readTransform(const nlohmann::json& value) {
    Transform transform;
    if (!value.is_object()) return transform;
    if (value.contains("position")) transform.position = readVec2(value["position"]);
    if (value.contains("scale")) transform.scale = readVec2(value["scale"], {1.f, 1.f});
    transform.rotation = readFloat(value, "rotation", 0.f);
    return transform;
}

bool readInstance(const nlohmann::json& value, SceneInstanceDef& out) {
    if (!value.is_object()) return false;
    out = SceneInstanceDef{};
    out.id = value.value("id", 0u);
    out.objectTypeId = readString(value, "objectTypeId", "object_type_id");
    out.instanceName = readString(value, "instanceName", "instance_name");
    if (value.contains("transform")) out.transform = readTransform(value["transform"]);
    if (value.contains("visible") && value["visible"].is_boolean()) {
        out.visible = value["visible"].get<bool>();
    }
    out.layerId = readString(value, "layerId", "layer_id");
    return out.id != INVALID_ENTITY && !out.objectTypeId.empty();
}

SceneDef readScene(const nlohmann::json& value, const SceneId& fallbackId) {
    SceneDef scene;
    if (!value.is_object()) return scene;
    scene.id = readString(value, "id", nullptr, fallbackId);
    scene.name = readString(value, "name", nullptr, scene.id);
    if (value.contains("worldSize")) {
        scene.worldSize = readVec2(value["worldSize"], scene.worldSize);
    }
    if (value.contains("viewportSize")) {
        scene.viewportSize = readVec2(value["viewportSize"], scene.viewportSize);
    }
    if (value.contains("backgroundColor")) {
        scene.backgroundColor = readVec4(value["backgroundColor"], scene.backgroundColor);
    }
    if (value.contains("instances") && value["instances"].is_array()) {
        for (const auto& item : value["instances"]) {
            SceneInstanceDef instance;
            if (readInstance(item, instance)) scene.instances.push_back(std::move(instance));
        }
    }
    return scene;
}

SceneId duplicateKeyFor(const SceneId& id, std::size_t index) {
    return id + "#duplicate-" + std::to_string(index);
}

void insertReadScene(ProjectDoc& out, SceneDef scene) {
    SceneId key = scene.id;
    if (out.scenes.find(key) != out.scenes.end()) {
        key = duplicateKeyFor(scene.id, out.scenes.size());
    }
    out.scenes.emplace(std::move(key), std::move(scene));
}

void readScenes(const nlohmann::json& root, ProjectDoc& out) {
    if (!root.contains("scenes")) return;
    const auto& scenes = root["scenes"];
    if (scenes.is_array()) {
        for (const auto& item : scenes) {
            SceneDef scene = readScene(item, "scene_" + std::to_string(out.scenes.size()));
            insertReadScene(out, std::move(scene));
        }
    } else if (scenes.is_object()) {
        for (const auto& [key, value] : scenes.items()) {
            SceneDef scene = readScene(value, key);
            insertReadScene(out, std::move(scene));
        }
    }
}

nlohmann::json vec4ToJson(const Vec4& v) {
    return nlohmann::json{{"r", v.r}, {"g", v.g}, {"b", v.b}, {"a", v.a}};
}

nlohmann::json transformToJson(const Transform& t) {
    return nlohmann::json{
        {"position", vec2ToJson(t.position)},
        {"scale", vec2ToJson(t.scale)},
        {"rotation", t.rotation},
    };
}

nlohmann::json instanceToJson(const SceneInstanceDef& instance) {
    return nlohmann::json{
        {"id", instance.id},
        {"objectTypeId", instance.objectTypeId},
        {"instanceName", instance.instanceName},
        {"transform", transformToJson(instance.transform)},
        {"visible", instance.visible},
        {"layerId", instance.layerId},
    };
}

nlohmann::json sceneToJson(const SceneDef& scene) {
    nlohmann::json instances = nlohmann::json::array();
    for (const SceneInstanceDef& instance : scene.instances) {
        instances.push_back(instanceToJson(instance));
    }

    return nlohmann::json{
        {"id", scene.id},
        {"name", scene.name},
        {"worldSize", vec2ToJson(scene.worldSize)},
        {"viewportSize", vec2ToJson(scene.viewportSize)},
        {"backgroundColor", vec4ToJson(scene.backgroundColor)},
        {"instances", std::move(instances)},
    };
}

} // namespace

DeserializeResult ProjectSerializer::deserialize(std::string_view source) {
    const nlohmann::json root =
        nlohmann::json::parse(source.begin(), source.end(), nullptr, false);
    if (root.is_discarded() || !root.is_object()) {
        return DeserializeResult::failure("Project JSON is malformed");
    }

    ProjectDoc doc;
    doc.projectName = readString(root, "projectName", "project_name", "Untitled");
    doc.version = readString(root, "version", nullptr, "2.0.0");
    doc.licenseTier = readString(root, "licenseTier", "license_tier", "free");
    doc.targetFPS = readFloat(root, "targetFPS", 60.f);
    doc.activeSceneId = readString(root, "activeSceneId", "active_scene_id");
    doc.mainScriptPath = readString(root, "mainScriptPath", "main_script_path",
                                    "scripts/main.luac");
    doc.formatVersion = root.value("formatVersion", root.value("format_version", 0));
    readScenes(root, doc);

    return DeserializeResult::success(ProjectDocument{std::move(doc)});
}

SerializeResult ProjectSerializer::serialize(const ProjectDocument& document) {
    const ProjectDoc& doc = document.data();
    nlohmann::json scenes = nlohmann::json::array();
    for (const auto& [_, scene] : doc.scenes) {
        scenes.push_back(sceneToJson(scene));
    }

    nlohmann::json root{
        {"schemaVersion", kCurrentSchemaVersion},
        {"formatVersion", kCurrentSchemaVersion},
        {"projectName", doc.projectName},
        {"version", doc.version},
        {"activeSceneId", doc.activeSceneId},
        {"targetFPS", doc.targetFPS},
        {"mainScriptPath", doc.mainScriptPath},
        {"scenes", std::move(scenes)},
    };
    return SerializeResult::success(root.dump(2));
}

DeserializeResult ProjectMigration::migrate(ProjectDocument document) {
    const int version = document.data().formatVersion;
    if (version < 0 || version > kCurrentSchemaVersion) {
        return DeserializeResult::failure("Unsupported project schema version");
    }
    return DeserializeResult::success(std::move(document));
}

DeserializeResult ProjectValidator::validate(ProjectDocument document) {
    const ProjectDoc& data = document.data();

    std::unordered_set<SceneId> sceneIds;
    for (const auto& [id, scene] : data.scenes) {
        if (id.empty() || scene.id.empty()) {
            return DeserializeResult::failure("Scene id cannot be empty");
        }
        if (!sceneIds.insert(scene.id).second) {
            return DeserializeResult::failure("Duplicate scene id");
        }
        if (id != scene.id) {
            return DeserializeResult::failure("Scene map key does not match scene id");
        }

        std::unordered_set<EntityId> entityIds;
        for (const SceneInstanceDef& instance : scene.instances) {
            if (instance.id == INVALID_ENTITY) {
                return DeserializeResult::failure("Entity id cannot be zero");
            }
            if (!entityIds.insert(instance.id).second) {
                return DeserializeResult::failure("Duplicate entity id in scene");
            }
            if (instance.objectTypeId.empty()) {
                return DeserializeResult::failure("Entity objectTypeId cannot be empty");
            }
        }
    }

    if (!data.scenes.empty()) {
        if (data.activeSceneId.empty()) {
            return DeserializeResult::failure("startSceneId cannot be empty when scenes exist");
        }
        if (data.scenes.find(data.activeSceneId) == data.scenes.end()) {
            return DeserializeResult::failure("startSceneId references a missing scene");
        }
    }

    return DeserializeResult::success(std::move(document));
}

} // namespace ArtCade::EditorNative

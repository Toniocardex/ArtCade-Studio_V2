#include "scene-json.h"

#include "json-primitives.h"

namespace ArtCade::ProjectJson {

namespace {

constexpr Vec2 kDefaultSceneSize{800.f, 600.f};

void read_entity_id_list(const nlohmann::json& sceneJson, std::vector<EntityId>& out) {
    const nlohmann::json* eids = nullptr;
    if (sceneJson.contains("entityIds"))
        eids = &sceneJson["entityIds"];
    else if (sceneJson.contains("entity_ids"))
        eids = &sceneJson["entity_ids"];
    if (eids == nullptr || !eids->is_array())
        return;
    out.clear();
    out.reserve(eids->size());
    for (const auto& id : *eids)
        out.push_back(id.get<EntityId>());
}

} // namespace

bool read_scene_instance(const nlohmann::json& instanceJson, SceneInstanceDef& out) {
    if (!instanceJson.is_object())
        return false;

    out = SceneInstanceDef{};
    out.id = instanceJson.value("id", 0u);
    out.objectTypeId = read_string_any(instanceJson, "objectTypeId", "object_type_id");
    out.instanceName = read_string_any(instanceJson, "instanceName", "instance_name");
    if (instanceJson.contains("transform"))
        out.transform = read_transform(instanceJson["transform"]);
    if (instanceJson.contains("visible") && instanceJson["visible"].is_boolean())
        out.visible = instanceJson["visible"].get<bool>();
    if (instanceJson.contains("localVariableOverrides")
        && instanceJson["localVariableOverrides"].is_object()) {
        for (auto& [key, value] : instanceJson["localVariableOverrides"].items()) {
            if (value.is_number()) out.localVariableOverrides[key] = value.get<double>();
            else if (value.is_boolean()) out.localVariableOverrides[key] = value.get<bool>();
            else if (value.is_string()) out.localVariableOverrides[key] = value.get<std::string>();
        }
    }

    return out.id != 0 && !out.objectTypeId.empty();
}

void read_tilemap(const nlohmann::json& sceneJson, TilemapData& out) {
    if (!sceneJson.contains("tilemap") || !sceneJson["tilemap"].is_object())
        return;

    const auto& tm = sceneJson["tilemap"];
    TilemapData tilemap;
    if (tm.contains("tileSize"))
        tilemap.tileSize = tm["tileSize"].get<float>();
    else if (tm.contains("tile_size"))
        tilemap.tileSize = tm["tile_size"].get<float>();
    tilemap.cols = tm.value("cols", 0);
    tilemap.rows = tm.value("rows", 0);
    if (tm.contains("data") && tm["data"].is_array())
        tilemap.data = tm["data"].get<std::vector<int>>();
    tilemap.tilesetAssetId = read_string_any(tm, "tilesetAssetId", "tileset_asset_id");
    out = std::move(tilemap);
}

void read_scene_def(const nlohmann::json& sceneJson,
                    const SceneId& fallbackId,
                    SceneDef& out) {
    out = SceneDef{};
    out.id   = sceneJson.value("id", fallbackId);
    out.name = sceneJson.value("name", fallbackId);

    if (sceneJson.contains("worldSize"))
        out.worldSize = read_vec2(sceneJson["worldSize"], kDefaultSceneSize);
    else if (sceneJson.contains("world_size"))
        out.worldSize = read_vec2(sceneJson["world_size"], kDefaultSceneSize);

    if (sceneJson.contains("viewportSize"))
        out.viewportSize = read_vec2(sceneJson["viewportSize"], kDefaultSceneSize);
    else if (sceneJson.contains("viewport_size"))
        out.viewportSize = read_vec2(sceneJson["viewport_size"], kDefaultSceneSize);

    if (sceneJson.contains("backgroundColor"))
        out.backgroundColor = read_vec4(sceneJson["backgroundColor"]);
    else if (sceneJson.contains("background_color"))
        out.backgroundColor = read_vec4(sceneJson["background_color"]);

    read_entity_id_list(sceneJson, out.entityIds);

    if (sceneJson.contains("instances") && sceneJson["instances"].is_array()) {
        for (const auto& item : sceneJson["instances"]) {
            SceneInstanceDef inst;
            if (read_scene_instance(item, inst))
                out.instances.push_back(std::move(inst));
        }
    }

    read_tilemap(sceneJson, out.tilemap);
}

void read_scenes_map(const nlohmann::json& doc,
                     std::unordered_map<SceneId, SceneDef>& out) {
    out.clear();
    if (!doc.contains("scenes"))
        return;

    const auto& scenesJson = doc["scenes"];
    if (scenesJson.is_array()) {
        for (const auto& item : scenesJson) {
            SceneDef scene;
            read_scene_def(item, "scene_" + std::to_string(out.size()), scene);
            out[scene.id] = std::move(scene);
        }
    } else if (scenesJson.is_object()) {
        for (auto& [key, val] : scenesJson.items()) {
            SceneDef scene;
            read_scene_def(val, key, scene);
            out[scene.id] = std::move(scene);
        }
    }
}

} // namespace ArtCade::ProjectJson

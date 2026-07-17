#include "scene-json.h"

#include "json-primitives.h"
#include "project-defaults.h"
#include "project-meta-json.h"

namespace ArtCade::ProjectJson {

namespace {

constexpr Vec2 kDefaultWorldSize{
    ProjectDefaults::kSceneWorldWidth,
    ProjectDefaults::kSceneWorldHeight,
};
constexpr Vec2 kDefaultViewportSize{
    ProjectDefaults::kSceneViewportWidth,
    ProjectDefaults::kSceneViewportHeight,
};

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
    out.layerId = instanceJson.value("layerId", std::string{});
    if (instanceJson.contains("spriteRendererOverride")
        && instanceJson["spriteRendererOverride"].is_object()) {
        const auto& value = instanceJson["spriteRendererOverride"];
        SpriteRendererOverride delta;
        if (value.contains("imageAssetId"))
            delta.imageAssetId = value["imageAssetId"].get<std::string>();
        if (value.contains("animationAssetId"))
            delta.animationAssetId = value["animationAssetId"].get<std::string>();
        if (value.contains("visible")) delta.visible = value["visible"].get<bool>();
        if (value.contains("capabilityEnabled"))
            delta.capabilityEnabled = value["capabilityEnabled"].get<bool>();
        out.spriteRendererOverride = std::move(delta);
    }
    if (instanceJson.contains("spriteAnimatorOverride")
        && instanceJson["spriteAnimatorOverride"].is_object()) {
        const auto& value = instanceJson["spriteAnimatorOverride"];
        SpriteAnimatorOverride delta;
        if (value.contains("initialClipId"))
            delta.initialClipId = value["initialClipId"].get<std::string>();
        if (value.contains("autoPlay")) delta.autoPlay = value["autoPlay"].get<bool>();
        if (value.contains("playbackSpeed"))
            delta.playbackSpeed = value["playbackSpeed"].get<float>();
        if (value.contains("capabilityEnabled"))
            delta.capabilityEnabled = value["capabilityEnabled"].get<bool>();
        out.spriteAnimatorOverride = std::move(delta);
    }
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

void read_tilemap_object(const nlohmann::json& tmJson, TilemapData& out) {
    if (!tmJson.is_object())
        return;

    TilemapData tilemap;
    if (tmJson.contains("tileSize"))
        tilemap.tileSize = tmJson["tileSize"].get<float>();
    else if (tmJson.contains("tile_size"))
        tilemap.tileSize = tmJson["tile_size"].get<float>();
    tilemap.cols = tmJson.value("cols", 0);
    tilemap.rows = tmJson.value("rows", 0);
    if (tmJson.contains("data") && tmJson["data"].is_array())
        tilemap.data = tmJson["data"].get<std::vector<int>>();
    tilemap.tilesetAssetId = read_string_any(tmJson, "tilesetAssetId", "tileset_asset_id");
    tilemap.defaultTilesetAssetId =
        read_string_any(tmJson, "defaultTilesetAssetId", "default_tileset_asset_id");

    if (tmJson.contains("sourceIndices") && tmJson["sourceIndices"].is_array())
        tilemap.sourceIndices = tmJson["sourceIndices"].get<std::vector<int>>();
    else if (tmJson.contains("source_indices") && tmJson["source_indices"].is_array())
        tilemap.sourceIndices = tmJson["source_indices"].get<std::vector<int>>();

    const nlohmann::json* sourcesJson = nullptr;
    if (tmJson.contains("tilesetSources") && tmJson["tilesetSources"].is_array())
        sourcesJson = &tmJson["tilesetSources"];
    else if (tmJson.contains("tileset_sources") && tmJson["tileset_sources"].is_array())
        sourcesJson = &tmJson["tileset_sources"];
    if (sourcesJson) {
        for (const auto& item : *sourcesJson) {
            if (!item.is_object()) continue;
            TilesetSourceRef ref;
            ref.tilesetAssetId =
                read_string_any(item, "tilesetAssetId", "tileset_asset_id");
            if (!ref.tilesetAssetId.empty())
                tilemap.tilesetSources.push_back(std::move(ref));
        }
    }

    // Legacy migration: single tilesetAssetId → source 1 for painted cells.
    if (tilemap.tilesetSources.empty() && !tilemap.tilesetAssetId.empty()) {
        tilemap.tilesetSources.push_back({ tilemap.tilesetAssetId });
    }
    const int cellCount = tilemap.cols * tilemap.rows;
    if (tilemap.sourceIndices.size() != static_cast<size_t>(cellCount) && cellCount > 0) {
        tilemap.sourceIndices.assign(static_cast<size_t>(cellCount), 0);
        const int legacySource = tilemap.tilesetSources.empty() ? 0 : 1;
        for (int i = 0; i < cellCount && i < static_cast<int>(tilemap.data.size()); ++i) {
            if (tilemap.data[static_cast<size_t>(i)] != 0)
                tilemap.sourceIndices[static_cast<size_t>(i)] = legacySource;
        }
    }

    out = std::move(tilemap);
}

void read_tilemap(const nlohmann::json& sceneJson, TilemapData& out) {
    if (!sceneJson.contains("tilemap") || !sceneJson["tilemap"].is_object())
        return;
    read_tilemap_object(sceneJson["tilemap"], out);
}

void read_tilemap_layers(const nlohmann::json& sceneJson,
                         std::unordered_map<std::string, TilemapData>& out) {
    const nlohmann::json* layersJson = nullptr;
    if (sceneJson.contains("tilemapLayers") && sceneJson["tilemapLayers"].is_object())
        layersJson = &sceneJson["tilemapLayers"];
    else if (sceneJson.contains("tilemap_layers") && sceneJson["tilemap_layers"].is_object())
        layersJson = &sceneJson["tilemap_layers"];
    if (!layersJson)
        return;

    out.clear();
    for (auto& [layerId, layerJson] : layersJson->items()) {
        TilemapData layer;
        read_tilemap_object(layerJson, layer);
        if (layer.cols > 0 && layer.rows > 0)
            out.emplace(layerId, std::move(layer));
    }
}

void read_scene_layer_settings(const nlohmann::json& sceneJson,
                               std::unordered_map<std::string, SceneLayerSettings>& out) {
    const nlohmann::json* lsJson = nullptr;
    if (sceneJson.contains("layerSettings") && sceneJson["layerSettings"].is_object())
        lsJson = &sceneJson["layerSettings"];
    else if (sceneJson.contains("layer_settings") && sceneJson["layer_settings"].is_object())
        lsJson = &sceneJson["layer_settings"];
    if (!lsJson)
        return;

    out.clear();
    for (auto& [layerId, item] : lsJson->items()) {
        if (!item.is_object())
            continue;
        SceneLayerSettings s;
        s.visible = item.value("visible", true);
        s.opacity = item.value("opacity", 1.f);
        if (s.opacity < 0.f) s.opacity = 0.f;
        if (s.opacity > 1.f) s.opacity = 1.f;
        if (item.contains("parallax") && item["parallax"].is_object()) {
            const auto& p = item["parallax"];
            s.parallax.x = p.value("x", 1.f);
            s.parallax.y = p.value("y", 1.f);
        }
        if (item.contains("background") && item["background"].is_object()) {
            const auto& b = item["background"];
            s.background.imageId = read_string_any(b, "imageId", "image_id");
            s.background.tileX   = b.value("tileX", b.value("tile_x", true));
            s.background.tileY   = b.value("tileY", b.value("tile_y", true));
            s.background.scrollX = b.value("scrollX", b.value("scroll_x", 0.f));
            s.background.scrollY = b.value("scrollY", b.value("scroll_y", 0.f));
        }
        out.emplace(layerId, std::move(s));
    }
}

void read_scene_def(const nlohmann::json& sceneJson,
                    const SceneId& fallbackId,
                    SceneDef& out) {
    out = SceneDef{};
    out.id   = sceneJson.value("id", fallbackId);
    out.name = sceneJson.value("name", fallbackId);

    if (sceneJson.contains("worldSize"))
        out.worldSize = read_vec2(sceneJson["worldSize"], kDefaultWorldSize);
    else if (sceneJson.contains("world_size"))
        out.worldSize = read_vec2(sceneJson["world_size"], kDefaultWorldSize);

    if (sceneJson.contains("viewportSize"))
        out.viewportSize = read_vec2(sceneJson["viewportSize"], kDefaultViewportSize);
    else if (sceneJson.contains("viewport_size"))
        out.viewportSize = read_vec2(sceneJson["viewport_size"], kDefaultViewportSize);

    if (sceneJson.contains("cameraStart"))
        out.cameraStart = read_vec2(sceneJson["cameraStart"], { 0.f, 0.f });
    else if (sceneJson.contains("camera_start"))
        out.cameraStart = read_vec2(sceneJson["camera_start"], { 0.f, 0.f });

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
    read_tilemap_layers(sceneJson, out.tilemapLayers);
    read_scene_layer_settings(sceneJson, out.layerSettings);
    read_scene_layer_stack(sceneJson, out);
}

void read_scene_layer_stack(const nlohmann::json& sceneJson, SceneDef& out) {
    read_scene_layers(sceneJson, out.layers);
    if (sceneJson.contains("defaultLayerId") && sceneJson["defaultLayerId"].is_string()) {
        out.defaultLayerId = sceneJson["defaultLayerId"].get<std::string>();
    } else if (sceneJson.contains("default_layer_id")
               && sceneJson["default_layer_id"].is_string()) {
        out.defaultLayerId = sceneJson["default_layer_id"].get<std::string>();
    } else {
        out.defaultLayerId.clear();
    }
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

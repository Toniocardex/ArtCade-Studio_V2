#include "project-meta-json.h"

#include "collision-json.h"
#include "json-primitives.h"
#include "entity-json.h"

#include <cctype>
#include <optional>
#include <string_view>

namespace ArtCade::ProjectJson {

namespace {

constexpr Vec4 kFallbackHexColor{0.5f, 0.5f, 0.5f, 1.f};

std::optional<int> parse_hex_byte(std::string_view pair) {
    if (pair.size() != 2)
        return std::nullopt;
    for (char c : pair) {
        if (!std::isxdigit(static_cast<unsigned char>(c)))
            return std::nullopt;
    }
    return std::stoi(std::string(pair), nullptr, 16);
}

PhysicsMode read_physics_mode(const nlohmann::json& worldJson) {
    const std::string mode = read_string_any(
        worldJson, "physicsMode", "physics_mode", "auto");
    if (mode == "off") return PhysicsMode::Off;
    if (mode == "on")  return PhysicsMode::On;
    return PhysicsMode::Auto;
}

Vec4 read_tile_palette_color(const nlohmann::json& item) {
    if (!item.contains("color"))
        return hex_to_vec4("#808080");
    const auto& color = item["color"];
    if (color.is_string())
        return hex_to_vec4(color.get<std::string>());
    return read_vec4(color);
}

bool read_tile_palette_entry(const nlohmann::json& item, TilePaletteEntry& out) {
    if (!item.is_object())
        return false;

    out = TilePaletteEntry{};
    out.id = item.value("id", 0);
    if (out.id < 1)
        return false;

    out.name        = item.value("name", std::string{});
    out.color       = read_tile_palette_color(item);
    CollisionBodyComponent body{};
    if (read_collision_body_component(item, body))
        out.collisionBody = std::move(body);
    return true;
}

} // namespace

Vec4 hex_to_vec4(const std::string& hex) {
    auto h = hex;
    if (!h.empty() && h[0] == '#')
        h.erase(0, 1);
    if (h.size() == 3)
        h = std::string{h[0], h[0], h[1], h[1], h[2], h[2]};
    if (h.size() != 6)
        return kFallbackHexColor;

    const std::optional<int> r = parse_hex_byte(h.substr(0, 2));
    const std::optional<int> g = parse_hex_byte(h.substr(2, 2));
    const std::optional<int> b = parse_hex_byte(h.substr(4, 2));
    if (!r.has_value() || !g.has_value() || !b.has_value())
        return kFallbackHexColor;

    return {
        static_cast<float>(*r) / 255.f,
        static_cast<float>(*g) / 255.f,
        static_cast<float>(*b) / 255.f,
        1.f,
    };
}

void read_world_settings(const nlohmann::json& worldJson, WorldSettings& out) {
    if (!worldJson.is_object())
        return;

    out.gravity        = read_float_any(worldJson, "gravity", "gravity", 9.81f);
    out.pixelsPerMeter = read_float_any(worldJson, "pixelsPerMeter", "pixels_per_meter", 100.f);
    out.timeScale      = read_float_any(worldJson, "timeScale", "time_scale", 1.f);
    out.physicsMode    = read_physics_mode(worldJson);

    if (worldJson.contains("physicsDebugDraw") && worldJson["physicsDebugDraw"].is_boolean())
        out.physicsDebugDraw = worldJson["physicsDebugDraw"].get<bool>();
    else if (worldJson.contains("physics_debug_draw") && worldJson["physics_debug_draw"].is_boolean())
        out.physicsDebugDraw = worldJson["physics_debug_draw"].get<bool>();
}

void read_tile_palette(const nlohmann::json& doc, std::vector<TilePaletteEntry>& out) {
    out.clear();

    const nlohmann::json* raw = nullptr;
    if (doc.contains("tilePalette") && doc["tilePalette"].is_array())
        raw = &doc["tilePalette"];
    else if (doc.contains("tile_palette") && doc["tile_palette"].is_array())
        raw = &doc["tile_palette"];
    if (raw == nullptr)
        return;

    out.reserve(raw->size());
    for (const auto& item : *raw) {
        TilePaletteEntry entry;
        if (read_tile_palette_entry(item, entry))
            out.push_back(std::move(entry));
    }
}

void read_tileset_asset(const nlohmann::json& tilesetJson,
                        const std::string& mapKey,
                        TilesetAsset& out) {
    out.assetId = tilesetJson.value("assetId", tilesetJson.value("asset_id", mapKey));
    if (out.assetId.empty())
        out.assetId = mapKey;
    out.spriteImagePath = read_string_any(tilesetJson, "spriteImagePath", "sprite_image_path");
    out.tileSize        = read_float_any(tilesetJson, "tileSize", "tile_size", 32.f);
    out.margin          = tilesetJson.value("margin", 0);
    out.cols            = tilesetJson.value("cols", 1);
    out.rows            = tilesetJson.value("rows", 1);
}

void read_tilesets(const nlohmann::json& doc, std::vector<TilesetAsset>& out) {
    out.clear();
    if (!doc.contains("tilesets"))
        return;

    const auto& tsj = doc["tilesets"];
    if (tsj.is_array()) {
        out.reserve(tsj.size());
        for (const auto& item : tsj) {
            TilesetAsset tileset;
            read_tileset_asset(item, {}, tileset);
            out.push_back(std::move(tileset));
        }
    } else if (tsj.is_object()) {
        out.reserve(tsj.size());
        for (auto& [key, val] : tsj.items()) {
            if (!val.is_object())
                continue;
            TilesetAsset tileset;
            read_tileset_asset(val, key, tileset);
            out.push_back(std::move(tileset));
        }
    }
}

void read_thumbnails(const nlohmann::json& doc,
                     std::unordered_map<SceneId, std::string>& out) {
    out.clear();
    if (!doc.contains("thumbnails") || !doc["thumbnails"].is_object())
        return;

    for (auto& [sceneId, thumbPath] : doc["thumbnails"].items()) {
        if (thumbPath.is_string())
            out[sceneId] = thumbPath.get<std::string>();
    }
}

void read_project_header(const nlohmann::json& doc, ProjectDoc& out) {
    out.projectName   = read_string_any(doc, "projectName", "project_name", "Untitled");
    out.version       = doc.value("version", "2.0.0");
    out.licenseTier   = read_string_any(doc, "licenseTier", "license_tier", "free");
    out.targetFPS     = read_float_any(doc, "targetFPS", "target_fps", 60.f);
    out.activeSceneId = read_string_any(doc, "activeSceneId", "active_scene_id");
    out.mainScriptPath =
        read_string_any(doc, "mainScriptPath", "main_script_path", "scripts/main.luac");
    out.formatVersion = doc.value("formatVersion", doc.value("format_version", 0));
}

void read_global_variables(const nlohmann::json& doc, ProjectDoc& out) {
    if (doc.contains("globalVariables"))
        read_variable_definitions(doc["globalVariables"], out.globalVariables);
    else
        out.globalVariables.clear();
}

void read_scene_layers(const nlohmann::json& doc, std::vector<SceneLayerDef>& out) {
    out.clear();
    if (!doc.contains("layers") || !doc["layers"].is_array())
        return;

    for (const auto& item : doc["layers"]) {
        SceneLayerDef layer;
        if (item.is_string()) {
            // Legacy string form: use the name as a stable id fallback.
            layer.name = item.get<std::string>();
            layer.id   = layer.name;
        } else if (item.is_object()) {
            layer.id     = item.value("id", std::string{});
            layer.name   = item.value("name", std::string{});
            layer.locked = item.value("locked", false);
            if (layer.id.empty())
                layer.id = layer.name;   // tolerate id-less entries
        }
        if (!layer.id.empty())
            out.push_back(std::move(layer));
    }
}

void read_runtime_settings(const nlohmann::json& doc, ProjectRuntimeSettings& out) {
    if (doc.contains("targetFPS"))
        out.targetFPS = doc["targetFPS"].get<float>();
    else if (doc.contains("target_fps"))
        out.targetFPS = doc["target_fps"].get<float>();

    if (!doc.contains("world") || !doc["world"].is_object())
        return;

    const auto& worldJson = doc["world"];
    if (worldJson.contains("gravity"))
        out.gravity = worldJson["gravity"].get<float>();
    if (worldJson.contains("pixelsPerMeter"))
        out.pixelsPerMeter = worldJson["pixelsPerMeter"].get<float>();
    else if (worldJson.contains("pixels_per_meter"))
        out.pixelsPerMeter = worldJson["pixels_per_meter"].get<float>();
    if (worldJson.contains("timeScale"))
        out.timeScale = worldJson["timeScale"].get<float>();
    else if (worldJson.contains("time_scale"))
        out.timeScale = worldJson["time_scale"].get<float>();
    if (worldJson.contains("physicsDebugDraw") && worldJson["physicsDebugDraw"].is_boolean())
        out.physicsDebugDraw = worldJson["physicsDebugDraw"].get<bool>();
    else if (worldJson.contains("physics_debug_draw")
             && worldJson["physics_debug_draw"].is_boolean())
        out.physicsDebugDraw = worldJson["physics_debug_draw"].get<bool>();

    if (worldJson.contains("physicsMode") || worldJson.contains("physics_mode"))
        out.physicsMode = read_physics_mode(worldJson);
}

} // namespace ArtCade::ProjectJson

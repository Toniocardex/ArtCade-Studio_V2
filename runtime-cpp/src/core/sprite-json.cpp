#include "sprite-json.h"

namespace ArtCade::ProjectJson {

namespace {

Vec2 read_vec2(const nlohmann::json& j, const Vec2& fallback = {0.f, 0.f}) {
    if (j.is_array() && j.size() >= 2) {
        return {j[0].get<float>(), j[1].get<float>()};
    }
    if (j.is_object()) {
        return {j.value("x", fallback.x), j.value("y", fallback.y)};
    }
    return fallback;
}

Vec3 read_vec3(const nlohmann::json& j, const Vec3& fallback = {1.f, 1.f, 1.f}) {
    if (j.is_array() && j.size() >= 3) {
        return {j[0].get<float>(), j[1].get<float>(), j[2].get<float>()};
    }
    if (j.is_object()) {
        return {
            j.contains("r") ? j["r"].get<float>() : j.value("x", fallback.x),
            j.contains("g") ? j["g"].get<float>() : j.value("y", fallback.y),
            j.contains("b") ? j["b"].get<float>() : j.value("z", fallback.z),
        };
    }
    return fallback;
}

Vec4 read_vec4(const nlohmann::json& j, const Vec4& fallback = {1.f, 1.f, 1.f, 1.f}) {
    if (j.is_array() && j.size() >= 4) {
        return {j[0].get<float>(), j[1].get<float>(), j[2].get<float>(), j[3].get<float>()};
    }
    if (j.is_object()) {
        return {
            j.contains("r") ? j["r"].get<float>() : j.value("x", fallback.r),
            j.contains("g") ? j["g"].get<float>() : j.value("y", fallback.g),
            j.contains("b") ? j["b"].get<float>() : j.value("z", fallback.b),
            j.contains("a") ? j["a"].get<float>() : j.value("w", fallback.a),
        };
    }
    return fallback;
}

std::string read_string_any(const nlohmann::json& j,
                            const char* camel,
                            const char* snake,
                            const std::string& fallback = {}) {
    if (j.contains(camel)) return j[camel].get<std::string>();
    if (j.contains(snake)) return j[snake].get<std::string>();
    return fallback;
}

} // namespace

bool read_sprite_component(const nlohmann::json& entityJson,
                           SpriteComponent& out) {
    if (!entityJson.contains("sprite") || !entityJson["sprite"].is_object())
        return false;

    const auto& j = entityJson["sprite"];
    SpriteComponent s;
    s.spriteAssetId = read_string_any(j, "spriteAssetId", "sprite_asset_id");
    if (j.contains("tint"))
        s.tint = read_vec4(j["tint"]);
    if (j.contains("fillColor"))
        s.fillColor = read_vec3(j["fillColor"]);
    else
        s.fillColor = {s.tint.r, s.tint.g, s.tint.b};
    s.alpha = j.value("alpha", 1.f);
    s.pivotFromAsset = j.value("pivotFromAsset", j.value("pivot_from_asset", true));
    if (j.contains("pivot"))
        s.pivot = read_vec2(j["pivot"]);
    s.renderOrder = j.value("renderOrder", j.value("render_order", 0));
    if (j.contains("defaultClip"))
        s.defaultClip = j["defaultClip"].get<std::string>();
    else if (j.contains("default_clip"))
        s.defaultClip = j["default_clip"].get<std::string>();
    s.playClipOnSpawn = j.value("playClipOnSpawn", j.value("play_clip_on_spawn", false));

    out = s;
    return true;
}

} // namespace ArtCade::ProjectJson

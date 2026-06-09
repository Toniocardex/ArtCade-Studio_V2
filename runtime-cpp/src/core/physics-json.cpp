#include "physics-json.h"

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

} // namespace

bool read_physics_component(const nlohmann::json& entityJson,
                            PhysicsComponent& out) {
    if (!entityJson.contains("physics") || !entityJson["physics"].is_object())
        return false;

    const auto& p = entityJson["physics"];
    PhysicsComponent pc;
    const std::string bt = p.value("bodyType", std::string("Dynamic"));
    if (bt == "Static")
        pc.bodyType = BodyType::Static;
    else if (bt == "Kinematic")
        pc.bodyType = BodyType::Kinematic;
    else
        pc.bodyType = BodyType::Dynamic;

    if (p.contains("collider") && p["collider"].is_object()) {
        const auto& c = p["collider"];
        const std::string shape = c.value("shape", std::string("Rectangle"));
        pc.collider.shape = (shape == "Circle")
            ? ColliderShape::Circle
            : ColliderShape::Rectangle;
        if (c.contains("size"))
            pc.collider.size = read_vec2(c["size"], pc.collider.size);
        if (c.contains("offset"))
            pc.collider.offset = read_vec2(c["offset"]);
        pc.collider.density  = c.value("density", 1.f);
        pc.collider.friction = c.value("friction", 0.3f);
        pc.collider.isSensor = c.value("isSensor", false);
    }

    out = pc;
    return true;
}

} // namespace ArtCade::ProjectJson

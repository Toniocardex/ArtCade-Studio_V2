// physics-json-test.cpp — shared project JSON deserializers.

#include "physics-json.h"
#include "sprite-json.h"

#include <cmath>
#include <iostream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

static void test_read_physics_component_from_object_type_json() {
    const json entity = json::parse(R"({
      "id": "Hero",
      "physics": {
        "bodyType": "Static",
        "collider": {
          "shape": "Rectangle",
          "size": { "x": 64, "y": 32 },
          "offset": { "x": 1, "y": 2 },
          "density": 2,
          "friction": 0.5,
          "isSensor": true
        }
      }
    })");

    ArtCade::PhysicsComponent pc{};
    CHECK(ArtCade::ProjectJson::read_physics_component(entity, pc));
    CHECK(pc.bodyType == ArtCade::BodyType::Static);
    CHECK(std::abs(pc.collider.size.x - 64.f) < 0.01f);
    CHECK(std::abs(pc.collider.size.y - 32.f) < 0.01f);
    CHECK(std::abs(pc.collider.offset.x - 1.f) < 0.01f);
    CHECK(pc.collider.isSensor);
}

static void test_missing_physics_returns_false() {
    const json entity = json::parse(R"({ "id": "Hero" })");
    ArtCade::PhysicsComponent pc{};
    CHECK(!ArtCade::ProjectJson::read_physics_component(entity, pc));
}

static void test_read_sprite_component_fill_color() {
    const json entity = json::parse(R"({
      "sprite": {
        "spriteAssetId": "hero",
        "fillColor": { "x": 0.2, "y": 0.4, "z": 0.6 },
        "pivotFromAsset": false,
        "pivot": { "x": 0.25, "y": 0.75 }
      }
    })");

    ArtCade::SpriteComponent sprite{};
    CHECK(ArtCade::ProjectJson::read_sprite_component(entity, sprite));
    CHECK(sprite.spriteAssetId == "hero");
    CHECK(std::abs(sprite.fillColor.x - 0.2f) < 0.01f);
    CHECK(sprite.pivotFromAsset == false);
    CHECK(std::abs(sprite.pivot.x - 0.25f) < 0.01f);
}

int main() {
    test_read_physics_component_from_object_type_json();
    test_missing_physics_returns_false();
    test_read_sprite_component_fill_color();

    std::cout << "physics-json-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

// collision-world-mask-test.cpp - CollisionWorld layer masks + profile resolve.

#include "collision-json.h"
#include "modules/collision/include/collision_world.h"
#include "modules/runtime-entity-gateway/src/collision-profile-resolve.h"

#include <iostream>
#include <unordered_map>

using namespace ArtCade;
using namespace ArtCade::CollisionWorld;
using namespace ArtCade::Modules::CollisionProfileResolve;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

static CollisionShape makeRectShape(
    const std::string& layerId,
    const std::vector<std::string>& maskIds,
    float size = 32.f)
{
    CollisionShape shape;
    shape.type = CollisionShapeType::Rectangle;
    shape.layerId = layerId;
    shape.maskLayerIds = maskIds;
    shape.size = { size, size };
    shape.enabled = true;
    return shape;
}

static std::vector<PhysicsLayerDef> defaultLayers() {
    return {
        { "player", "Player", 1, {} },
        { "ground", "Ground", 2, {} },
        { "enemy", "Enemy", 3, {} },
    };
}

static void test_overlap_respects_layer_masks() {
    World world;
    world.setLayers(defaultLayers());

    Transform playerTf{};
    playerTf.position = { 100.f, 100.f };
    CollisionBodyComponent playerBody;
    playerBody.bodyType = BodyType::Kinematic;
    playerBody.shapes.push_back(makeRectShape("player", { "ground" }));

    Transform groundTf{};
    groundTf.position = { 100.f, 100.f };
    CollisionBodyComponent groundBody;
    groundBody.bodyType = BodyType::Static;
    groundBody.shapes.push_back(makeRectShape("ground", { "player" }));

    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, groundTf, groundBody);
    CHECK(world.overlapEntities(1, 2));

    playerBody.shapes[0].maskLayerIds = { "enemy" };
    world.clear();
    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, groundTf, groundBody);
    CHECK(!world.overlapEntities(1, 2));
}

static void test_resolve_profile_shapes_from_sprite_path() {
    CollisionProfileDef profile;
    profile.id = "img_a";
    profile.coordinateSpace = CollisionProfileCoordinateSpace::FrameNormalized;
    CollisionShape norm{};
    norm.type = CollisionShapeType::Rectangle;
    norm.layerId = "player";
    norm.maskLayerIds = { "ground" };
    norm.offset = { 0.1f, 0.1f };
    norm.size = { 0.8f, 0.8f };
    norm.enabled = true;
    profile.shapes.push_back(norm);

    std::unordered_map<std::string, CollisionProfileDef> profiles{
        { "img_a", profile },
    };
    std::unordered_map<std::string, std::string> pathToId{
        { "assets/hero.png", "img_a" },
    };

    SpriteComponent sprite{};
    sprite.spriteAssetId = "assets/hero.png";
    Transform transform{};
    transform.scale = { 1.f, 1.f };
    CollisionBodyComponent authored{};
    authored.enabled = true;
    authored.bodyType = BodyType::Kinematic;

    CollisionBodyComponent resolved{};
    CHECK(resolve_collision_body(
        1, sprite, transform, authored, profiles, pathToId, nullptr, resolved));
    CHECK(!resolved.shapes.empty());
    CHECK(resolved.shapes[0].layerId == "player");
    CHECK(resolved.shapes[0].size.x > 1.f);
}

static void test_read_collision_profiles_json() {
    const auto doc = nlohmann::json::parse(R"({
      "collisionProfiles": {
        "img_a": {
          "id": "img_a",
          "name": "Hero",
          "coordinateSpace": "frame-normalized",
          "shapes": [{
            "type": "rectangle",
            "role": "body",
            "layerId": "player",
            "maskLayerIds": ["ground"],
            "offsetX": 0.1,
            "offsetY": 0.1,
            "width": 0.8,
            "height": 0.8,
            "enabled": true
          }]
        }
      }
    })");

    std::unordered_map<std::string, CollisionProfileDef> profiles;
    ProjectJson::read_collision_profiles(doc, profiles);
    CHECK(profiles.size() == 1);
    CHECK(profiles["img_a"].coordinateSpace == CollisionProfileCoordinateSpace::FrameNormalized);
    CHECK(profiles["img_a"].shapes[0].layerId == "player");
    CHECK(profiles["img_a"].shapes[0].maskLayerIds[0] == "ground");
}

static void test_contact_events_survive_world_rebuilds() {
    World world;
    world.setLayers(defaultLayers());

    Transform playerTf{};
    playerTf.position = { 100.f, 100.f };
    CollisionBodyComponent playerBody;
    playerBody.bodyType = BodyType::Kinematic;
    playerBody.shapes.push_back(makeRectShape("player", { "ground" }));

    Transform groundTf{};
    groundTf.position = { 100.f, 100.f };
    CollisionBodyComponent groundBody;
    groundBody.bodyType = BodyType::Static;
    groundBody.shapes.push_back(makeRectShape("ground", { "player" }));

    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, groundTf, groundBody);
    auto events = world.refreshEvents();
    CHECK(events.size() == 1);
    CHECK(events[0].kind == ContactEvent::Kind::Enter);
    CHECK(events[0].self == 1);
    CHECK(events[0].other == 2);

    world.clear();
    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, groundTf, groundBody);
    events = world.refreshEvents();
    CHECK(events.size() == 1);
    CHECK(events[0].kind == ContactEvent::Kind::Stay);

    groundTf.position = { 300.f, 100.f };
    world.clear();
    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, groundTf, groundBody);
    events = world.refreshEvents();
    CHECK(events.size() == 1);
    CHECK(events[0].kind == ContactEvent::Kind::Exit);
    CHECK(events[0].self == 1);
    CHECK(events[0].other == 2);
}

static void test_spatial_broadphase_keeps_queries_deterministic() {
    World world;
    world.setLayers(defaultLayers());

    CollisionBodyComponent playerBody;
    playerBody.bodyType = BodyType::Kinematic;
    playerBody.shapes.push_back(makeRectShape("player", { "ground" }, 64.f));

    CollisionBodyComponent groundBody;
    groundBody.bodyType = BodyType::Static;
    groundBody.shapes.push_back(makeRectShape("ground", { "player" }, 64.f));

    Transform playerTf{};
    playerTf.position = { -256.f, -256.f };
    Transform nearGroundTf{};
    nearGroundTf.position = { -250.f, -256.f };
    Transform farGroundTf{};
    farGroundTf.position = { 2048.f, 2048.f };

    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, farGroundTf, groundBody);
    world.addEntity(3, nearGroundTf, groundBody);

    CHECK(world.firstTouching(1) == 3);
    CHECK(world.overlapEntities(1, 3));
    CHECK(!world.overlapEntities(1, 2));
}

static void test_spatial_broadphase_does_not_duplicate_large_shape_events() {
    World world;
    world.setLayers(defaultLayers());

    Transform playerTf{};
    playerTf.position = { 0.f, 0.f };
    CollisionBodyComponent playerBody;
    playerBody.bodyType = BodyType::Kinematic;
    playerBody.shapes.push_back(makeRectShape("player", { "ground" }, 32.f));

    Transform platformTf{};
    platformTf.position = { 0.f, 0.f };
    CollisionBodyComponent platformBody;
    platformBody.bodyType = BodyType::Static;
    platformBody.shapes.push_back(makeRectShape("ground", { "player" }, 512.f));

    world.addEntity(1, playerTf, playerBody);
    world.addEntity(2, platformTf, platformBody);

    const auto events = world.refreshEvents();
    CHECK(events.size() == 1);
    if (events.size() == 1) {
        CHECK(events[0].self == 1);
        CHECK(events[0].other == 2);
    }
}

int main() {
    test_overlap_respects_layer_masks();
    test_resolve_profile_shapes_from_sprite_path();
    test_read_collision_profiles_json();
    test_contact_events_survive_world_rebuilds();
    test_spatial_broadphase_keeps_queries_deterministic();
    test_spatial_broadphase_does_not_duplicate_large_shape_events();

    if (g_failed == 0) {
        std::cout << "collision-world-mask-test: " << g_passed << " passed\n";
        return 0;
    }
    std::cerr << "collision-world-mask-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return 1;
}

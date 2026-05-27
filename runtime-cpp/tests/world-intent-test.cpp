// world-intent-test.cpp -- core gameplay intents and sensor edges.
//
// These tests avoid Raylib/Input and validate the "Thick Core" path:
// Lua/Logic Board can express intent, while World/Physics perform the
// frequent work in C++.

#include "modules/scene-system/include/scene-manager.h"
#include "modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "modules/physics/include/physics.h"
#include "modules/variable-manager/include/variable-manager.h"
#include "world/include/world.h"

#include <cmath>
#include <iostream>
#include <unordered_map>

using namespace ArtCade;
using namespace ArtCade::Modules;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

static EntityDef makeEntity(EntityId id,
                            const std::string& cls,
                            std::vector<std::string> tags = {})
{
    EntityDef def;
    def.id = id;
    def.name = cls;
    def.className = cls;
    def.tags = std::move(tags);
    def.transform.scale = { 1.f, 1.f };
    def.sprite.alpha = 1.f;
    def.runtime.sceneActive = true;
    return def;
}

struct Fixture {
    SceneManager sm;
    RuntimeEntityGateway gw;
    Physics physics;
    VariableManager vars;
    World world;

    Fixture()
        : gw(sm),
          world(gw, physics, vars)
    {
        sm.init();
        gw.init();
        physics.init();
        vars.init();
        gw.setPhysics(&physics);
    }

    ~Fixture() {
        world.shutdown();
        gw.shutdown();
        vars.shutdown();
        physics.shutdown();
        sm.shutdown();
    }

    // Sensor edges are now computed by the app driver AFTER physics step
    // (so begin/end events fire on the same frame as the overlap). Tests
    // don't run a physics step, so this helper mirrors the new contract:
    // gameplay tick + sensor refresh.
    void tickFrame(float dt) {
        world.tickGameplaySystems(dt);
        world.tickPlatformerControllers(dt);
        world.refreshSensorEdges();
    }
};

// Fase 1 — kinematic platformer without implicit Box2D body (physics plan §7).

static void test_platformer_only_has_no_implicit_physics_body() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);
}

static void test_platformer_kinematic_falls_with_custom_gravity() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 100.f, 200.f };
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);

    const float dt = 1.f / 60.f;
    f.tickFrame(dt);

    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.position.y > 200.f);
    CHECK(transform.velocity.y > 0.f);
}

static void test_platformer_kinematic_horizontal_movement_without_body() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 50.f, 100.f };
    PlatformerControllerComponent pc;
    pc.maxSpeed = 240.f;
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);
    f.world.setMovementIntent(1, 1.f, 0.f);
    f.tickFrame(1.f / 60.f);

    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.position.x > 50.f);
    CHECK(std::abs(transform.velocity.x - 240.f) < 0.01f);
}

static void test_platformer_is_grounded_false_when_airborne_over_solid() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 80.f };
    PlatformerControllerComponent pc;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);
    CHECK(!f.world.isPlatformerGrounded(1));
}

static void test_platformer_coyote_jump_after_leaving_solid() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 500.f;
    pc.coyoteTime = 0.2f;
    pc.jumpBuffer = 0.15f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 2.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));

    const float dt = 1.f / 60.f;
    bool jumped = false;
    Transform transform{};
    for (int i = 0; i < 18; ++i) {
        f.world.setMovementIntent(1, 1.f, 0.f);
        if (i == 4) f.world.requestJump(1);
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        if (transform.velocity.y < -499.f) jumped = true;
    }

    CHECK(jumped);
    CHECK(!f.world.isPlatformerGrounded(1));
}

static void test_platformer_snaps_to_solid_after_fall() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 80.f };
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    for (int i = 0; i < 90; ++i)
        f.tickFrame(dt);

    CHECK(f.world.isPlatformerGrounded(1));
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(std::abs(transform.velocity.y) < 0.01f);
}

static void test_platformer_stays_centered_on_wide_solid_after_land() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 80.f };
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    pc.jumpForce = 600.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    solid.surfaceKind = "solid";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    for (int i = 0; i < 90; ++i)
        f.tickFrame(dt);

    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(f.world.isPlatformerGrounded(1));
    CHECK(std::abs(transform.position.x - 160.f) < 2.f);

    f.world.requestJump(1);
    for (int i = 0; i < 4; ++i)
        f.tickFrame(dt);
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y < -50.f);
}

static void test_platformer_grounded_with_feet_slightly_below_solid_top() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 188.f };
    PlatformerControllerComponent pc;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
}

static void test_platformer_blocks_solid_underside_when_jumping_up() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 379.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 700.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef floor = makeEntity(2, "Floor");
    floor.transform.position = { 160.f, 400.f };
    floor.transform.scale = { 10.f, 0.3125f };
    SolidComponent floorSolid;
    floorSolid.groundClass = "Ground";
    floor.solid = floorSolid;

    EntityDef ceiling = makeEntity(3, "SolidCeiling");
    ceiling.transform.position = { 160.f, 200.f };
    ceiling.transform.scale = { 10.f, 0.3125f };
    SolidComponent ceilingSolid;
    ceilingSolid.groundClass = "Ground";
    ceilingSolid.surfaceKind = "solid";
    ceiling.solid = ceilingSolid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2, 3 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, floor }, { 3, ceiling }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
    f.world.requestJump(1);
    const float dt = 1.f / 60.f;
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    const float startY = transform.position.y;
    float peakY        = startY;

    for (int i = 0; i < 25; ++i) {
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        peakY = std::min(peakY, transform.position.y);
    }

  // Ceiling underside ~205; player should not pass through (peak well above that).
    CHECK(peakY > 220.f);
    CHECK(peakY < startY - 40.f);
}

static void test_platformer_blocks_solid_wall_horizontally() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 80.f, 379.f };
    PlatformerControllerComponent pc;
    pc.maxSpeed = 300.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef floor = makeEntity(2, "Floor");
    floor.transform.position = { 160.f, 400.f };
    floor.transform.scale = { 10.f, 0.3125f };
    SolidComponent floorSolid;
    floorSolid.groundClass = "Ground";
    floor.solid = floorSolid;

    EntityDef wall = makeEntity(3, "Wall");
    wall.transform.position = { 200.f, 379.f };
    wall.transform.scale = { 0.5f, 2.f };
    SolidComponent wallSolid;
    wallSolid.groundClass = "Ground";
    wallSolid.surfaceKind = "solid";
    wall.solid = wallSolid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2, 3 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, floor }, { 3, wall }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    Transform transform{};
    for (int i = 0; i < 30; ++i) {
        f.world.setMovementIntent(1, 1.f, 0.f);
        f.tickFrame(dt);
    }

    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.position.x <= 176.5f);
}

static void test_platformer_passes_under_solid_at_horizontal_edges() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 40.f, 280.f };
    PlatformerControllerComponent pc;
    pc.maxSpeed = 300.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "OverheadSolid");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 1.f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    solid.surfaceKind = "solid";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    Transform transform{};
    float maxX = 40.f;
    for (int i = 0; i < 90; ++i) {
        f.world.setMovementIntent(1, 1.f, 0.f);
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        maxX = std::max(maxX, transform.position.x);
    }
    // Platform right edge ~304 (320 - halfW); old volume tunnel clamped here.
    CHECK(maxX > 308.f);

    f.world.setMovementIntent(1, -1.f, 0.f);
    transform.position = { 280.f, 280.f };
    f.gw.setTransform(1, transform);
    float minX = 280.f;
    for (int i = 0; i < 90; ++i) {
        f.world.setMovementIntent(1, -1.f, 0.f);
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        minX = std::min(minX, transform.position.x);
    }
    CHECK(minX < 20.f);
}

static void test_platformer_passes_through_one_way_when_jumping_up() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 179.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 600.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    solid.surfaceKind = "oneWay";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
    f.world.requestJump(1);
    f.tickFrame(1.f / 60.f);

    CHECK(!f.world.isPlatformerGrounded(1));
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y < -500.f);
    CHECK(transform.position.y < 179.f);
}

static void test_platformer_passes_through_thick_one_way_while_rising() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 279.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 650.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef floor = makeEntity(2, "Floor");
    floor.transform.position = { 160.f, 300.f };
    floor.transform.scale = { 10.f, 0.3125f };
    SolidComponent floorSolid;
    floorSolid.groundClass = "Ground";
    floor.solid = floorSolid;

    EntityDef platform = makeEntity(3, "OneWayThick");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 2.f };
    SolidComponent oneWay;
    oneWay.groundClass = "Ground";
    oneWay.surfaceKind = "oneWay";
    platform.solid = oneWay;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2, 3 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, floor }, { 3, platform }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));

    // One-way AABB top ~168, bottom ~232 (center 200, halfH 32).
    constexpr float kOneWayTopY    = 168.f;
    constexpr float kOneWayBottomY = 232.f;

    f.world.requestJump(1);
    const float dt = 1.f / 60.f;
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    const float startY = transform.position.y;

    bool insideThickVolume = false;
    for (int i = 0; i < 40; ++i) {
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        const bool inside = transform.position.y > kOneWayTopY + 10.f
            && transform.position.y < kOneWayBottomY - 10.f;
        if (inside) {
            insideThickVolume = true;
            CHECK(!f.world.isPlatformerGrounded(1));
        }
    }

    CHECK(insideThickVolume);
    CHECK(transform.position.y < startY - 15.f);
}

static void test_platformer_lands_on_one_way_when_falling() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 80.f };
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    solid.surfaceKind = "oneWay";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    for (int i = 0; i < 90; ++i)
        f.tickFrame(dt);

    CHECK(f.world.isPlatformerGrounded(1));
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(std::abs(transform.velocity.y) < 0.01f);
}

static void test_platformer_grounded_on_solid_without_player_physics() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 420.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);
    CHECK(f.gw.physicsHandle(2) != 0);
    CHECK(f.world.isPlatformerGrounded(1));

    f.world.requestJump(1);
    f.tickFrame(1.f / 60.f);
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y < -419.f);
}

static void test_platformer_with_physics_collider_is_kinematic_body() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) != 0);
    PhysicsComponent physics{};
    CHECK(f.gw.getPhysicsComponent(1, physics));
    CHECK(physics.bodyType == BodyType::Kinematic);
}

static void test_platformer_movement_intent_without_input() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    pc.maxSpeed = 250.f;
    pc.jumpForce = 600.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef ground = makeEntity(2, "Ground");
    ground.physics.bodyType = BodyType::Static;
    ground.physics.collider.size = { 128.f, 32.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, ground }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) != 0);
    CHECK(f.gw.physicsHandle(2) != 0);

    f.world.setMovementIntent(1, 1.f, 0.f);
    f.tickFrame(1.f / 60.f);
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(std::abs(transform.velocity.x - 250.f) < 0.01f);
    CHECK(transform.position.x > 0.f);

    f.world.clearMovementIntent(1);
    f.tickFrame(1.f / 60.f);
    CHECK(f.gw.getTransform(1, transform));
    CHECK(std::abs(transform.velocity.x) < 0.01f);
}

static void test_platformer_jump_request_rising_edge_dedupes_hold() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 600.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));

    const float dt = 1.f / 60.f;
    int jumpImpulseFrames = 0;
    float minVy = 0.f;
    for (int i = 0; i < 30; ++i) {
        f.world.requestJump(1);
        f.world.setMovementIntent(1, 1.f, 0.f);
        f.tickFrame(dt);

        Transform transform{};
        CHECK(f.gw.getTransform(1, transform));
        if (transform.velocity.y < -599.f)
            ++jumpImpulseFrames;
        minVy = std::min(minVy, transform.velocity.y);
    }

    CHECK(jumpImpulseFrames == 1);
    CHECK(minVy < -599.f);
}

static void test_platformer_gravity_while_moving_in_air_after_jump() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 600.f;
    pc.customGravity = 1500.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    f.world.requestJump(1);
    f.tickFrame(dt);

    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y < -599.f);

    float peakY = transform.position.y;
    bool sawFalling = false;
    for (int i = 0; i < 40; ++i) {
        f.world.setMovementIntent(1, 1.f, 0.f);
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        peakY = std::min(peakY, transform.position.y);
        if (transform.velocity.y > 1.f)
            sawFalling = true;
    }

    CHECK(sawFalling);
    CHECK(peakY < transform.position.y - 5.f);
}

static void test_platformer_same_frame_multiple_request_jump() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 500.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    f.world.requestJump(1);
    f.world.requestJump(1);
    f.world.requestJump(1);
    f.tickFrame(1.f / 60.f);

    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y < -499.f);

    f.tickFrame(1.f / 60.f);
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y > -499.f);
}

static void test_platformer_jump_intent_without_input() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 500.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef ground = makeEntity(2, "Ground");
    ground.transform.position = { 160.f, 200.f };
    ground.transform.scale = { 10.f, 0.3125f };
    ground.physics.bodyType = BodyType::Static;
    SolidComponent solid;
    solid.groundClass = "Ground";
    ground.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, ground }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
    f.world.requestJump(1);
    f.tickFrame(1.f / 60.f);
    const Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(velocity.y < -499.f);
}

static void test_platformer_grounded_by_solid_component() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 420.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(2) != 0);
    CHECK(f.world.isPlatformerGrounded(1));
    f.world.requestJump(1);
    f.tickFrame(1.f / 60.f);
    const Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(velocity.y < -419.f);
}

static void test_platformer_grounded_on_scaled_solid_platform() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 160.f, 179.f };
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 420.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 10.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(2) != 0);
    CHECK(f.physics.areOverlapping(f.gw.physicsHandle(1), f.gw.physicsHandle(2)));

    for (int i = 0; i < 30; ++i)
        f.tickFrame(1.f / 60.f);

    CHECK(f.world.isPlatformerGrounded(1));
}

static void test_scaled_solid_rebuilds_physics_on_transform() {
    Fixture f;

    EntityDef platform = makeEntity(2, "Platform");
    platform.transform.position = { 160.f, 200.f };
    platform.transform.scale = { 1.f, 1.f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    platform.solid = solid;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 163.f };
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, platform }};
    f.world.init(doc);

    const uint32_t platformHandleBefore = f.gw.physicsHandle(2);
    CHECK(platformHandleBefore != 0);
    CHECK(!f.physics.areOverlapping(f.gw.physicsHandle(1), platformHandleBefore));

    CHECK(f.gw.setTransform(2, { 160.f, 200.f }, 0.f, { 10.f, 0.3125f }));
    const uint32_t platformHandleAfter = f.gw.physicsHandle(2);
    CHECK(platformHandleAfter != 0);
    CHECK(f.gw.setTransform(1, { 160.f, 179.f }, 0.f, { 1.f, 1.f }));
    CHECK(f.physics.areOverlapping(f.gw.physicsHandle(1), platformHandleAfter));
}

static void test_top_down_movement_intent_without_input() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    TopDownControllerComponent tc;
    tc.maxSpeed = 120.f;
    tc.acceleration = 1000.f;
    tc.friction = 1000.f;
    player.topDownController = tc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    f.world.setMovementIntent(1, 1.f, 1.f);
    f.tickFrame(1.f);
    f.physics.step(1.f / 60.f);
    f.world.syncPhysicsToEntities();
    Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x - 84.8528f) < 0.1f);
    CHECK(std::abs(velocity.y - 84.8528f) < 0.1f);

    f.world.clearMovementIntent(1);
    f.tickFrame(1.f);
    f.physics.step(1.f / 60.f);
    f.world.syncPhysicsToEntities();
    velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x) < 0.01f);
    CHECK(std::abs(velocity.y) < 0.01f);
}

static void test_top_down_four_direction_constraint() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    TopDownControllerComponent tc;
    tc.maxSpeed = 100.f;
    tc.acceleration = 1000.f;
    tc.fourDirections = true;
    player.topDownController = tc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    f.world.setMovementIntent(1, 0.25f, 1.f);
    f.tickFrame(1.f);
    f.physics.step(1.f / 60.f);
    f.world.syncPhysicsToEntities();
    const Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x) < 0.01f);
    CHECK(std::abs(velocity.y - 100.f) < 0.01f);
}

static void test_sensor_edges_are_drained_deterministically() {
    Fixture f;

    EntityDef sensorHost = makeEntity(1, "Coin");
    sensorHost.physics.bodyType = BodyType::Dynamic;
    sensorHost.physics.collider.size = { 32.f, 32.f };
    SensorComponent sensor;
    sensor.shape = "Rectangle";
    sensor.width = 64.f;
    sensor.height = 64.f;
    sensor.targetTag = "player";
    sensorHost.sensor = sensor;

    EntityDef player = makeEntity(2, "Player", {"player"});
    player.physics.bodyType = BodyType::Static;
    player.physics.collider.size = { 32.f, 32.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, sensorHost }, { 2, player }};
    f.world.init(doc);

    f.tickFrame(1.f / 60.f);
    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    CHECK(events[0].entityId == 1);
    CHECK(events[0].otherId == 2);
    CHECK(events[0].targetTag == "player");
    CHECK(events[0].enter);

    CHECK(f.world.pollSensorEdges().empty());

    f.physics.setPosition(f.gw.physicsHandle(2), { 1000.f, 1000.f });
    f.tickFrame(1.f / 60.f);
    events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    CHECK(events[0].entityId == 1);
    CHECK(events[0].otherId == INVALID_ENTITY);
    CHECK(!events[0].enter);
}

static void test_set_sensor_syncs_fixture_after_body() {
    Fixture f;

    EntityDef coin = makeEntity(1, "Coin");
    coin.physics.bodyType = BodyType::Static;
    coin.physics.collider.size = { 32.f, 32.f };

    EntityDef player = makeEntity(2, "Player", {"player"});
    player.physics.bodyType = BodyType::Static;
    player.physics.collider.size = { 32.f, 32.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, coin }, { 2, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) != 0);
    CHECK(f.world.pollSensorEdges().empty());

    SensorComponent sensor;
    sensor.shape = "Circle";
    sensor.radius = 64.f;
    sensor.targetTag = "player";
    CHECK(f.gw.setSensor(1, sensor));

    f.tickFrame(1.f / 60.f);
    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    CHECK(events[0].entityId == 1);
    CHECK(events[0].otherId == 2);
    CHECK(events[0].enter);
}

static void test_set_sensor_replaces_fixture_without_duplicates() {
    Fixture f;

    EntityDef coin = makeEntity(1, "Coin");
    coin.physics.bodyType = BodyType::Static;
    coin.physics.collider.size = { 32.f, 32.f };

    EntityDef player = makeEntity(2, "Player", {"player"});
    player.physics.bodyType = BodyType::Static;
    player.physics.collider.size = { 32.f, 32.f };
    player.transform.position = { 40.f, 0.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, coin }, { 2, player }};
    f.world.init(doc);

    f.tickFrame(1.f / 60.f);
    f.world.pollSensorEdges();

    SensorComponent narrow;
    narrow.shape = "Circle";
    narrow.radius = 8.f;
    narrow.targetTag = "player";
    CHECK(f.gw.setSensor(1, narrow));
    CHECK(f.gw.setSensor(1, narrow));

    f.tickFrame(1.f / 60.f);
    CHECK(f.world.pollSensorEdges().empty());

    f.physics.setPosition(f.gw.physicsHandle(2), { 0.f, 0.f });
    f.tickFrame(1.f / 60.f);
    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    if (events.size() == 1) CHECK(events[0].enter);

    f.tickFrame(1.f / 60.f);
    CHECK(f.world.pollSensorEdges().empty());
}

static void test_set_sensor_creates_body_for_sensor_only_entity() {
    Fixture f;

    EntityDef coin = makeEntity(1, "Coin");

    EntityDef player = makeEntity(2, "Player", {"player"});
    player.physics.bodyType = BodyType::Static;
    player.physics.collider.size = { 32.f, 32.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, coin }, { 2, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);

    SensorComponent sensor;
    sensor.shape = "Circle";
    sensor.radius = 64.f;
    sensor.targetTag = "player";
    CHECK(f.gw.setSensor(1, sensor));
    CHECK(f.gw.physicsHandle(1) != 0);

    f.tickFrame(1.f / 60.f);
    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    if (events.size() == 1) CHECK(events[0].enter);

    CHECK(f.gw.setSensor(1, std::nullopt));
    CHECK(f.gw.physicsHandle(1) == 0);
}

static void test_set_solid_creates_and_removes_static_body() {
    Fixture f;

    EntityDef platform = makeEntity(1, "Platform");

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, platform }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);

    SolidComponent solid;
    solid.groundClass = "Ground";
    CHECK(f.gw.setSolid(1, solid));
    CHECK(f.gw.physicsHandle(1) != 0);

    TopDownControllerComponent topDown;
    CHECK(f.gw.setTopDownController(1, topDown));

    CHECK(f.gw.setSolid(1, std::nullopt));
    CHECK(f.gw.physicsHandle(1) == 0);

    CHECK(f.gw.setTopDownController(1, std::nullopt));
    CHECK(f.gw.physicsHandle(1) == 0);
}

static void test_topdown_only_has_no_implicit_physics_body() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    TopDownControllerComponent tc;
    tc.maxSpeed = 200.f;
    player.topDownController = tc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) == 0);
}

static void test_set_physics_component_replaces_body_without_leak() {
    Fixture f;

    EntityDef block = makeEntity(1, "Block");
    block.physics.bodyType = BodyType::Static;
    block.physics.collider.size = { 32.f, 32.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, block }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) != 0);
    CHECK(!f.physics.getContactingBodies({ 0.f, 0.f }).empty());

    PhysicsComponent noBody;
    CHECK(f.gw.setPhysicsComponent(1, noBody));
    CHECK(f.gw.physicsHandle(1) == 0);
    CHECK(f.physics.getContactingBodies({ 0.f, 0.f }).empty());
}

static void test_linear_mover_moves_transform_without_physics() {
    Fixture f;

    EntityDef bullet = makeEntity(1, "Bullet");
    LinearMoverComponent mover;
    mover.directionX = 3.f;
    mover.directionY = 4.f;
    mover.speed = 100.f;
    bullet.linearMover = mover;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, bullet }};
    f.world.init(doc);

    f.tickFrame(1.f);

    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(std::abs(transform.position.x - 60.f) < 0.01f);
    CHECK(std::abs(transform.position.y - 80.f) < 0.01f);
    CHECK(std::abs(transform.velocity.x - 60.f) < 0.01f);
    CHECK(std::abs(transform.velocity.y - 80.f) < 0.01f);
}

static void test_linear_mover_sets_physics_velocity() {
    Fixture f;

    EntityDef hazard = makeEntity(1, "Hazard");
    hazard.physics.bodyType = BodyType::Kinematic;
    hazard.physics.collider.size = { 16.f, 16.f };
    LinearMoverComponent mover;
    mover.directionX = 0.f;
    mover.directionY = -1.f;
    mover.speed = 75.f;
    hazard.linearMover = mover;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, hazard }};
    f.world.init(doc);

    CHECK(f.gw.physicsHandle(1) != 0);
    f.tickFrame(1.f / 60.f);

    const Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x) < 0.01f);
    CHECK(std::abs(velocity.y + 75.f) < 0.01f);
}

static void test_magnetic_item_pulls_tagged_entity() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 100.f, 100.f };
    MagneticItemComponent mag;
    mag.attractTag = "pickup";
    mag.radius     = 500.f;
    mag.pullSpeed  = 100.f;
    player.magneticItem = mag;

    EntityDef coin = makeEntity(2, "Coin", {"pickup"});
    coin.transform.position = { 200.f, 100.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, coin }};
    f.world.init(doc);

    f.tickFrame(1.f);

    Transform coinTransform{};
    CHECK(f.gw.getTransform(2, coinTransform));
    CHECK(coinTransform.position.x < 200.f);
    CHECK(std::abs(coinTransform.position.y - 100.f) < 0.01f);
}

static void test_horde_member_chases_target_class() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 300.f, 100.f };

    EntityDef enemy = makeEntity(2, "Enemy");
    enemy.transform.position = { 100.f, 100.f };
    HordeMemberComponent horde;
    horde.targetClass = "Player";
    horde.maxSpeed = 100.f;
    horde.separationRadius = 0.f;
    enemy.hordeMember = horde;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, enemy }};
    f.world.init(doc);

    f.tickFrame(1.f);

    Transform enemyTransform{};
    CHECK(f.gw.getTransform(2, enemyTransform));
    CHECK(enemyTransform.position.x > 100.f);
}

static void test_horde_member_separates_from_peer() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 500.f, 100.f };

    HordeMemberComponent horde;
    horde.targetClass = "Player";
    horde.maxSpeed = 80.f;
    horde.separationRadius = 64.f;
    horde.separationWeight = 2.f;
    horde.chaseWeight = 0.f;

    EntityDef a = makeEntity(2, "Enemy");
    a.transform.position = { 100.f, 100.f };
    a.hordeMember = horde;

    EntityDef b = makeEntity(3, "Enemy");
    b.transform.position = { 100.f, 100.f };
    b.hordeMember = horde;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2, 3 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, a }, { 3, b }};
    f.world.init(doc);

    f.tickFrame(0.5f);

    Transform ta{}, tb{};
    CHECK(f.gw.getTransform(2, ta));
    CHECK(f.gw.getTransform(3, tb));
    CHECK(std::abs(ta.position.x - tb.position.x) > 0.5f ||
          std::abs(ta.position.y - tb.position.y) > 0.5f);
}

static void test_auto_destroy_after_lifespan() {
    Fixture f;

    EntityDef timed = makeEntity(1, "TimedPickup", {"pickup"});
    AutoDestroyComponent ad;
    ad.lifespan = 0.5f;
    timed.autoDestroy = ad;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, timed }};
    f.world.init(doc);

    CHECK(f.gw.exists(1));
    f.world.tickAutoDestroy(0.3f);
    CHECK(f.gw.exists(1));
    f.world.tickAutoDestroy(0.3f);
    f.world.flushEntityQueues();
    CHECK(!f.gw.exists(1));
}

static void test_update_entity_preserves_auto_destroy_timer() {
    Fixture f;

    EntityDef coin = makeEntity(1, "Coin", {"pickup"});
    AutoDestroyComponent ad;
    ad.lifespan = 10.f;
    coin.autoDestroy = ad;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, coin }};
    f.world.init(doc);

    f.world.tickAutoDestroy(2.f);
    AutoDestroyComponent running{};
    CHECK(f.gw.getAutoDestroy(1, running));
    CHECK(running._timeAlive >= 1.99f);

    EntityDef patch = coin;
    patch.transform.position = { 50.f, 50.f };
    CHECK(f.gw.updateEntity(1, patch));

    AutoDestroyComponent after{};
    CHECK(f.gw.getAutoDestroy(1, after));
    CHECK(after._timeAlive >= 1.99f);
    CHECK(after.lifespan == 10.f);
}

static void test_health_damage_respects_iframes() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    HealthComponent hc;
    hc.maxHp = 100.f;
    hc.currentHp = 100.f;
    hc.iFrames = 0.2f;
    player.health = hc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.gw.applyDamage(1, 10.f));
    HealthComponent h{};
    CHECK(f.gw.getHealth(1, h));
    CHECK(h.currentHp == 90.f);
    CHECK(h._iFramesRemaining > 0.f);

    CHECK(!f.gw.applyDamage(1, 10.f));
    CHECK(f.gw.getHealth(1, h));
    CHECK(h.currentHp == 90.f);

    f.tickFrame(0.25f);
    CHECK(f.gw.applyDamage(1, 10.f));
    CHECK(f.gw.getHealth(1, h));
    CHECK(h.currentHp == 80.f);
}

static void test_linear_mover_pause_stops_movement() {
    Fixture f;

    EntityDef bullet = makeEntity(1, "Bullet");
    LinearMoverComponent mover;
    mover.directionX = 1.f;
    mover.directionY = 0.f;
    mover.speed = 100.f;
    bullet.linearMover = mover;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, bullet }};
    f.world.init(doc);

    f.tickFrame(1.f);

    Transform moved{};
    CHECK(f.gw.getTransform(1, moved));
    CHECK(std::abs(moved.position.x - 100.f) < 0.01f);

    LinearMoverComponent paused = mover;
    paused._paused = true;
    CHECK(f.gw.setLinearMover(1, paused));

    f.tickFrame(1.f);

    Transform afterPause{};
    CHECK(f.gw.getTransform(1, afterPause));
    CHECK(std::abs(afterPause.position.x - 100.f) < 0.01f);
}

static void test_magnetic_item_disabled_stops_pull() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 100.f, 100.f };
    MagneticItemComponent mag;
    mag.attractTag = "pickup";
    mag.radius     = 500.f;
    mag.pullSpeed  = 100.f;
    mag._enabled   = false;
    player.magneticItem = mag;

    EntityDef coin = makeEntity(2, "Coin", {"pickup"});
    coin.transform.position = { 200.f, 100.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, coin }};
    f.world.init(doc);

    f.tickFrame(1.f);

    Transform coinTransform{};
    CHECK(f.gw.getTransform(2, coinTransform));
    CHECK(std::abs(coinTransform.position.x - 200.f) < 0.01f);
}

static void test_auto_destroy_cancel_disables_timer() {
    Fixture f;

    EntityDef coin = makeEntity(1, "Coin");
    AutoDestroyComponent ad;
    ad.lifespan = 0.5f;
    coin.autoDestroy = ad;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, coin }};
    f.world.init(doc);

    AutoDestroyComponent cancelled = ad;
    cancelled.lifespan = 0.f;
    cancelled._timeAlive = 0.f;
    CHECK(f.gw.setAutoDestroy(1, cancelled));

    f.world.tickAutoDestroy(1.f);
    CHECK(f.gw.exists(1));
}

// ---- Tilemap platformer grounding (shared surface engine with Solid) ----

static void initTilemapGrid(SceneDef& scene,
                            int cols = 20,
                            int rows = 10,
                            float tileSize = 32.f)
{
    scene.tilemap.tileSize = tileSize;
    scene.tilemap.cols     = cols;
    scene.tilemap.rows     = rows;
    scene.tilemap.data.assign(static_cast<size_t>(cols * rows), 0);
}

static void paintTileRow(SceneDef& scene,
                         int row,
                         int col0,
                         int col1,
                         int tileId)
{
    if (scene.tilemap.cols <= 0)
        initTilemapGrid(scene);
    const int cols = scene.tilemap.cols;
    for (int c = col0; c <= col1; ++c) {
        if (c < 0 || c >= cols || row < 0 || row >= scene.tilemap.rows)
            continue;
        scene.tilemap.data[static_cast<size_t>(row * cols + c)] = tileId;
    }
}

static TilePaletteEntry makeGroundPaletteTile(int id = 1)
{
    TilePaletteEntry t;
    t.id          = id;
    t.name        = "Ground";
    t.solid       = true;
    t.groundClass = "Ground";
    t.surfaceKind = "solid";
    return t;
}

static TilePaletteEntry makeOneWayPaletteTile(int id = 6)
{
    TilePaletteEntry t = makeGroundPaletteTile(id);
    t.name        = "OneWay";
    t.surfaceKind = "oneWay";
    return t;
}

static void test_platformer_snaps_to_tilemap_after_fall() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 80.f };
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    pc.groundClass   = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene);
    paintTileRow(scene, 6, 0, 10, 1);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeGroundPaletteTile(1) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    for (int i = 0; i < 90; ++i)
        f.tickFrame(dt);

    CHECK(f.world.isPlatformerGrounded(1));
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(std::abs(transform.velocity.y) < 0.01f);
}

static void test_platformer_grounded_on_tilemap_only() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 176.f };
    PlatformerControllerComponent pc;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene);
    paintTileRow(scene, 6, 4, 6, 1);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeGroundPaletteTile(1) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
}

static void test_platformer_coyote_jump_after_leaving_tilemap() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.transform.position = { 176.f, 176.f };
    PlatformerControllerComponent pc;
    pc.jumpForce   = 500.f;
    pc.coyoteTime  = 0.2f;
    pc.jumpBuffer  = 0.15f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene);
    paintTileRow(scene, 6, 4, 6, 1);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeGroundPaletteTile(1) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));

    const float dt = 1.f / 60.f;
    bool jumped = false;
    Transform transform{};
    for (int i = 0; i < 18; ++i) {
        f.world.setMovementIntent(1, 1.f, 0.f);
        if (i == 4) f.world.requestJump(1);
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        if (transform.velocity.y < -499.f) jumped = true;
    }

    CHECK(jumped);
    CHECK(!f.world.isPlatformerGrounded(1));
}

static void test_platformer_blocks_tilemap_ceiling_when_jumping() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 379.f };
    PlatformerControllerComponent pc;
    pc.jumpForce   = 700.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene, 20, 14);
    paintTileRow(scene, 6, 0, 10, 1);
    paintTileRow(scene, 12, 0, 10, 1);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeGroundPaletteTile(1) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
    f.world.requestJump(1);
    const float dt = 1.f / 60.f;
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    const float startY = transform.position.y;
    float peakY        = startY;

    for (int i = 0; i < 25; ++i) {
        f.tickFrame(dt);
        CHECK(f.gw.getTransform(1, transform));
        peakY = std::min(peakY, transform.position.y);
    }

    CHECK(peakY > 220.f);
    CHECK(peakY < startY - 40.f);
}

static void test_platformer_blocks_tilemap_wall_horizontally() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 80.f, 368.f };
    PlatformerControllerComponent pc;
    pc.maxSpeed    = 300.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene, 20, 14);
    paintTileRow(scene, 12, 0, 10, 1);
    for (int r = 8; r <= 12; ++r)
        paintTileRow(scene, r, 6, 6, 1);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeGroundPaletteTile(1) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    Transform transform{};
    for (int i = 0; i < 30; ++i) {
        f.world.setMovementIntent(1, 1.f, 0.f);
        f.tickFrame(dt);
    }

    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.position.x <= 176.5f);
}

static void test_platformer_passes_through_one_way_tile_when_jumping() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 176.f };
    PlatformerControllerComponent pc;
    pc.jumpForce   = 600.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene);
    paintTileRow(scene, 6, 0, 10, 6);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeOneWayPaletteTile(6) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
    f.world.requestJump(1);
    f.tickFrame(1.f / 60.f);

    CHECK(!f.world.isPlatformerGrounded(1));
    Transform transform{};
    CHECK(f.gw.getTransform(1, transform));
    CHECK(transform.velocity.y < -500.f);
    CHECK(transform.position.y < 176.f);
}

static void test_platformer_lands_on_one_way_tile_when_falling() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 80.f };
    PlatformerControllerComponent pc;
    pc.customGravity = 1500.f;
    pc.groundClass   = "Ground";
    player.platformerController = pc;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1 };
    initTilemapGrid(scene);
    paintTileRow(scene, 6, 0, 10, 6);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeOneWayPaletteTile(6) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }};
    f.world.init(doc);

    const float dt = 1.f / 60.f;
    for (int i = 0; i < 90; ++i)
        f.tickFrame(dt);

    CHECK(f.world.isPlatformerGrounded(1));
}

static void test_platformer_grounded_on_tilemap_and_solid_together() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 160.f, 176.f };
    PlatformerControllerComponent pc;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef ramp = makeEntity(2, "Ramp");
    ramp.transform.position = { 240.f, 200.f };
    ramp.transform.scale    = { 2.f, 0.3125f };
    SolidComponent solid;
    solid.groundClass = "Ground";
    ramp.solid = solid;

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };
    initTilemapGrid(scene);
    paintTileRow(scene, 6, 0, 6, 1);

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.tilePalette   = { makeGroundPaletteTile(1) };
    doc.scenes        = {{ scene.id, scene }};
    doc.entities      = {{ 1, player }, { 2, ramp } };
    f.world.init(doc);

    CHECK(f.world.isPlatformerGrounded(1));
}

static ProjectDoc makeTileSceneDoc() {
    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 16.f, 16.f };
    TopDownControllerComponent topDown;
    topDown.maxSpeed = 100.f;
    topDown.acceleration = 1000.f;
    topDown.friction = 1000.f;
    player.topDownController = topDown;

    EntityDef sensorHost = makeEntity(2, "Coin");
    sensorHost.physics.bodyType = BodyType::Static;
    sensorHost.physics.collider.size = { 16.f, 16.f };
    SensorComponent sensor;
    sensor.shape = "Circle";
    sensor.radius = 32.f;
    sensor.targetTag = "player";
    sensorHost.sensor = sensor;

    SceneDef sceneA;
    sceneA.id = "scene_a";
    sceneA.entityIds = { 1, 2 };
    sceneA.tilemap.tileSize = 32.f;
    sceneA.tilemap.cols = 2;
    sceneA.tilemap.rows = 1;
    sceneA.tilemap.data = { 0, 1 };

    SceneDef sceneB;
    sceneB.id = "scene_b";
    sceneB.entityIds = { 1, 2 };

    TilePaletteEntry solidTile;
    solidTile.id = 1;
    solidTile.solid = true;

    ProjectDoc doc;
    doc.activeSceneId = "scene_a";
    doc.tilePalette = { solidTile };
    doc.scenes = {{ sceneA.id, sceneA }, { sceneB.id, sceneB }};
    doc.entities = {{ 1, player }, { 2, sensorHost }};
    return doc;
}

static void test_load_scene_rebuilds_tilemap_physics() {
    Fixture f;
    f.world.init(makeTileSceneDoc());

    CHECK(!f.physics.getContactingBodies({ 48.f, 16.f }).empty());
    CHECK(f.world.loadScene("scene_b"));
    CHECK(f.physics.getContactingBodies({ 48.f, 16.f }).empty());
}

static void test_load_scene_resets_runtime_state() {
    Fixture f;
    f.world.init(makeTileSceneDoc());

    f.world.setMovementIntent(1, 1.f, 0.f);
    f.tickFrame(1.f / 60.f);
    CHECK(!f.world.pollSensorEdges().empty());

    CHECK(f.world.loadScene("scene_b"));
    f.tickFrame(1.f / 60.f);

    const Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x) < 0.01f);

    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    if (events.size() == 1) CHECK(events[0].enter);
}

static void test_shutdown_clears_tilemap_physics() {
    Fixture f;
    f.world.init(makeTileSceneDoc());

    CHECK(!f.physics.getContactingBodies({ 48.f, 16.f }).empty());
    f.world.shutdown();
    CHECK(f.physics.getContactingBodies({ 48.f, 16.f }).empty());
}

static void test_restore_design_state_resets_runtime_from_doc() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player");
    player.transform.position = { 50.f, 80.f };

    ProjectDoc doc;
    doc.activeSceneId = "s";
    doc.entities[1] = player;
    SceneDef scene;
    scene.id = "s";
    scene.entityIds = { 1 };
    doc.scenes["s"] = scene;

    f.world.init(doc);

    f.gw.setTransform(1, { 200.f, 300.f }, 0.f, { 1.f, 1.f });
    f.vars.setInt("score", 42);
    f.world.setMovementIntent(1, 1.f, 0.f);

    f.gw.replaceProject(doc.scenes, doc.entities, doc.activeSceneId);
    f.world.restoreDesignState(doc.tilePalette);

    Transform t{};
    CHECK(f.gw.getTransform(1, t));
    CHECK(std::abs(t.position.x - 50.f) < 0.01f);
    CHECK(std::abs(t.position.y - 80.f) < 0.01f);
    CHECK(!f.vars.exists("score"));
}

int main() {
    test_platformer_only_has_no_implicit_physics_body();
    test_platformer_kinematic_falls_with_custom_gravity();
    test_platformer_kinematic_horizontal_movement_without_body();
    test_platformer_is_grounded_false_when_airborne_over_solid();
    test_platformer_coyote_jump_after_leaving_solid();
    test_platformer_snaps_to_solid_after_fall();
    test_platformer_stays_centered_on_wide_solid_after_land();
    test_platformer_grounded_with_feet_slightly_below_solid_top();
    test_platformer_blocks_solid_underside_when_jumping_up();
    test_platformer_blocks_solid_wall_horizontally();
    test_platformer_passes_under_solid_at_horizontal_edges();
    test_platformer_passes_through_one_way_when_jumping_up();
    test_platformer_passes_through_thick_one_way_while_rising();
    test_platformer_lands_on_one_way_when_falling();
    test_platformer_grounded_on_solid_without_player_physics();
    test_platformer_with_physics_collider_is_kinematic_body();
    test_platformer_movement_intent_without_input();
    test_platformer_jump_request_rising_edge_dedupes_hold();
    test_platformer_gravity_while_moving_in_air_after_jump();
    test_platformer_same_frame_multiple_request_jump();
    test_platformer_jump_intent_without_input();
    test_platformer_grounded_by_solid_component();
    test_platformer_grounded_on_scaled_solid_platform();
    test_scaled_solid_rebuilds_physics_on_transform();
    test_top_down_movement_intent_without_input();
    test_top_down_four_direction_constraint();
    test_sensor_edges_are_drained_deterministically();
    test_set_sensor_syncs_fixture_after_body();
    test_set_sensor_replaces_fixture_without_duplicates();
    test_set_sensor_creates_body_for_sensor_only_entity();
    test_set_solid_creates_and_removes_static_body();
    test_topdown_only_has_no_implicit_physics_body();
    test_set_physics_component_replaces_body_without_leak();
    test_linear_mover_moves_transform_without_physics();
    test_linear_mover_sets_physics_velocity();
    test_linear_mover_pause_stops_movement();
    test_magnetic_item_pulls_tagged_entity();
    test_magnetic_item_disabled_stops_pull();
    test_horde_member_chases_target_class();
    test_horde_member_separates_from_peer();
    test_auto_destroy_after_lifespan();
    test_auto_destroy_cancel_disables_timer();
    test_update_entity_preserves_auto_destroy_timer();
    test_health_damage_respects_iframes();
    test_load_scene_rebuilds_tilemap_physics();
    test_load_scene_resets_runtime_state();
    test_shutdown_clears_tilemap_physics();
    test_restore_design_state_resets_runtime_from_doc();
    test_platformer_snaps_to_tilemap_after_fall();
    test_platformer_grounded_on_tilemap_only();
    test_platformer_coyote_jump_after_leaving_tilemap();
    test_platformer_blocks_tilemap_ceiling_when_jumping();
    test_platformer_blocks_tilemap_wall_horizontally();
    test_platformer_passes_through_one_way_tile_when_jumping();
    test_platformer_lands_on_one_way_tile_when_falling();
    test_platformer_grounded_on_tilemap_and_solid_together();

    std::cout << "world-intent-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

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
};

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
    f.world.tickGameplaySystems(1.f / 60.f);
    Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x - 250.f) < 0.01f);

    f.world.clearMovementIntent(1);
    f.world.tickGameplaySystems(1.f / 60.f);
    velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x) < 0.01f);
}

static void test_platformer_jump_intent_without_input() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 500.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef ground = makeEntity(2, "Ground");
    ground.physics.bodyType = BodyType::Static;
    ground.physics.collider.size = { 64.f, 64.f };

    SceneDef scene;
    scene.id = "main";
    scene.entityIds = { 1, 2 };

    ProjectDoc doc;
    doc.activeSceneId = "main";
    doc.scenes = {{ scene.id, scene }};
    doc.entities = {{ 1, player }, { 2, ground }};
    f.world.init(doc);

    f.world.requestJump(1);
    f.world.tickGameplaySystems(1.f / 60.f);
    const Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(velocity.y < -499.f);
}

static void test_platformer_grounded_by_solid_component() {
    Fixture f;

    EntityDef player = makeEntity(1, "Player", {"player"});
    player.physics.bodyType = BodyType::Dynamic;
    player.physics.collider.size = { 32.f, 32.f };
    PlatformerControllerComponent pc;
    pc.jumpForce = 420.f;
    pc.groundClass = "Ground";
    player.platformerController = pc;

    EntityDef platform = makeEntity(2, "Platform");
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
    f.world.requestJump(1);
    f.world.tickGameplaySystems(1.f / 60.f);
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
        f.world.tickGameplaySystems(1.f / 60.f);

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
    f.world.tickGameplaySystems(1.f);
    f.physics.step(1.f / 60.f);
    f.world.syncPhysicsToEntities();
    Vec2 velocity = f.physics.getLinearVelocity(f.gw.physicsHandle(1));
    CHECK(std::abs(velocity.x - 84.8528f) < 0.1f);
    CHECK(std::abs(velocity.y - 84.8528f) < 0.1f);

    f.world.clearMovementIntent(1);
    f.world.tickGameplaySystems(1.f);
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
    f.world.tickGameplaySystems(1.f);
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

    f.world.tickGameplaySystems(1.f / 60.f);
    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    CHECK(events[0].entityId == 1);
    CHECK(events[0].otherId == 2);
    CHECK(events[0].targetTag == "player");
    CHECK(events[0].enter);

    CHECK(f.world.pollSensorEdges().empty());

    f.physics.setPosition(f.gw.physicsHandle(2), { 1000.f, 1000.f });
    f.world.tickGameplaySystems(1.f / 60.f);
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

    f.world.tickGameplaySystems(1.f / 60.f);
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

    f.world.tickGameplaySystems(1.f / 60.f);
    f.world.pollSensorEdges();

    SensorComponent narrow;
    narrow.shape = "Circle";
    narrow.radius = 8.f;
    narrow.targetTag = "player";
    CHECK(f.gw.setSensor(1, narrow));
    CHECK(f.gw.setSensor(1, narrow));

    f.world.tickGameplaySystems(1.f / 60.f);
    CHECK(f.world.pollSensorEdges().empty());

    f.physics.setPosition(f.gw.physicsHandle(2), { 0.f, 0.f });
    f.world.tickGameplaySystems(1.f / 60.f);
    auto events = f.world.pollSensorEdges();
    CHECK(events.size() == 1);
    if (events.size() == 1) CHECK(events[0].enter);

    f.world.tickGameplaySystems(1.f / 60.f);
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

    f.world.tickGameplaySystems(1.f / 60.f);
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
    CHECK(f.gw.physicsHandle(1) != 0);
    PhysicsComponent physics{};
    CHECK(f.gw.getPhysicsComponent(1, physics));
    CHECK(physics.physicsHandle == f.gw.physicsHandle(1));

    CHECK(f.gw.setTopDownController(1, std::nullopt));
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

    f.world.tickGameplaySystems(1.f);

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
    f.world.tickGameplaySystems(1.f / 60.f);

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

    f.world.tickGameplaySystems(1.f);

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

    f.world.tickGameplaySystems(1.f);

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

    f.world.tickGameplaySystems(0.5f);

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

    f.world.tickGameplaySystems(0.25f);
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

    f.world.tickGameplaySystems(1.f);

    Transform moved{};
    CHECK(f.gw.getTransform(1, moved));
    CHECK(std::abs(moved.position.x - 100.f) < 0.01f);

    LinearMoverComponent paused = mover;
    paused._paused = true;
    CHECK(f.gw.setLinearMover(1, paused));

    f.world.tickGameplaySystems(1.f);

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

    f.world.tickGameplaySystems(1.f);

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
    f.world.tickGameplaySystems(1.f / 60.f);
    CHECK(!f.world.pollSensorEdges().empty());

    CHECK(f.world.loadScene("scene_b"));
    f.world.tickGameplaySystems(1.f / 60.f);

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
    test_platformer_movement_intent_without_input();
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

    std::cout << "world-intent-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

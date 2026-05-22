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

int main() {
    test_platformer_movement_intent_without_input();
    test_platformer_jump_intent_without_input();
    test_top_down_movement_intent_without_input();
    test_top_down_four_direction_constraint();
    test_sensor_edges_are_drained_deterministically();
    test_set_sensor_syncs_fixture_after_body();
    test_set_sensor_replaces_fixture_without_duplicates();
    test_linear_mover_moves_transform_without_physics();
    test_linear_mover_sets_physics_velocity();
    test_magnetic_item_pulls_tagged_entity();
    test_horde_member_chases_target_class();
    test_horde_member_separates_from_peer();

    std::cout << "world-intent-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

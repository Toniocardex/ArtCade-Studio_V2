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

int main() {
    test_platformer_movement_intent_without_input();
    test_platformer_jump_intent_without_input();
    test_sensor_edges_are_drained_deterministically();
    test_set_sensor_syncs_fixture_after_body();

    std::cout << "world-intent-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}


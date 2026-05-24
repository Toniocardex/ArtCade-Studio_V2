// scene-gateway-test.cpp — RuntimeEntityGateway scene activation + global state

#include "modules/scene-system/include/scene-manager.h"
#include "modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "modules/physics/include/physics.h"
#include "modules/variable-manager/include/variable-manager.h"
#include <algorithm>
#include <iostream>

using namespace ArtCade;
using namespace ArtCade::Modules;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

int main() {
    SceneManager  sm;
    RuntimeEntityGateway gw(sm);
    VariableManager vm;
    Physics physics;

    sm.init();
    gw.init();
    vm.init();
    physics.init();
    gw.setPhysics(&physics);

    EntityDef player;
    player.id = 1;
    player.className = "Player";
    player.name = "Player";
    PlatformerControllerComponent playerController;
    playerController.groundClass = "Ground";
    player.platformerController = playerController;
    TopDownControllerComponent topDownController;
    topDownController.maxSpeed = 180.f;
    topDownController.fourDirections = true;
    player.topDownController = topDownController;
    LinearMoverComponent linearMover;
    linearMover.directionX = 0.f;
    linearMover.directionY = -1.f;
    linearMover.speed = 120.f;
    player.linearMover = linearMover;
    CameraTargetComponent cameraTarget;
    cameraTarget.offsetX = 10.f;
    cameraTarget.offsetY = -20.f;
    cameraTarget.followSpeed = 12.f;
    player.cameraTarget = cameraTarget;
    MagneticItemComponent magneticItem;
    magneticItem.attractTag = "pickup";
    magneticItem.radius = 180.f;
    magneticItem.pullSpeed = 350.f;
    player.magneticItem = magneticItem;
    HordeMemberComponent hordeMember;
    hordeMember.targetClass = "Player";
    hordeMember.maxSpeed = 90.f;
    hordeMember.separationRadius = 40.f;
    player.hordeMember = hordeMember;

    EntityDef coin;
    coin.id = 2;
    coin.className = "Coin";
    coin.name = "Coin";
    coin.sprite.spriteAssetId = "sprites/coin.png";
    coin.sprite.alpha = 1.f;
    coin.tags = { "pickup" };
    SensorComponent coinSensor;
    coinSensor.targetTag = "player";
    coin.sensor = coinSensor;
    SolidComponent coinSolid;
    coinSolid.groundClass = "PickupFloor";
    coin.solid = coinSolid;
    AutoDestroyComponent coinAutoDestroy;
    coinAutoDestroy.lifespan = 2.f;
    coin.autoDestroy = coinAutoDestroy;

    SceneDef sceneA;
    sceneA.id = "scene_a";
    sceneA.name = "A";
    sceneA.entityIds = { 1, 2 };

    SceneDef sceneB;
    sceneB.id = "scene_b";
    sceneB.name = "B";
    sceneB.entityIds = { 2 };

    std::unordered_map<SceneId, SceneDef> scenes{
        { sceneA.id, sceneA },
        { sceneB.id, sceneB },
    };
    std::unordered_map<EntityId, EntityDef> entities{
        { player.id, player },
        { coin.id, coin },
    };

    CHECK(gw.replaceProject(scenes, entities, "scene_a"));
    CHECK(gw.poolCount("Player") == 1);
    CHECK(gw.poolCount("Coin") == 1);
    PlatformerControllerComponent loadedController{};
    CHECK(gw.getPlatformerController(1, loadedController));
    CHECK(loadedController.groundClass == "Ground");
    TopDownControllerComponent loadedTopDown{};
    CHECK(gw.getTopDownController(1, loadedTopDown));
    CHECK(loadedTopDown.maxSpeed == 180.f);
    CHECK(loadedTopDown.fourDirections);
    LinearMoverComponent loadedMover{};
    CHECK(gw.getLinearMover(1, loadedMover));
    CHECK(loadedMover.directionY == -1.f);
    CHECK(loadedMover.speed == 120.f);
    CameraTargetComponent loadedCamera{};
    CHECK(gw.getCameraTarget(1, loadedCamera));
    CHECK(std::abs(loadedCamera.offsetX - 10.f) < 0.01f);
    CHECK(std::abs(loadedCamera.offsetY + 20.f) < 0.01f);
    CHECK(std::abs(loadedCamera.followSpeed - 12.f) < 0.01f);
    MagneticItemComponent loadedMagnet{};
    CHECK(gw.getMagneticItem(1, loadedMagnet));
    CHECK(loadedMagnet.attractTag == "pickup");
    CHECK(std::abs(loadedMagnet.radius - 180.f) < 0.01f);
    CHECK(std::abs(loadedMagnet.pullSpeed - 350.f) < 0.01f);
    HordeMemberComponent loadedHorde{};
    CHECK(gw.getHordeMember(1, loadedHorde));
    CHECK(loadedHorde.targetClass == "Player");
    CHECK(std::abs(loadedHorde.maxSpeed - 90.f) < 0.01f);
    CHECK(std::abs(loadedHorde.separationRadius - 40.f) < 0.01f);

    const EntityId spawned = gw.spawnFromClass("Coin", 50.f, 60.f);
    CHECK(spawned != 0);
    CHECK(gw.poolCount("Coin") == 2);
    CHECK(gw.exists(spawned) && gw.isEntityActiveInScene(spawned));
    SpriteComponent spawnedSprite{};
    CHECK(gw.getSprite(spawned, spawnedSprite));
    CHECK(spawnedSprite.spriteAssetId == "sprites/coin.png");
    spawnedSprite.alpha = 0.5f;
    CHECK(gw.setSprite(spawned, spawnedSprite));
    SpriteComponent updatedSprite{};
    CHECK(gw.getSprite(spawned, updatedSprite));
    CHECK(updatedSprite.alpha == 0.5f);
    Transform spawnedTransform{};
    CHECK(gw.getTransform(spawned, spawnedTransform));
    CHECK(spawnedTransform.position.x == 50.f);
    CHECK(spawnedTransform.position.y == 60.f);
    spawnedTransform.position = { 70.f, 80.f };
    CHECK(gw.setTransform(spawned, spawnedTransform));
    Transform movedTransform{};
    CHECK(gw.getTransform(spawned, movedTransform));
    CHECK(movedTransform.position.x == 70.f);
    CHECK(movedTransform.position.y == 80.f);
    PhysicsComponent spawnedPhysics{};
    spawnedPhysics.collider.size = { 24.f, 28.f };
    CHECK(gw.setPhysicsComponent(spawned, spawnedPhysics));
    PhysicsComponent updatedPhysics{};
    CHECK(gw.getPhysicsComponent(spawned, updatedPhysics));
    CHECK(updatedPhysics.collider.size.x == 24.f);
    CHECK(updatedPhysics.collider.size.y == 28.f);
    SensorComponent spawnedSensor{};
    CHECK(gw.getSensor(spawned, spawnedSensor));
    CHECK(spawnedSensor.targetTag == "player");
    SolidComponent spawnedSolid{};
    CHECK(gw.getSolid(spawned, spawnedSolid));
    CHECK(spawnedSolid.groundClass == "PickupFloor");
    AutoDestroyComponent spawnedAutoDestroy{};
    CHECK(gw.getAutoDestroy(spawned, spawnedAutoDestroy));
    CHECK(spawnedAutoDestroy.lifespan == 2.f);
    spawnedAutoDestroy._timeAlive = 1.f;
    CHECK(gw.setAutoDestroy(spawned, spawnedAutoDestroy));
    AutoDestroyComponent updatedAutoDestroy{};
    CHECK(gw.getAutoDestroy(spawned, updatedAutoDestroy));
    CHECK(updatedAutoDestroy._timeAlive == 1.f);
    const SceneDef* sceneAfter = gw.activeScene();
    CHECK(sceneAfter && std::find(sceneAfter->entityIds.begin(),
                                sceneAfter->entityIds.end(), spawned)
                           != sceneAfter->entityIds.end());

    vm.setInt("score", 42);
    vm.setInt("lives", 3);

    CHECK(gw.loadScene("scene_b"));
    CHECK(gw.poolCount("Player") == 0);
    CHECK(gw.poolCount("Coin") == 1);
    CHECK(vm.getInt("score") == 42);
    CHECK(vm.getInt("lives") == 3);

    CHECK(gw.exists(2) && gw.isEntityActiveInScene(2));
    CHECK(gw.exists(1) && !gw.isEntityActiveInScene(1));

    // Kill queue: destroy deferred until flush
    CHECK(gw.exists(2));
    gw.queueDestroy(2);
    CHECK(gw.exists(2));
    gw.flushPendingOperations();
    CHECK(!gw.exists(2));

    CHECK(gw.loadScene("scene_a"));
    CHECK(gw.poolCount("Player") == 1);
    CHECK(gw.poolCount("Coin") == 1);
    SpriteComponent reactivatedSpawnedSprite{};
    CHECK(gw.getSprite(spawned, reactivatedSpawnedSprite));
    CHECK(reactivatedSpawnedSprite.alpha == 0.5f);
    const SceneDef* sceneAfterDestroy = gw.activeScene();
    CHECK(sceneAfterDestroy &&
          std::find(sceneAfterDestroy->entityIds.begin(),
                    sceneAfterDestroy->entityIds.end(), 2)
              == sceneAfterDestroy->entityIds.end());

    gw.shutdown();
    sm.shutdown();
    vm.shutdown();
    physics.shutdown();

    std::cout << "scene-gateway-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

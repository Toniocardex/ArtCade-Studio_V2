// scene-gateway-test.cpp — RuntimeEntityGateway scene activation + global state

#include "modules/entity-system/include/entity-manager.h"
#include "modules/scene-system/include/scene-manager.h"
#include "modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "modules/physics/include/physics.h"
#include "modules/variable-manager/include/variable-manager.h"
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
    EntityManager em;
    SceneManager  sm(em);
    RuntimeEntityGateway gw(em, sm);
    VariableManager vm;
    Physics physics;

    em.init();
    sm.init();
    gw.init();
    vm.init();
    physics.init();
    gw.setPhysics(&physics);

    EntityDef player;
    player.id = 1;
    player.className = "Player";
    player.name = "Player";

    EntityDef coin;
    coin.id = 2;
    coin.className = "Coin";
    coin.name = "Coin";

    SceneDef sceneA;
    sceneA.id = "scene_a";
    sceneA.name = "A";
    sceneA.entityIds = { 1 };

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
    CHECK(gw.poolCount("Coin") == 0);

    vm.setInt("score", 42);
    vm.setInt("lives", 3);

    CHECK(gw.loadScene("scene_b"));
    CHECK(gw.poolCount("Player") == 0);
    CHECK(gw.poolCount("Coin") == 1);
    CHECK(vm.getInt("score") == 42);
    CHECK(vm.getInt("lives") == 3);

    const EntityDef* c = gw.get(2);
    CHECK(c && c->runtime.sceneActive);
    const EntityDef* p = gw.get(1);
    CHECK(p && !p->runtime.sceneActive);

    // Kill queue: destroy deferred until flush
    CHECK(gw.exists(2));
    gw.queueDestroy(2);
    CHECK(gw.exists(2));
    gw.flushPendingOperations();
    CHECK(!gw.exists(2));

    gw.shutdown();
    em.shutdown();
    sm.shutdown();
    vm.shutdown();
    physics.shutdown();

    std::cout << "scene-gateway-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

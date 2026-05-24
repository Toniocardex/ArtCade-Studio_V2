// asset-loader-test.cpp — ProjectDoc JSON parsing for gameplay components.

#include "modules/asset-system/include/asset-loader.h"

#include <cmath>
#include <iostream>
#include <string>

using namespace ArtCade;
using namespace ArtCade::Modules;

#ifndef ARTCADE_SOURCE_ROOT
#define ARTCADE_SOURCE_ROOT "."
#endif

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

static void test_physics_health_sensor_from_project_json() {
    AssetLoader loader;
    loader.init();

    ProjectDoc doc;
    const std::string root = std::string(ARTCADE_SOURCE_ROOT) + "/test-project";
    CHECK(loader.loadDirectory(root, doc));

    const auto playerIt = doc.entities.find(1);
    CHECK(playerIt != doc.entities.end());
    const EntityDef& player = playerIt->second;

    CHECK(player.physics.bodyType == BodyType::Static);
    CHECK(std::abs(player.physics.collider.size.x - 52.f) < 0.01f);
    CHECK(std::abs(player.physics.collider.size.y - 52.f) < 0.01f);
    CHECK(player.health.has_value());
    CHECK(std::abs(player.health->maxHp - 100.f) < 0.01f);

    const auto coinIt = doc.entities.find(4);
    CHECK(coinIt != doc.entities.end());
    CHECK(coinIt->second.sensor.has_value());
    CHECK(std::abs(coinIt->second.sensor->radius - 30.f) < 0.01f);

    const auto enemyIt = doc.entities.find(2);
    CHECK(enemyIt != doc.entities.end());
    CHECK(enemyIt->second.physics.bodyType == BodyType::Kinematic);
    CHECK(enemyIt->second.sensor.has_value());

    const auto ballIt = doc.entities.find(6);
    CHECK(ballIt != doc.entities.end());
    CHECK(ballIt->second.physics.bodyType == BodyType::Dynamic);

    loader.shutdown();
}

int main() {
    test_physics_health_sensor_from_project_json();

    std::cout << "asset-loader-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

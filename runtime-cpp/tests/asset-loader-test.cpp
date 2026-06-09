// asset-loader-test.cpp — ProjectDoc JSON parsing for gameplay components.

#include "modules/asset-system/include/asset-loader.h"

#include <cmath>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

using namespace ArtCade;
using namespace ArtCade::Modules;
namespace fs = std::filesystem;

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

static void test_invalid_hex_color_falls_back_without_crash() {
    const fs::path tmpDir = fs::temp_directory_path() / "artcade_asset_loader_bad_color";
    fs::create_directories(tmpDir);
    {
        std::ofstream f(tmpDir / "project.json");
        f << R"({
  "projectName": "BadColor",
  "activeSceneId": "s1",
  "entities": {},
  "scenes": { "s1": { "id": "s1", "name": "S1", "entityIds": [] } },
  "tilePalette": [{ "id": 1, "name": "Broken", "color": "#zzzzzz", "solid": false }]
})";
    }

    AssetLoader loader;
    loader.init();
    ProjectDoc doc;
    CHECK(loader.loadDirectory(tmpDir.string(), doc));
    CHECK(doc.tilePalette.size() == 1);
    if (!doc.tilePalette.empty()) {
        CHECK(std::abs(doc.tilePalette[0].color.r - 0.5f) < 0.01f);
        CHECK(std::abs(doc.tilePalette[0].color.g - 0.5f) < 0.01f);
        CHECK(std::abs(doc.tilePalette[0].color.b - 0.5f) < 0.01f);
        CHECK(std::abs(doc.tilePalette[0].color.a - 1.f) < 0.01f);
    }
    loader.shutdown();
    fs::remove_all(tmpDir);
}

static void test_object_types_physics_from_project_json() {
    const fs::path tmpDir =
        fs::temp_directory_path() / "artcade_asset_loader_v2_physics";
    fs::create_directories(tmpDir);
    {
        std::ofstream f(tmpDir / "project.json");
        f << R"({
  "projectName": "V2Physics",
  "activeSceneId": "s1",
  "objectTypes": {
    "Hero": {
      "id": "Hero",
      "displayName": "Hero",
      "physics": {
        "bodyType": "Static",
        "collider": {
          "shape": "Rectangle",
          "size": { "x": 64, "y": 32 },
          "offset": { "x": 0, "y": 0 },
          "density": 1,
          "friction": 0.5,
          "isSensor": false
        }
      }
    }
  },
  "scenes": {
    "s1": {
      "id": "s1",
      "name": "S1",
      "instances": [{ "id": 1, "typeId": "Hero", "name": "Hero_1" }]
    }
  }
})";
    }

    AssetLoader loader;
    loader.init();
    ProjectDoc doc;
    CHECK(loader.loadDirectory(tmpDir.string(), doc));

    const auto heroType = doc.objectTypes.find("Hero");
    CHECK(heroType != doc.objectTypes.end());
    CHECK(heroType->second.physics.bodyType == BodyType::Static);
    CHECK(std::abs(heroType->second.physics.collider.size.x - 64.f) < 0.01f);
    CHECK(std::abs(heroType->second.physics.collider.size.y - 32.f) < 0.01f);
    CHECK(std::abs(heroType->second.physics.collider.friction - 0.5f) < 0.01f);

    const auto heroInst = doc.entities.find(1);
    CHECK(heroInst != doc.entities.end());
    CHECK(heroInst->second.physics.bodyType == BodyType::Static);
    CHECK(std::abs(heroInst->second.physics.collider.size.x - 64.f) < 0.01f);

    loader.shutdown();
    fs::remove_all(tmpDir);
}

static void test_object_types_snake_case_sprite_fill_color() {
    const fs::path tmpDir =
        fs::temp_directory_path() / "artcade_asset_loader_v2_sprite";
    fs::create_directories(tmpDir);
    {
        std::ofstream f(tmpDir / "project.json");
        f << R"({
  "projectName": "V2Sprite",
  "activeSceneId": "s1",
  "object_types": {
    "Hero": {
      "id": "Hero",
      "display_name": "Hero",
      "sprite": {
        "sprite_asset_id": "hero.png",
        "fillColor": { "x": 0.1, "y": 0.2, "z": 0.3 },
        "pivot_from_asset": false
      }
    }
  },
  "scenes": {
    "s1": { "id": "s1", "name": "S1", "instances": [] }
  }
})";
    }

    AssetLoader loader;
    loader.init();
    ProjectDoc doc;
    CHECK(loader.loadDirectory(tmpDir.string(), doc));

    const auto heroType = doc.objectTypes.find("Hero");
    CHECK(heroType != doc.objectTypes.end());
    CHECK(heroType->second.sprite.spriteAssetId == "hero.png");
    CHECK(std::abs(heroType->second.sprite.fillColor.x - 0.1f) < 0.01f);
    CHECK(heroType->second.sprite.pivotFromAsset == false);

    loader.shutdown();
    fs::remove_all(tmpDir);
}

static void test_object_types_full_gameplay_components() {
    const fs::path tmpDir =
        fs::temp_directory_path() / "artcade_asset_loader_v2_components";
    fs::create_directories(tmpDir);
    {
        std::ofstream f(tmpDir / "project.json");
        f << R"({
  "projectName": "V2Components",
  "activeSceneId": "s1",
  "objectTypes": {
    "Enemy": {
      "id": "Enemy",
      "sensor": { "shape": "Circle", "radius": 55 },
      "health": { "maxHp": 75 },
      "platformerController": { "maxSpeed": 220, "jumpForce": 500 }
    }
  },
  "scenes": {
    "s1": {
      "id": "s1",
      "name": "S1",
      "instances": [{ "id": 1, "typeId": "Enemy", "name": "Enemy_1" }]
    }
  }
})";
    }

    AssetLoader loader;
    loader.init();
    ProjectDoc doc;
    CHECK(loader.loadDirectory(tmpDir.string(), doc));

    const auto typeIt = doc.objectTypes.find("Enemy");
    CHECK(typeIt != doc.objectTypes.end());
    CHECK(typeIt->second.sensor.has_value());
    CHECK(std::abs(typeIt->second.sensor->radius - 55.f) < 0.01f);
    CHECK(typeIt->second.health.has_value());
    CHECK(typeIt->second.platformerController.has_value());
    CHECK(std::abs(typeIt->second.platformerController->maxSpeed - 220.f) < 0.01f);

    const auto instIt = doc.entities.find(1);
    CHECK(instIt != doc.entities.end());
    CHECK(instIt->second.sensor.has_value());
    CHECK(instIt->second.health.has_value());
    CHECK(instIt->second.platformerController.has_value());

    loader.shutdown();
    fs::remove_all(tmpDir);
}

static void test_malformed_project_json_returns_false_without_crash() {
    const fs::path tmpDir = fs::temp_directory_path() / "artcade_asset_loader_bad_type";
    fs::create_directories(tmpDir);
    {
        std::ofstream f(tmpDir / "project.json");
        f << R"({
  "projectName": { "not": "a string" },
  "activeSceneId": "s1",
  "entities": {},
  "scenes": { "s1": { "id": "s1", "name": "S1", "entityIds": [] } }
})";
    }

    AssetLoader loader;
    loader.init();
    ProjectDoc doc;
    CHECK(!loader.loadDirectory(tmpDir.string(), doc));
    loader.shutdown();
    fs::remove_all(tmpDir);
}

int main() {
    test_physics_health_sensor_from_project_json();
    test_object_types_physics_from_project_json();
    test_object_types_snake_case_sprite_fill_color();
    test_object_types_full_gameplay_components();
    test_invalid_hex_color_falls_back_without_crash();
    test_malformed_project_json_returns_false_without_crash();

    std::cout << "asset-loader-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

// project-json-parity-test.cpp — modular readers vs AssetLoader produce the same ProjectDoc.

#include "asset-json.h"
#include "entity-json.h"
#include "modules/asset-system/include/asset-loader.h"
#include "object-type-materialize.h"
#include "project-meta-json.h"
#include "scene-json.h"

#include <cmath>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
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

static json load_fixture_json() {
    const fs::path fixturePath =
        fs::path(ARTCADE_SOURCE_ROOT) / "tests" / "fixtures" / "project-v2-parity.json";
    std::ifstream input(fixturePath);
    if (!input)
        throw std::runtime_error("Missing fixture: " + fixturePath.string());
    return json::parse(input);
}

static ArtCade::ProjectDoc build_doc_via_modular_readers(const json& docJson) {
    ArtCade::ProjectDoc doc;
    ArtCade::ProjectJson::read_project_header(docJson, doc);
    if (docJson.contains("world") && docJson["world"].is_object())
        ArtCade::ProjectJson::read_world_settings(docJson["world"], doc.world);
    ArtCade::ProjectJson::read_object_types_map(docJson, doc.objectTypes);
    ArtCade::ProjectJson::read_entities_map(docJson, doc.entities, false);
    ArtCade::ProjectJson::read_scenes_map(docJson, doc.scenes);
    ArtCade::ProjectJson::read_thumbnails(docJson, doc.thumbnails);
    ArtCade::ProjectJson::read_tile_palette(docJson, doc.tilePalette);
    ArtCade::ProjectJson::read_tilesets(docJson, doc.tilesets);
    materializeProjectEntities(doc);
    ArtCade::ProjectJson::read_image_assets(docJson, doc.imageAssets);
    resolveSpritePivotsFromImageAssets(doc);
    return doc;
}

static bool load_doc_via_asset_loader(const json& docJson, ArtCade::ProjectDoc& out) {
    const fs::path tmpDir = fs::temp_directory_path() / "artcade_project_json_parity";
    std::error_code ec;
    fs::remove_all(tmpDir, ec);
    fs::create_directories(tmpDir, ec);

    {
        std::ofstream projectFile(tmpDir / "project.json");
        projectFile << docJson.dump(2);
    }

    ArtCade::Modules::AssetLoader loader;
    loader.init();
    const bool ok = loader.loadDirectory(tmpDir.string(), out);
    loader.shutdown();
    fs::remove_all(tmpDir, ec);
    return ok;
}

static void assert_project_docs_match(const ArtCade::ProjectDoc& modular,
                                      const ArtCade::ProjectDoc& loader) {
    CHECK(modular.projectName == loader.projectName);
    CHECK(modular.version == loader.version);
    CHECK(modular.licenseTier == loader.licenseTier);
    CHECK(std::abs(modular.targetFPS - loader.targetFPS) < 0.01f);
    CHECK(modular.activeSceneId == loader.activeSceneId);
    CHECK(modular.mainScriptPath == loader.mainScriptPath);
    CHECK(modular.formatVersion == loader.formatVersion);

    CHECK(std::abs(modular.world.gravity - loader.world.gravity) < 0.01f);
    CHECK(std::abs(modular.world.pixelsPerMeter - loader.world.pixelsPerMeter) < 0.01f);
    CHECK(std::abs(modular.world.timeScale - loader.world.timeScale) < 0.01f);
    CHECK(modular.world.physicsMode == loader.world.physicsMode);
    CHECK(modular.world.physicsDebugDraw == loader.world.physicsDebugDraw);

    CHECK(modular.objectTypes.size() == loader.objectTypes.size());
    const auto modularHero = modular.objectTypes.find("Hero");
    const auto loaderHero = loader.objectTypes.find("Hero");
    CHECK(modularHero != modular.objectTypes.end());
    CHECK(loaderHero != loader.objectTypes.end());
    CHECK(modularHero->second.physics.bodyType == loaderHero->second.physics.bodyType);
    CHECK(modularHero->second.health.has_value() == loaderHero->second.health.has_value());

    CHECK(modular.entities.size() == loader.entities.size());
    const auto modularEntity = modular.entities.find(1);
    const auto loaderEntity = loader.entities.find(1);
    CHECK(modularEntity != modular.entities.end());
    CHECK(loaderEntity != loader.entities.end());
    CHECK(modularEntity->second.className == loaderEntity->second.className);
    CHECK(modularEntity->second.name == loaderEntity->second.name);
    CHECK(std::abs(modularEntity->second.transform.position.x
                   - loaderEntity->second.transform.position.x) < 0.01f);
    CHECK(modularEntity->second.health.has_value() == loaderEntity->second.health.has_value());

    CHECK(modular.scenes.size() == loader.scenes.size());
    const auto modularScene = modular.scenes.find("level_1");
    const auto loaderScene = loader.scenes.find("level_1");
    CHECK(modularScene != modular.scenes.end());
    CHECK(loaderScene != loader.scenes.end());
    CHECK(std::abs(modularScene->second.worldSize.x - loaderScene->second.worldSize.x) < 0.01f);
    CHECK(modularScene->second.instances.size() == loaderScene->second.instances.size());
    CHECK(modularScene->second.tilemap.cols == loaderScene->second.tilemap.cols);
    CHECK(modularScene->second.tilemap.tilesetAssetId
          == loaderScene->second.tilemap.tilesetAssetId);

    CHECK(modular.tilePalette.size() == loader.tilePalette.size());
    if (!modular.tilePalette.empty()) {
        CHECK(modular.tilePalette[0].name == loader.tilePalette[0].name);
        CHECK(modular.tilePalette[0].groundClass == loader.tilePalette[0].groundClass);
        CHECK(std::abs(modular.tilePalette[0].color.g - loader.tilePalette[0].color.g) < 0.02f);
    }

    CHECK(modular.tilesets.size() == loader.tilesets.size());
    if (!modular.tilesets.empty()) {
        CHECK(modular.tilesets[0].assetId == loader.tilesets[0].assetId);
        CHECK(modular.tilesets[0].spriteImagePath == loader.tilesets[0].spriteImagePath);
    }

    CHECK(modular.thumbnails.size() == loader.thumbnails.size());
    CHECK(modular.thumbnails.at("level_1") == loader.thumbnails.at("level_1"));

    CHECK(modular.imageAssets.size() == loader.imageAssets.size());
    if (!modular.imageAssets.empty()) {
        CHECK(modular.imageAssets[0].assetId == loader.imageAssets[0].assetId);
        CHECK(modular.imageAssets[0].imagePoints.size()
              == loader.imageAssets[0].imagePoints.size());
    }
}

static void test_modular_readers_match_asset_loader() {
    const json fixture = load_fixture_json();
    const ArtCade::ProjectDoc modularDoc = build_doc_via_modular_readers(fixture);

    ArtCade::ProjectDoc loaderDoc;
    CHECK(load_doc_via_asset_loader(fixture, loaderDoc));
    assert_project_docs_match(modularDoc, loaderDoc);
}

static void test_runtime_vs_world_settings_contract() {
    const json doc = json::parse(R"({
      "world": {
        "pixels_per_meter": 80,
        "physics_mode": "off"
      }
    })");

    ArtCade::WorldSettings world{};
    ArtCade::ProjectJson::read_world_settings(doc["world"], world);
    CHECK(std::abs(world.gravity - 9.81f) < 0.01f);
    CHECK(std::abs(world.pixelsPerMeter - 80.f) < 0.01f);
    CHECK(world.physicsMode == ArtCade::PhysicsMode::Off);

    ArtCade::ProjectRuntimeSettings runtime{};
    runtime.gravity = 42.f;
    ArtCade::ProjectJson::read_runtime_settings(doc, runtime);
    CHECK(std::abs(runtime.gravity - 42.f) < 0.01f);
    CHECK(std::abs(runtime.pixelsPerMeter - 80.f) < 0.01f);
    CHECK(runtime.physicsMode == ArtCade::PhysicsMode::Off);
}

int main() {
    try {
        test_modular_readers_match_asset_loader();
        test_runtime_vs_world_settings_contract();
    } catch (const std::exception& ex) {
        std::cerr << "FAIL: exception: " << ex.what() << '\n';
        ++g_failed;
    }

    std::cout << "project-json-parity-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

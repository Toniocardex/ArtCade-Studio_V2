// project-json-test.cpp — shared artcade-project-json deserializers.

#include "asset-json.h"
#include "entity-json.h"
#include "physics-json.h"
#include "project-meta-json.h"
#include "scene-json.h"
#include "sprite-json.h"

#include <cmath>
#include <iostream>
#include <nlohmann/json.hpp>
#include <unordered_map>
#include <vector>

using json = nlohmann::json;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) ++g_passed; \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

static void test_read_physics_component_from_object_type_json() {
    const json entity = json::parse(R"({
      "id": "Hero",
      "physics": {
        "bodyType": "Static",
        "collider": {
          "shape": "Rectangle",
          "size": { "x": 64, "y": 32 },
          "offset": { "x": 1, "y": 2 },
          "density": 2,
          "friction": 0.5,
          "isSensor": true
        }
      }
    })");

    ArtCade::PhysicsComponent pc{};
    CHECK(ArtCade::ProjectJson::read_physics_component(entity, pc));
    CHECK(pc.bodyType == ArtCade::BodyType::Static);
    CHECK(std::abs(pc.collider.size.x - 64.f) < 0.01f);
    CHECK(std::abs(pc.collider.size.y - 32.f) < 0.01f);
    CHECK(std::abs(pc.collider.offset.x - 1.f) < 0.01f);
    CHECK(pc.collider.isSensor);
}

static void test_missing_physics_returns_false() {
    const json entity = json::parse(R"({ "id": "Hero" })");
    ArtCade::PhysicsComponent pc{};
    CHECK(!ArtCade::ProjectJson::read_physics_component(entity, pc));
}

static void test_read_sprite_component_fill_color() {
    const json entity = json::parse(R"({
      "sprite": {
        "spriteAssetId": "hero",
        "fillColor": { "x": 0.2, "y": 0.4, "z": 0.6 },
        "pivotFromAsset": false,
        "pivot": { "x": 0.25, "y": 0.75 }
      }
    })");

    ArtCade::SpriteComponent sprite{};
    CHECK(ArtCade::ProjectJson::read_sprite_component(entity, sprite));
    CHECK(sprite.spriteAssetId == "hero");
    CHECK(std::abs(sprite.fillColor.x - 0.2f) < 0.01f);
    CHECK(sprite.pivotFromAsset == false);
    CHECK(std::abs(sprite.pivot.x - 0.25f) < 0.01f);
}

static void test_read_object_type_all_gameplay_components() {
    const json typeJson = json::parse(R"({
      "id": "Enemy",
      "displayName": "Enemy",
      "transform": { "position": { "x": 10, "y": 20 }, "scale": { "x": 1, "y": 1 }, "rotation": 0 },
      "physics": {
        "bodyType": "Kinematic",
        "collider": { "shape": "Rectangle", "size": { "x": 32, "y": 32 } }
      },
      "sensor": { "shape": "Circle", "radius": 40 },
      "health": { "maxHp": 50, "currentHp": 50, "iFrames": 0.1 },
      "hordeMember": { "targetClass": "Player", "maxSpeed": 90 }
    })");

    ArtCade::EntityDef e{};
    ArtCade::ProjectJson::read_object_type(typeJson, "Enemy", e);
    CHECK(e.id == 0);
    CHECK(e.className == "Enemy");
    CHECK(std::abs(e.transform.position.x - 10.f) < 0.01f);
    CHECK(e.physics.bodyType == ArtCade::BodyType::Kinematic);
    CHECK(e.sensor.has_value());
    CHECK(std::abs(e.sensor->radius - 40.f) < 0.01f);
    CHECK(e.health.has_value());
    CHECK(std::abs(e.health->maxHp - 50.f) < 0.01f);
    CHECK(e.hordeMember.has_value());
    CHECK(e.hordeMember->targetClass == "Player");
}

static void test_read_scene_def_snake_case_and_tilemap() {
    const json scene = json::parse(R"({
      "id": "level_1",
      "name": "Level 1",
      "world_size": [1280, 720],
      "viewport_size": { "x": 800, "y": 600 },
      "background_color": { "r": 0.1, "g": 0.2, "b": 0.3, "a": 1 },
      "entity_ids": [1, 2],
      "instances": [
        {
          "id": 10,
          "object_type_id": "Hero",
          "instance_name": "Player",
          "transform": { "position": { "x": 50, "y": 100 }, "scale": { "x": 2, "y": 2 }, "rotation": 15 },
          "visible": false
        },
        { "id": 0, "objectTypeId": "Skip" }
      ],
      "tilemap": {
        "tile_size": 16,
        "cols": 2,
        "rows": 1,
        "data": [1, 2],
        "tileset_asset_id": "ts_grass"
      }
    })");

    ArtCade::SceneDef s{};
    ArtCade::ProjectJson::read_scene_def(scene, "fallback", s);
    CHECK(s.id == "level_1");
    CHECK(s.name == "Level 1");
    CHECK(std::abs(s.worldSize.x - 1280.f) < 0.01f);
    CHECK(std::abs(s.viewportSize.y - 600.f) < 0.01f);
    CHECK(std::abs(s.backgroundColor.g - 0.2f) < 0.01f);
    CHECK(s.entityIds.size() == 2);
    CHECK(s.entityIds[0] == 1);
    CHECK(s.instances.size() == 1);
    CHECK(s.instances[0].objectTypeId == "Hero");
    CHECK(s.instances[0].instanceName == "Player");
    CHECK(std::abs(s.instances[0].transform.position.x - 50.f) < 0.01f);
    CHECK(std::abs(s.instances[0].transform.scale.y - 2.f) < 0.01f);
    CHECK(std::abs(s.instances[0].transform.rotation - 15.f) < 0.01f);
    CHECK(s.instances[0].visible == false);
    CHECK(std::abs(s.tilemap.tileSize - 16.f) < 0.01f);
    CHECK(s.tilemap.cols == 2);
    CHECK(s.tilemap.data.size() == 2);
    CHECK(s.tilemap.tilesetAssetId == "ts_grass");
}

static void test_read_scene_tilemap_multi_source_layer() {
    const json scene = json::parse(R"({
      "id": "level_1",
      "tilemapLayers": {
        "ground": {
          "tileSize": 32,
          "cols": 2,
          "rows": 1,
          "data": [1, 2],
          "sourceIndices": [1, 2],
          "tilesetSources": [
            { "tilesetAssetId": "ts_a" },
            { "tilesetAssetId": "ts_b" }
          ]
        }
      }
    })");
    ArtCade::SceneDef s{};
    ArtCade::ProjectJson::read_scene_def(scene, "fallback", s);
    CHECK(s.tilemapLayers.size() == 1);
    const auto& ground = s.tilemapLayers.at("ground");
    CHECK(ground.tilesetSources.size() == 2);
    CHECK(ground.tilesetSources[0].tilesetAssetId == "ts_a");
    CHECK(ground.tilesetSources[1].tilesetAssetId == "ts_b");
    CHECK(ground.sourceIndices.size() == 2);
    CHECK(ground.sourceIndices[0] == 1);
    CHECK(ground.sourceIndices[1] == 2);
    CHECK(ground.data[0] == 1);
    CHECK(ground.data[1] == 2);
}

static void test_read_scene_tilemap_layers_and_project_layers() {
    const json scene = json::parse(R"({
      "id": "level_1",
      "tilemap": { "tileSize": 32, "cols": 2, "rows": 1, "data": [1, 0] },
      "tilemapLayers": {
        "lyr_ground": { "tileSize": 32, "cols": 2, "rows": 1, "data": [1, 0] },
        "lyr_props":  { "tileSize": 32, "cols": 2, "rows": 1, "data": [0, 2], "tilesetAssetId": "ts_props" }
      },
      "layerSettings": {
        "lyr_props": {
          "visible": false,
          "opacity": 0.35,
          "parallax": { "x": 0.5, "y": 0.75 },
          "background": { "imageId": "bg_sky", "scrollX": 12 }
        }
      }
    })");
    ArtCade::SceneDef s{};
    ArtCade::ProjectJson::read_scene_def(scene, "fallback", s);
    CHECK(s.tilemapLayers.size() == 2);
    CHECK(s.tilemapLayers.at("lyr_props").tilesetAssetId == "ts_props");
    CHECK(s.tilemapLayers.at("lyr_props").data[1] == 2);

    // Per-scene visual settings parse by layer id (visible/opacity/parallax/bg).
    CHECK(s.layerSettings.size() == 1);
    const auto& props = s.layerSettings.at("lyr_props");
    CHECK(props.visible == false);
    CHECK(std::abs(props.opacity - 0.35f) < 0.01f);
    CHECK(std::abs(props.parallax.x - 0.5f) < 0.01f);
    CHECK(std::abs(props.parallax.y - 0.75f) < 0.01f);
    CHECK(props.background.imageId == "bg_sky");
    CHECK(std::abs(props.background.scrollX - 12.f) < 0.01f);

    // Global layers carry only id/name/locked (visual props live per-scene).
    const json doc = json::parse(R"({
      "layers": [
        { "id": "lyr_props", "name": "Props", "locked": true },
        "ground"
      ]
    })");
    std::vector<ArtCade::SceneLayerDef> layers;
    ArtCade::ProjectJson::read_scene_layers(doc, layers);
    CHECK(layers.size() == 2);
    CHECK(layers[0].id == "lyr_props");
    CHECK(layers[0].name == "Props");
    CHECK(layers[0].locked == true);
    // Legacy string form: name doubles as the stable id.
    CHECK(layers[1].id == "ground");
    CHECK(layers[1].name == "ground");
    CHECK(layers[1].locked == false);
}

static void test_read_tile_palette_hex_and_snake_case() {
    const json doc = json::parse(R"({
      "tile_palette": [{
        "id": 1,
        "name": "Grass",
        "color": "#ff8040",
        "solid": true,
        "ground_class": "Terrain",
        "surface_kind": "oneWay"
      }]
    })");

    std::vector<ArtCade::TilePaletteEntry> palette;
    ArtCade::ProjectJson::read_tile_palette(doc, palette);
    CHECK(palette.size() == 1);
    CHECK(palette[0].name == "Grass");
    CHECK(std::abs(palette[0].color.r - 1.f) < 0.02f);
    CHECK(std::abs(palette[0].color.g - 0.5f) < 0.02f);
    CHECK(palette[0].solid);
    CHECK(palette[0].groundClass == "Terrain");
    CHECK(palette[0].surfaceKind == "oneWay");

    CHECK(std::abs(ArtCade::ProjectJson::hex_to_vec4("#zzzzzz").r - 0.5f) < 0.01f);
}

static void test_read_tilesets_array_and_world_settings() {
    const json doc = json::parse(R"({
      "world": {
        "gravity": 12.5,
        "pixels_per_meter": 64,
        "physics_mode": "off",
        "physics_debug_draw": true
      },
      "tilesets": [
        {
          "asset_id": "ts_a",
          "sprite_image_path": "tiles.png",
          "tile_size": 24,
          "cols": 8,
          "rows": 4
        }
      ],
      "thumbnails": { "scene_1": "thumbnails/scene_1.png" }
    })");

    ArtCade::WorldSettings world{};
    ArtCade::ProjectJson::read_world_settings(doc["world"], world);
    CHECK(std::abs(world.gravity - 12.5f) < 0.01f);
    CHECK(std::abs(world.pixelsPerMeter - 64.f) < 0.01f);
    CHECK(world.physicsMode == ArtCade::PhysicsMode::Off);
    CHECK(world.physicsDebugDraw);

    std::vector<ArtCade::TilesetAsset> tilesets;
    ArtCade::ProjectJson::read_tilesets(doc, tilesets);
    CHECK(tilesets.size() == 1);
    CHECK(tilesets[0].assetId == "ts_a");
    CHECK(tilesets[0].spriteImagePath == "tiles.png");
    CHECK(std::abs(tilesets[0].tileSize - 24.f) < 0.01f);

    std::unordered_map<std::string, std::string> thumbs;
    ArtCade::ProjectJson::read_thumbnails(doc, thumbs);
    CHECK(thumbs.size() == 1);
    CHECK(thumbs["scene_1"] == "thumbnails/scene_1.png");
}

static void test_read_runtime_settings_partial_overlay() {
    const json doc = json::parse(R"({
      "target_fps": 120,
      "world": {
        "pixels_per_meter": 80,
        "physics_debug_draw": true
      }
    })");

    ArtCade::ProjectRuntimeSettings runtime{};
    runtime.gravity = 9.81f;
    ArtCade::ProjectJson::read_runtime_settings(doc, runtime);
    CHECK(std::abs(runtime.targetFPS - 120.f) < 0.01f);
    CHECK(std::abs(runtime.gravity - 9.81f) < 0.01f);
    CHECK(std::abs(runtime.pixelsPerMeter - 80.f) < 0.01f);
    CHECK(runtime.physicsDebugDraw);
    CHECK(runtime.physicsMode == ArtCade::PhysicsMode::Auto);
}

static void test_read_project_header_and_image_assets() {
    const json doc = json::parse(R"({
      "project_name": "Demo",
      "active_scene_id": "s1",
      "assets": {
        "hero": {
          "id": "hero_id",
          "path": "sprites/hero.png",
          "defaultPivot": { "x": 0.25, "y": 0.75 },
          "imagePoints": [{ "id": "hand", "x": 0.5, "y": 0.5 }]
        }
      }
    })");

    ArtCade::ProjectDoc project{};
    ArtCade::ProjectJson::read_project_header(doc, project);
    CHECK(project.projectName == "Demo");
    CHECK(project.activeSceneId == "s1");

    std::vector<ArtCade::ImageAssetDef> assets;
    ArtCade::ProjectJson::read_image_assets(doc, assets);
    CHECK(assets.size() == 1);
    CHECK(assets[0].assetId == "sprites/hero.png");
    CHECK(std::abs(assets[0].defaultPivot.x - 0.25f) < 0.01f);
    CHECK(assets[0].imagePoints.size() == 1);
    CHECK(assets[0].imagePoints[0].id == "hand");
}

static void test_read_entities_and_scenes_maps() {
    const json doc = json::parse(R"({
      "entities": { "7": { "id": 7, "className": "Hero" } },
      "scenes": { "s1": { "id": "s1", "name": "Main" } }
    })");

    std::unordered_map<ArtCade::EntityId, ArtCade::EntityDef> entities;
    ArtCade::ProjectJson::read_entities_map(doc, entities, false);
    CHECK(entities.size() == 1);
    CHECK(entities[7].className == "Hero");

    std::unordered_map<std::string, ArtCade::SceneDef> scenes;
    ArtCade::ProjectJson::read_scenes_map(doc, scenes);
    CHECK(scenes.size() == 1);
    CHECK(scenes["s1"].name == "Main");
}

static void test_read_scene_def_defaults_when_fields_absent() {
    const json scene = json::parse(R"({ "name": "Empty" })");
    ArtCade::SceneDef s{};
    ArtCade::ProjectJson::read_scene_def(scene, "scene_0", s);
    CHECK(s.id == "scene_0");
    CHECK(std::abs(s.worldSize.x - ArtCade::ProjectDefaults::kSceneWorldWidth) < 0.01f);
    CHECK(std::abs(s.worldSize.y - ArtCade::ProjectDefaults::kSceneWorldHeight) < 0.01f);
    CHECK(std::abs(s.viewportSize.x - ArtCade::ProjectDefaults::kSceneViewportWidth) < 0.01f);
    CHECK(std::abs(s.viewportSize.y - ArtCade::ProjectDefaults::kSceneViewportHeight) < 0.01f);
    CHECK(s.instances.empty());
    CHECK(s.tilemap.cols == 0);
}

static void test_read_entity_instance_wasm_name_fallback() {
    const json entity = json::parse(R"({ "id": 7, "className": "Hero" })");
    ArtCade::EntityDef wasm{};
    ArtCade::ProjectJson::read_entity_instance(entity, 7, wasm, true);
    CHECK(wasm.name == "Entity_7");

    ArtCade::EntityDef native{};
    ArtCade::ProjectJson::read_entity_instance(entity, 7, native, false);
    CHECK(native.name.empty());
}

int main() {
    test_read_physics_component_from_object_type_json();
    test_missing_physics_returns_false();
    test_read_sprite_component_fill_color();
    test_read_object_type_all_gameplay_components();
    test_read_scene_def_snake_case_and_tilemap();
    test_read_scene_tilemap_layers_and_project_layers();
    test_read_scene_tilemap_multi_source_layer();
    test_read_tile_palette_hex_and_snake_case();
    test_read_tilesets_array_and_world_settings();
    test_read_runtime_settings_partial_overlay();
    test_read_project_header_and_image_assets();
    test_read_entities_and_scenes_maps();
    test_read_scene_def_defaults_when_fields_absent();
    test_read_entity_instance_wasm_name_fallback();

    std::cout << "project-json-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

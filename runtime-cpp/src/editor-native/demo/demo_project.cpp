#include "editor-native/demo/demo_project.h"

namespace ArtCade::EditorNative {

namespace {

EntityDef objectType(const std::string& id, Vec3 fill) {
    EntityDef def;
    def.className = id;
    def.name = id;
    def.sprite.fillColor = fill;
    return def;
}

SceneInstanceDef instance(EntityId id, const std::string& type,
                          const std::string& name, Vec2 pos) {
    SceneInstanceDef inst;
    inst.id = id;
    inst.objectTypeId = type;
    inst.instanceName = name;
    inst.transform.position = pos;
    return inst;
}

ImageAssetDef imageAsset(const std::string& id, const std::string& path) {
    ImageAssetDef asset;
    asset.assetId = id;
    asset.sourcePath = path;
    return asset;
}

} // namespace

ProjectDoc makeDemoProject() {
    ProjectDoc doc;
    doc.projectName = "RmlUi Editor Spike";
    doc.activeSceneId = "scene-a";

    doc.objectTypes.emplace("Player", objectType("Player", {0.40f, 0.78f, 0.55f}));
    doc.objectTypes.emplace("Crate",  objectType("Crate",  {0.74f, 0.55f, 0.34f}));
    doc.objectTypes.emplace("Coin",   objectType("Coin",   {0.92f, 0.80f, 0.32f}));
    doc.objectTypes.emplace("Enemy",  objectType("Enemy",  {0.82f, 0.39f, 0.40f}));
    doc.imageAssets.push_back(imageAsset("img-player", "sprites/rpg_spritesheet_32px.png"));
    doc.imageAssets.push_back(imageAsset("img-crate", "sprites/rpg_spritesheet_32px_alpha_check.png"));
    doc.imageAssets.push_back(imageAsset("img-coin", "sprites/rpg_spritesheet_complete.png"));
    doc.imageAssets.push_back(imageAsset("img-enemy", "sprites/rpg_spritesheet_32px.png"));
    doc.objectTypes.at("Player").sprite.spriteAssetId = "img-player";
    doc.objectTypes.at("Crate").sprite.spriteAssetId = "img-crate";
    doc.objectTypes.at("Coin").sprite.spriteAssetId = "img-coin";
    doc.objectTypes.at("Enemy").sprite.spriteAssetId = "img-enemy";

    // Authored runtime behaviour: the Patroller drifts left during Play. This is
    // data, not code in the loop — the runtime integrates whatever the authoring
    // document declares (canonical LinearMoverComponent).
    LinearMoverComponent patrol;
    patrol.directionX = -1.f;
    patrol.directionY = 0.f;
    patrol.speed = 90.f;
    doc.objectTypes.at("Enemy").linearMover = patrol;

    SceneDef a;
    a.id = "scene-a";
    a.name = "Level 1";
    a.worldSize = {960.f, 540.f};
    a.viewportSize = {960.f, 540.f};
    a.backgroundColor = {0.07f, 0.09f, 0.12f, 1.f};
    a.instances = {
        instance(1, "Player", "Player",   {120.f, 360.f}),
        instance(2, "Crate",  "Crate A",  {420.f, 400.f}),
        instance(3, "Crate",  "Crate B",  {496.f, 400.f}),
        instance(4, "Coin",   "Coin",     {300.f, 200.f}),
        instance(5, "Enemy",  "Patroller",{700.f, 356.f}),
    };

    SceneDef b;
    b.id = "scene-b";
    b.name = "Bonus Room";
    b.worldSize = {640.f, 480.f};
    b.viewportSize = {640.f, 480.f};
    b.backgroundColor = {0.11f, 0.08f, 0.13f, 1.f};
    b.instances = {
        instance(10, "Player", "Player", {80.f, 300.f}),
        instance(11, "Coin",   "Coin 1", {320.f, 160.f}),
        instance(12, "Coin",   "Coin 2", {400.f, 160.f}),
    };

    doc.scenes.emplace("scene-a", std::move(a));
    doc.scenes.emplace("scene-b", std::move(b));
    return doc;
}

} // namespace ArtCade::EditorNative

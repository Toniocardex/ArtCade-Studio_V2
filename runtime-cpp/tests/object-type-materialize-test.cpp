// object-type-materialize-test.cpp — ADR-0010 sheet materialisation (no GL).

#include "object-type-materialize.h"

#include <cstdio>
#include <cstdlib>
#include <string>

using namespace ArtCade;

static void expect(bool ok, const char* msg) {
    if (!ok) {
        std::fprintf(stderr, "FAIL: %s\n", msg);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", msg);
}

static SpriteAnimationAssetDef makeHeroAnim(const AssetId& sourceImage = "img-hero") {
    SpriteAnimationAssetDef anim;
    anim.id = "hero.anim";
    anim.name = "hero.anim";
    anim.sourceImageAssetId = sourceImage;
    anim.frames.push_back(SpriteFrameDef{"f0", 0, 0, 32, 32});
    SpriteAnimationClipDef idle;
    idle.id = "idle";
    idle.name = "Idle";
    idle.framesPerSecond = 8.f;
    idle.playbackMode = AnimationPlaybackMode::Loop;
    idle.frameIds = {"f0"};
    anim.clips.push_back(idle);
    return anim;
}

static EntityDef makeAnimationType(const AnimationClipId& defaultClipId = {}) {
    EntityDef type;
    type.className = "Hero";
    type.name = "Hero";
    SpritePresentationComponent presentation;
    presentation.visible = true;
    presentation.source = SpritePresentationAnimation{
        "hero.anim", defaultClipId, /*autoPlay=*/false, /*playbackSpeed=*/1.f};
    type.spritePresentation = std::move(presentation);
    return type;
}

static SceneInstanceDef makeInstance() {
    SceneInstanceDef inst;
    inst.id = 1;
    inst.objectTypeId = "Hero";
    inst.instanceName = "Hero";
    return inst;
}

int main() {
    const std::vector<SpriteAnimationAssetDef> assets{makeHeroAnim()};

    // Animation source: sheet from animation asset even with empty defaultClipId.
    {
        const EntityDef e =
            materializeInstance(makeAnimationType(/*defaultClipId=*/{}), makeInstance(), assets);
        expect(e.spriteRenderer.has_value(), "animation: renderer present");
        expect(e.spriteRenderer->imageAssetId == "img-hero",
               "animation: imageAssetId from sourceImageAssetId");
        expect(e.sprite.spriteAssetId == "img-hero",
               "animation: sprite.spriteAssetId copied from renderer");
        expect(e.spriteAnimator.has_value(), "animation: animator present");
        expect(e.spriteAnimator->animationAssetId == "hero.anim", "animation: animator asset id");
        expect(e.spriteAnimator->defaultClipId.empty(), "animation: empty defaultClipId preserved");
        expect(!e.spritePresentation.has_value(), "animation: presentation cleared");
    }

    // Image source unchanged.
    {
        EntityDef type;
        type.className = "Hero";
        SpritePresentationComponent presentation;
        presentation.source = SpritePresentationImage{"img-static"};
        type.spritePresentation = std::move(presentation);
        const EntityDef e = materializeInstance(type, makeInstance(), assets);
        expect(e.spriteRenderer->imageAssetId == "img-static", "image: sheet unchanged");
        expect(!e.spriteAnimator.has_value(), "image: no animator");
        expect(e.sprite.spriteAssetId == "img-static", "image: sprite id copied");
    }

    // Missing animation asset: no invented sheet.
    {
        const EntityDef e =
            materializeInstance(makeAnimationType("idle"), makeInstance(), /*assets=*/{});
        expect(e.spriteRenderer.has_value(), "missing anim: renderer present");
        expect(e.spriteRenderer->imageAssetId.empty(), "missing anim: no invented sheet");
        expect(e.sprite.spriteAssetId.empty(), "missing anim: sprite id stays empty");
        expect(e.spriteAnimator.has_value(), "missing anim: animator still created");
    }

    // Empty sourceImageAssetId on asset: no invented sheet.
    {
        std::vector<SpriteAnimationAssetDef> emptySource{makeHeroAnim(/*sourceImage=*/{})};
        const EntityDef e =
            materializeInstance(makeAnimationType("idle"), makeInstance(), emptySource);
        expect(e.spriteRenderer->imageAssetId.empty(), "empty source image: no invented sheet");
    }

    // materializeProjectEntities wires the catalog through.
    {
        ProjectDoc doc;
        doc.spriteAnimationAssets = assets;
        EntityDef type = makeAnimationType({});
        doc.objectTypes.emplace("Hero", std::move(type));
        SceneDef scene;
        scene.id = "s1";
        scene.instances.push_back(makeInstance());
        doc.scenes.emplace("s1", std::move(scene));
        materializeProjectEntities(doc);
        const EntityDef& e = doc.entities.at(1);
        expect(e.spriteRenderer->imageAssetId == "img-hero",
               "project materialize: sheet from catalog");
        expect(e.sprite.spriteAssetId == "img-hero",
               "project materialize: sprite id from catalog");
    }

    std::puts("object_type_materialize_test: all passed");
    return 0;
}

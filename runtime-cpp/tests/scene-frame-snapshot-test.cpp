// scene-frame-snapshot-test.cpp — immutable frame snapshot captures scene geometry.

#include "../src/app/render/scene_frame_snapshot.h"
#include "../src/modules/presentation/include/presentation_snapshot.h"

#include <cstdio>
#include <cstdlib>

static void expect(bool ok, const char* msg) {
    if (!ok) {
        std::fprintf(stderr, "FAIL: %s\n", msg);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", msg);
}

int main() {
    ArtCade::SceneDef scene{};
    scene.id = "level";
    scene.worldSize = { 2048.f, 320.f };
    scene.viewportSize = { 800.f, 600.f };
    scene.backgroundColor = { 0.1f, 0.2f, 0.3f, 1.f };
    scene.layerSettings["bg"].visible = true;
    scene.layerSettings["fg"].visible = false;
    scene.tilemap.cols = 2;
    scene.tilemap.rows = 1;
    scene.tilemap.data = { 1, 2 };
    scene.tilemapLayers["bg"].cols = 4;
    scene.tilemapLayers["bg"].data = { 3, 4, 5, 6 };

    ArtCade::Presentation::PresentationSnapshot presentation{};
    presentation.revision = 42u;
    presentation.logicalWidth = 800.;
    presentation.logicalHeight = 600.;

    ArtCade::EditorOverlayState overlay{};
    overlay.inEditMode = true;
    overlay.gridSize = 16.f;

    const ArtCade::SceneFrameSnapshot snap = ArtCade::scene_frame_build({
        7u,
        3u,
        &scene,
        presentation,
        overlay,
    });

    expect(snap.frameNumber == 7u, "frame number copied");
    expect(snap.sceneRevision == 3u, "scene revision copied");
    expect(snap.presentationRevision == 42u, "presentation revision copied");
    expect(snap.sceneId == "level", "scene id copied");
    expect(snap.worldSize.x == 2048.f, "world width snapshotted");
    expect(snap.logicalViewport.y == 600.f, "logical viewport snapshotted");
    expect(snap.backgroundColor.g == 0.2f, "background color snapshotted");
    expect(snap.layerSettings.at("fg").visible == false, "layer settings snapshotted");
    expect(snap.tilemap.data.size() == 2u && snap.tilemap.data[0] == 1,
           "merged tilemap snapshotted");
    expect(snap.tilemapLayers.at("bg").data.size() == 4u,
           "per-layer tilemap snapshotted");
    expect(snap.overlay.gridSize == 16.f, "overlay copied");

    scene.worldSize.x = 512.f;
    scene.layerSettings["fg"].visible = true;
    scene.tilemap.data[0] = 99;
    scene.tilemapLayers["bg"].data[0] = 99;
    expect(snap.worldSize.x == 2048.f, "snapshot immutable after scene mutation");
    expect(snap.layerSettings.at("fg").visible == false,
           "layer settings immutable after scene mutation");
    expect(snap.tilemap.data[0] == 1, "tilemap immutable after scene mutation");
    expect(snap.tilemapLayers.at("bg").data[0] == 3,
           "per-layer tilemap immutable after scene mutation");

    std::puts("scene_frame_snapshot_test: all passed");
    return 0;
}

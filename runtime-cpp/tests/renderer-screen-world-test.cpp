// renderer-screen-world-test.cpp — committed snapshot picking + clip math (Phase 4).
// Uses raylib stub (no GPU window).

#include "../src/modules/renderer/include/renderer.h"
#include "../src/modules/renderer/include/compositor-layout.h"
#include "../src/modules/presentation/include/presentation_bindings.h"
#include "../src/modules/presentation/include/presentation_types.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>

using ArtCade::Modules::Renderer;
using ArtCade::Modules::ScreenClipRect;
using ArtCade::OutputPolicy;
using ArtCade::Presentation::PresentationBindings;
using ArtCade::Presentation::SurfacePoint;

static ArtCade::Vec2 pickWorld(const Renderer& renderer, float x, float y) {
    const auto world = PresentationBindings::surface_to_world(
        renderer.committedPresentationSnapshot(),
        SurfacePoint{ x, y });
    return { static_cast<float>(world.x), static_cast<float>(world.y) };
}

static bool near(float a, float b, float eps = 0.001f) {
    return std::fabs(a - b) <= eps;
}

static void expect(bool ok, const char* msg) {
    if (!ok) {
        std::fprintf(stderr, "FAIL: %s\n", msg);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", msg);
}

static void expectClip(const ScreenClipRect& clip,
                       float x, float y, float w, float h,
                       const char* msg) {
    expect(near(clip.x, x) && near(clip.y, y)
           && near(clip.width, w) && near(clip.height, h), msg);
}

int main() {
    Renderer renderer;
    renderer.setWindowSize(1280, 720, "test");
    renderer.setSceneViewport({ 1280.f, 720.f }, { 1280.f, 720.f });
    renderer.setCameraZoom(2.f);
    renderer.setCameraPosition({ 640.f, 360.f });

    const auto world = pickWorld(renderer, 100.f, 200.f);
    // (screen - offset) / zoom + target; offset is 0 with top-left origin.
    expect(near(world.x, (100.f / 2.f) + 640.f), "snapshot picking X");
    expect(near(world.y, (200.f / 2.f) + 360.f), "snapshot picking Y");

    renderer.setCameraPosition({ 0.f, 0.f });
    renderer.setCameraZoom(1.f);
    const auto origin = pickWorld(renderer, 0.f, 0.f);
    expect(near(origin.x, 0.f) && near(origin.y, 0.f), "snapshot picking at origin");

    // 1:1 world/viewport clamps authoritative camera; shake must stay render-only.
    renderer.setSceneViewport({ 1280.f, 720.f }, { 1280.f, 720.f });
    renderer.setCameraPosition({ 12.f, 8.f });
    const auto clamped = renderer.getCameraPosition();
    expect(near(clamped.x, 0.f) && near(clamped.y, 0.f),
           "setCameraPosition clamped at 1:1 viewport");
    renderer.setGameCameraModifiers({ 20., 15., 1., 0. });
    const auto still = renderer.getCameraPosition();
    expect(near(still.x, 0.f) && near(still.y, 0.f),
           "render shake offset does not mutate authoritative camera");

    renderer.setSceneViewport({ 2560.f, 1440.f }, { 1280.f, 720.f });
    renderer.setCameraCenter({ 1280.f, 720.f });
    const auto centered = pickWorld(renderer, 640.f, 360.f);
    expect(near(centered.x, 1280.f) && near(centered.y, 720.f),
           "setCameraCenter places world point at viewport center");
    const auto cameraCenter = renderer.getCameraCenter();
    expect(near(cameraCenter.x, 1280.f) && near(cameraCenter.y, 720.f),
           "getCameraCenter returns visible world center");

    renderer.setWindowSize(720, 360, "test-small-world");
    renderer.setSceneViewport({ 640.f, 480.f }, { 720.f, 360.f });
    renderer.setCameraPosition({ 0.f, 0.f });
    const auto smallWorldCenter = pickWorld(renderer, 360.f, 180.f);
    expect(near(smallWorldCenter.x, 320.f) && near(smallWorldCenter.y, 180.f),
           "small world is centered inside wider viewport");
    const auto smallCameraCenter = renderer.getCameraCenter();
    expect(near(smallCameraCenter.x, 320.f) && near(smallCameraCenter.y, 180.f),
           "small world camera center matches visual center");
    const auto leftInset = pickWorld(renderer, 0.f, 180.f);
    expect(leftInset.x < 0.f && near(leftInset.y, 180.f),
           "screen margin maps outside centered small world");

    renderer.setWindowSize(1000, 720, "test-letterbox");
    renderer.setSceneViewport({ 640.f, 480.f }, { 320.f, 240.f });
    renderer.setCameraPosition({ 0.f, 0.f });
    const auto letterboxLeft = pickWorld(renderer, 0.f, 360.f);
    expect(near(letterboxLeft.x, -20.f / 3.f) && near(letterboxLeft.y, 120.f),
           "letterbox margin maps outside the logical viewport");
    const auto viewportTopLeft = pickWorld(renderer, 20.f, 0.f);
    expect(near(viewportTopLeft.x, 0.f) && near(viewportTopLeft.y, 0.f),
           "scaled viewport starts after the letterbox offset");
    const auto viewportCenter = pickWorld(renderer, 500.f, 360.f);
    expect(near(viewportCenter.x, 160.f) && near(viewportCenter.y, 120.f),
           "scaled viewport center maps to logical center");
    const auto visible = renderer.visibleWorldSize();
    expect(near(visible.x, 320.f) && near(visible.y, 240.f),
           "physical window size does not change logical visible world");

    renderer.setGameCameraModifiers({});
    renderer.setGameViewCompositorEnabled(false);
    renderer.setWindowSize(1280, 720, "test-full-clip");
    renderer.setSceneViewport({ 1280.f, 720.f }, { 1280.f, 720.f });
    renderer.setCameraPosition({ 0.f, 0.f });
    renderer.setCameraZoom(1.f);
    expectClip(renderer.worldScreenClipRect(), 0.f, 0.f, 1280.f, 720.f,
               "world=viewport clip covers the full framebuffer");

    renderer.setWindowSize(512, 320, "test-16-9-clip");
    renderer.setSceneViewport({ 512.f, 288.f }, { 512.f, 320.f });
    renderer.setCameraPosition({ 0.f, 0.f });
    renderer.setCameraZoom(1.f);
    expectClip(renderer.worldScreenClipRect(), 0.f, 16.f, 512.f, 288.f,
               "16:9 world inside taller viewport clips letterbox bands");

    renderer.setGameViewCompositorEnabled(true);
    renderer.setWindowSize(1000, 720, "test-gameview-clip");
    renderer.setSceneViewport({ 640.f, 480.f }, { 320.f, 240.f });
    renderer.setCameraPosition({ 0.f, 0.f });
    renderer.setCameraZoom(1.f);
    expectClip(renderer.worldScreenClipRect(), 0.f, 0.f, 320.f, 240.f,
               "game-view compositor clip uses viewport-sized target space");

    renderer.setWindowSize(1920, 1080, "test-fill-compositor");
    renderer.setSceneViewport({ 640.f, 480.f }, { 320.f, 240.f });
    renderer.setOutputPolicy(OutputPolicy::Fill);
    renderer.setCameraPosition({ 0.f, 0.f });
    renderer.setCameraZoom(1.f);
    const auto expectedFill = ArtCade::Modules::compositor_layout(
        1920.f, 1080.f, 320.f, 240.f, OutputPolicy::Fill);
    const auto layoutFill = renderer.compositorLayout();
    expect(near(layoutFill.destW, expectedFill.destW)
           && near(layoutFill.destH, expectedFill.destH),
           "fill compositor layout matches compositor_layout");
    expect(near(layoutFill.scaleX, expectedFill.scaleX)
           && near(layoutFill.scaleY, expectedFill.scaleY),
           "fill scale matches compositor_layout");

    renderer.setGameViewCompositorEnabled(false);
    renderer.setSceneViewport({ 512.f, 288.f }, { 512.f, 288.f });
    renderer.setWindowSize(512, 320, "test-editor-camera");
    renderer.setEditorCamera({ 0.f, 0.f }, 1.f);
    renderer.setWindowSize(512, 320, "test-editor-camera-refresh");
    const auto gridOrigin = pickWorld(renderer, 0.f, 0.f);
    const auto gridStep = pickWorld(renderer, 32.f, 32.f);
    expect(near(gridOrigin.x, 0.f) && near(gridOrigin.y, 0.f),
           "editor camera keeps 1:1 origin after projection refresh");
    expect(near(gridStep.x, 32.f) && near(gridStep.y, 32.f),
           "editor camera keeps 1:1 grid spacing on tall framebuffer");

    std::puts("renderer_screen_world_test: all passed");
    return 0;
}

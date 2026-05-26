// renderer-screen-world-test.cpp — Renderer::screenToWorld matches camera math.
// Uses raylib stub (no GPU window).

#include "../src/modules/renderer/include/renderer.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>

using ArtCade::Modules::Renderer;

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

int main() {
    Renderer renderer;
    renderer.setWindowSize(1280, 720, "test");
    renderer.setSceneViewport({ 1280.f, 720.f }, { 1280.f, 720.f });
    renderer.setCameraZoom(2.f);
    renderer.setCameraPosition({ 640.f, 360.f });

    const auto world = renderer.screenToWorld(100.f, 200.f);
    // (screen - offset) / zoom + target; offset is 0 with top-left origin.
    expect(near(world.x, (100.f / 2.f) + 640.f), "screenToWorld X");
    expect(near(world.y, (200.f / 2.f) + 360.f), "screenToWorld Y");

    renderer.setCameraPosition({ 0.f, 0.f });
    renderer.setCameraZoom(1.f);
    const auto origin = renderer.screenToWorld(0.f, 0.f);
    expect(near(origin.x, 0.f) && near(origin.y, 0.f), "screenToWorld at origin");

    std::puts("renderer_screen_world_test: all passed");
    return 0;
}

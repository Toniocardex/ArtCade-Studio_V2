// camera-manager-test.cpp
// Compile from runtime-cpp/tests/:
//   g++ -std=c++17 -I../src \
//       camera-manager-test.cpp \
//       ../src/modules/camera-manager/src/camera-manager.cpp \
//       -o camera_manager_test && ./camera_manager_test

#include <cassert>
#include <cstdio>
#include <cmath>

#include "../src/modules/camera-manager/include/camera-manager.h"

using CM = ArtCade::Modules::CameraManager;

static bool approx(float a, float b, float eps = 0.5f) {
    return std::fabs(a - b) < eps;
}

static void test_init() {
    CM cam; cam.init();
    assert(approx(cam.position().x, 0.f) && approx(cam.position().y, 0.f));
    assert(approx(cam.zoom(), 1.f));
    assert(approx(cam.rotation(), 0.f));
    std::puts("  [ok] init defaults");
}

static void test_set_position() {
    CM cam; cam.init();
    cam.setPosition({ 100.f, 200.f });
    assert(approx(cam.position().x, 100.f) && approx(cam.position().y, 200.f));
    std::puts("  [ok] setPosition");
}

static void test_set_zoom() {
    CM cam; cam.init();
    cam.setZoom(2.f);
    assert(approx(cam.zoom(), 2.f));
    std::puts("  [ok] setZoom");
}

static void test_move_to_immediate() {
    CM cam; cam.init();
    cam.moveTo({ 50.f, 50.f }, 0.f);
    assert(approx(cam.position().x, 50.f) && approx(cam.position().y, 50.f));
    std::puts("  [ok] moveTo duration=0 snaps immediately");
}

static void test_move_to_lerp() {
    CM cam; cam.init();
    cam.setScreenSize(1280.f, 720.f);
    cam.setPosition({ 0.f, 0.f });
    cam.moveTo({ 100.f, 0.f }, 1.f);   // 1 s tween
    cam.update(0.5f);
    float x = cam.position().x;
    assert(x > 30.f && x < 70.f);   // ~50 at midpoint
    cam.update(0.6f);
    assert(approx(cam.position().x, 100.f, 1.f));
    std::puts("  [ok] moveTo lerp interpolates position");
}

static void test_zoom_to_lerp() {
    CM cam; cam.init();
    cam.zoomTo(2.f, 1.f);
    cam.update(0.5f);
    float z = cam.zoom();
    assert(z > 1.3f && z < 1.7f);
    cam.update(0.6f);
    assert(approx(cam.zoom(), 2.f, 0.01f));
    std::puts("  [ok] zoomTo lerp interpolates zoom");
}

static void test_follow_target() {
    CM cam; cam.init();
    cam.setPosition({ 0.f, 0.f });
    ArtCade::Vec2 target = { 200.f, 100.f };
    cam.setFollowTarget([&]{ return target; }, 10.f);
    cam.update(0.5f);   // large dt * speed → should move toward target
    float x = cam.position().x;
    assert(x > 10.f);
    std::puts("  [ok] follow target moves camera toward target");
}

static void test_world_to_screen_center() {
    CM cam; cam.init();
    cam.setScreenSize(1280.f, 720.f);
    cam.setPosition({ 0.f, 0.f });
    cam.setZoom(1.f);
    // World origin should map to screen center
    auto s = cam.worldToScreen({ 0.f, 0.f });
    assert(approx(s.x, 640.f) && approx(s.y, 360.f));
    std::puts("  [ok] worldToScreen: world origin → screen center");
}

static void test_screen_to_world_roundtrip() {
    CM cam; cam.init();
    cam.setScreenSize(1280.f, 720.f);
    cam.setPosition({ 50.f, -30.f });
    cam.setZoom(2.f);
    ArtCade::Vec2 world  = { 75.f, -15.f };
    auto screen = cam.worldToScreen(world);
    auto back   = cam.screenToWorld(screen);
    assert(approx(back.x, world.x, 0.01f) && approx(back.y, world.y, 0.01f));
    std::puts("  [ok] worldToScreen / screenToWorld roundtrip");
}

static void test_visible_bounds() {
    CM cam; cam.init();
    cam.setScreenSize(1280.f, 720.f);
    cam.setPosition({ 0.f, 0.f });
    cam.setZoom(1.f);
    ArtCade::Vec2 tl, br;
    cam.visibleBounds(tl, br);
    assert(approx(tl.x, -640.f) && approx(br.x, 640.f));
    assert(approx(tl.y, -360.f) && approx(br.y, 360.f));
    std::puts("  [ok] visibleBounds");
}

static void test_shake_adds_offset() {
    CM cam; cam.init();
    cam.setPosition({ 0.f, 0.f });
    cam.addTrauma(1.f);
    cam.update(0.016f);
    // With full trauma the shake offset should be non-zero
    auto p = cam.position();
    bool shook = (p.x != 0.f || p.y != 0.f);
    assert(shook);
    std::puts("  [ok] addTrauma produces non-zero shake offset");
}

static void test_trauma_decays() {
    CM cam; cam.init();
    cam.addTrauma(0.5f);
    // After enough time trauma should reach 0
    for (int i = 0; i < 100; ++i) cam.update(0.1f);
    // With decay rate 1.5/s, 0.5 trauma decays in ~0.33 s
    // After 10 s it must be 0 and position back to 0
    auto p = cam.position();
    assert(approx(p.x, 0.f, 0.01f) && approx(p.y, 0.f, 0.01f));
    std::puts("  [ok] trauma decays over time");
}

int main() {
    std::puts("=== CameraManager check ===");
    test_init();
    test_set_position();
    test_set_zoom();
    test_move_to_immediate();
    test_move_to_lerp();
    test_zoom_to_lerp();
    test_follow_target();
    test_world_to_screen_center();
    test_screen_to_world_roundtrip();
    test_visible_bounds();
    test_shake_adds_offset();
    test_trauma_decays();
    std::puts("=== all 12 tests passed ===");
    return 0;
}

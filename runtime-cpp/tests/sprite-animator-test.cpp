// sprite-animator-test.cpp
// Compile from runtime-cpp/tests/:
//   g++ -std=c++17 -I../src \
//       sprite-animator-test.cpp \
//       ../src/modules/sprite-animator/src/sprite-animator.cpp \
//       -o sprite_animator_test && ./sprite_animator_test

#include <cassert>
#include <cstdio>
#include <string>

#include "../src/modules/sprite-animator/include/sprite-animator.h"

using SA = ArtCade::Modules::SpriteAnimator;

// ------------------------------------------------------------------ helpers

static SA::Clip makeClip(const std::string& name, int frameCount,
                          float fps = 10.f, bool loop = true) {
    SA::Clip c;
    c.name  = name;
    c.fps   = fps;
    c.loop  = loop;
    for (int i = 0; i < frameCount; ++i)
        c.frames.push_back({ i * 32, 0, 32, 32 });
    return c;
}

// ------------------------------------------------------------------ tests

static void test_init_shutdown() {
    SA sa; sa.init();
    assert(!sa.hasClip("run"));
    sa.shutdown();
    std::puts("  [ok] init / shutdown");
}

static void test_define_and_has_clip() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4));
    assert(sa.hasClip("run"));
    assert(!sa.hasClip("jump"));
    std::puts("  [ok] defineClip / hasClip");
}

static void test_play_sets_frame_zero() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4));
    sa.play(1u, "run");
    assert(sa.isPlaying(1u));
    assert(sa.frameIndex(1u) == 0);
    assert(sa.currentClip(1u) == "run");
    std::puts("  [ok] play starts at frame 0");
}

static void test_update_advances_frames() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4, 10.f));   // 10 fps → 0.1 s/frame
    sa.play(1u, "run");
    sa.update(0.15f);   // should advance to frame 1
    assert(sa.frameIndex(1u) == 1);
    std::puts("  [ok] update advances frames");
}

static void test_loop_wraps_back_to_zero() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4, 10.f, true));
    sa.play(1u, "run");
    sa.update(0.45f);   // 4.5 frames → wraps once → frame 0 or 1 depending on partial
    int idx = sa.frameIndex(1u);
    assert(idx >= 0 && idx < 4);
    assert(sa.isPlaying(1u));  // still playing because loop=true
    std::puts("  [ok] looping clip wraps back");
}

static void test_non_loop_stops_at_last_frame() {
    SA sa; sa.init();
    sa.defineClip(makeClip("die", 3, 10.f, false));
    sa.play(1u, "die");
    sa.update(1.0f);   // way past end
    assert(!sa.isPlaying(1u));
    assert(sa.frameIndex(1u) == 2);   // last frame
    std::puts("  [ok] non-looping clip stops at last frame");
}

static void test_on_finish_callback() {
    SA sa; sa.init();
    sa.defineClip(makeClip("explode", 2, 10.f, false));
    bool fired = false;
    sa.play(1u, "explode", [&](uint32_t, const std::string& clip){
        fired = (clip == "explode");
    });
    sa.update(0.3f);   // past 2 frames
    assert(fired);
    std::puts("  [ok] onFinish callback fires");
}

static void test_pause_resume() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4, 10.f));
    sa.play(1u, "run");
    sa.update(0.15f);   // advance to frame 1
    sa.pause(1u);
    int idx = sa.frameIndex(1u);
    sa.update(0.5f);    // should NOT advance while paused
    assert(sa.frameIndex(1u) == idx);

    sa.resume(1u);
    sa.update(0.15f);
    assert(sa.frameIndex(1u) > idx);
    std::puts("  [ok] pause / resume");
}

static void test_stop() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4));
    sa.play(1u, "run");
    sa.stop(1u);
    assert(!sa.isPlaying(1u));
    std::puts("  [ok] stop");
}

static void test_seek_frame() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4));
    sa.play(1u, "run");
    sa.seekFrame(1u, 3);
    assert(sa.frameIndex(1u) == 3);
    std::puts("  [ok] seekFrame");
}

static void test_current_frame_rect() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4));
    sa.play(1u, "run");
    sa.seekFrame(1u, 2);
    auto f = sa.currentFrame(1u);
    assert(f.x == 64 && f.w == 32);   // 3rd frame at x=2*32=64
    std::puts("  [ok] currentFrame returns correct subrect");
}

static void test_remove_entity() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4));
    sa.play(1u, "run");
    sa.removeEntity(1u);
    assert(!sa.isPlaying(1u));
    assert(sa.frameIndex(1u) == -1);
    std::puts("  [ok] removeEntity clears instance");
}

static void test_independent_entities() {
    SA sa; sa.init();
    sa.defineClip(makeClip("run", 4, 10.f));
    sa.play(1u, "run");
    sa.play(2u, "run");
    sa.update(0.15f);
    sa.pause(1u);
    sa.update(0.15f);
    // entity 2 should be ahead of entity 1
    assert(sa.frameIndex(2u) > sa.frameIndex(1u));
    std::puts("  [ok] multiple entities are independent");
}

int main() {
    std::puts("=== SpriteAnimator check ===");
    test_init_shutdown();
    test_define_and_has_clip();
    test_play_sets_frame_zero();
    test_update_advances_frames();
    test_loop_wraps_back_to_zero();
    test_non_loop_stops_at_last_frame();
    test_on_finish_callback();
    test_pause_resume();
    test_stop();
    test_seek_frame();
    test_current_frame_rect();
    test_remove_entity();
    test_independent_entities();
    std::puts("=== all 13 tests passed ===");
    return 0;
}

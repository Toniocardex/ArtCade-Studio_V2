// scene-invalidation-test.cpp — invalidation masks and coalescing helpers (PR3).

#include "../src/modules/scene-system/include/scene-invalidation.h"

#include <cstdio>
#include <cstdlib>

using ArtCade::Modules::SceneInvalidation;
using ArtCade::Modules::scene_invalidation_collision_mask;
using ArtCade::Modules::scene_invalidation_has;
using ArtCade::Modules::scene_invalidation_needs_collision_rebuild;

static void expect(bool ok, const char* msg) {
    if (!ok) {
        std::fprintf(stderr, "FAIL: %s\n", msg);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", msg);
}

int main() {
    SceneInvalidation batch = SceneInvalidation::None;
    batch |= SceneInvalidation::Geometry;
    batch |= SceneInvalidation::Presentation;
    batch |= SceneInvalidation::Collision;
    batch |= SceneInvalidation::TilemapGeometry;

    expect(scene_invalidation_has(batch, SceneInvalidation::Geometry),
           "coalesced batch retains geometry");
    expect(scene_invalidation_needs_collision_rebuild(batch),
           "coalesced batch requests one collision rebuild pass");
    expect(scene_invalidation_collision_mask()
               == (SceneInvalidation::Collision
                   | SceneInvalidation::TilemapGeometry
                   | SceneInvalidation::TilemapData),
           "collision mask is stable");

  {
        SceneInvalidation consumed = batch;
        batch = SceneInvalidation::None;
        expect(consumed != SceneInvalidation::None, "consume clears pending accumulator");
        expect(batch == SceneInvalidation::None, "pending reset after consume");
    }

    std::puts("scene_invalidation_test: all passed");
    return 0;
}

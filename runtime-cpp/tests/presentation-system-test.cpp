// presentation-system-test.cpp — atomic committed snapshot per frame (Phase 2).

#include "../src/modules/presentation/include/presentation_system.h"
#include "../src/modules/presentation/include/surface_metrics.h"

#include <cmath>
#include <cstdlib>

using ArtCade::Presentation::PresentationMode;
using ArtCade::Presentation::PresentationSnapshot;
using ArtCade::Presentation::PresentationState;
using ArtCade::Presentation::PresentationSystem;
using ArtCade::Presentation::SurfacePoint;
using ArtCade::Presentation::ViewCamera2D;
using ArtCade::Presentation::WorldPoint;
using ArtCade::Presentation::surface_metrics_from_css;
using ArtCade::OutputPolicy;

static void expect(bool ok, const char* msg) {
    if (!ok) {
        std::fprintf(stderr, "FAIL: %s\n", msg);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", msg);
}

static PresentationState sample_state() {
    PresentationState state{};
    state.mode = PresentationMode::PlayEmbedded;
    state.outputPolicy = OutputPolicy::Fit;
    state.surface = surface_metrics_from_css(1920., 1080., 1.);
    state.logicalWidth = 320.;
    state.logicalHeight = 240.;
    state.gameViewCompositorEnabled = true;
    state.placement.destX = 320.;
    state.placement.destY = 60.;
    state.placement.destW = 1280.;
    state.placement.destH = 960.;
    state.placement.scaleX = 4.;
    state.placement.scaleY = 4.;
    state.placement.srcW = 320.;
    state.placement.srcH = 240.;
    state.pickingCamera = ViewCamera2D{ 0., 0., 0., 0., 1. };
    return state;
}

int main() {
    PresentationSystem system;
    system.mutable_state() = sample_state();
    system.refresh_snapshot();
    expect(system.committed_snapshot().revision == 1,
           "refresh_snapshot assigns initial revision");
    expect(system.pending_snapshot().revision == system.committed_snapshot().revision,
           "pending snapshot mirrors committed after refresh");

    const uint64_t revisionA = system.committed_snapshot().revision;
    system.begin_frame();
    const uint64_t revisionB = system.committed_snapshot().revision;
    expect(revisionB > revisionA, "begin_frame bumps revision");

    system.begin_frame();
    const uint64_t revisionC = system.committed_snapshot().revision;
    expect(revisionC > revisionB, "begin_frame keeps monotonic revisions");

    const PresentationSnapshot* found = system.find_snapshot(revisionB);
    expect(found != nullptr && found->revision == revisionB,
           "revision history retains prior snapshot");

    const WorldPoint world = system.committed_snapshot().surface_to_world(
        SurfacePoint{ 500., 360. });
    const SurfacePoint back = system.committed_snapshot().world_to_surface(world);
    expect(std::fabs(back.x - 500.) < 1e-5 && std::fabs(back.y - 360.) < 1e-5,
           "committed snapshot round-trip");

    std::puts("presentation_system_test: all passed");
    return 0;
}

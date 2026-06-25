// presentation-integration-test.cpp — renderer + picking share committed snapshot (Phase 2).

#include "../src/modules/renderer/include/renderer.h"
#include "../src/modules/presentation/include/presentation_mode.h"
#include "../src/core/types.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>

using ArtCade::Modules::Renderer;
using ArtCade::Presentation::SurfacePoint;

static bool near_eq(float a, float b, float eps = 0.001f) {
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
    renderer.setWindowSize(1280, 720, "integration-test");
    renderer.setSceneViewport({ 1280.f, 720.f }, { 1280.f, 720.f });
    renderer.setCameraZoom(2.f);
    renderer.setCameraPosition({ 640.f, 360.f });

    const uint64_t revision = renderer.presentationRevision();
    expect(revision >= 1, "projection refresh exposes committed revision");

    const auto viaRenderer = renderer.screenToWorld(100.f, 200.f);
    const auto& snapshot = renderer.committedPresentationSnapshot();
    expect(snapshot.revision == revision, "renderer and snapshot share revision");
    const auto viaSnapshot = snapshot.surface_to_world(SurfacePoint{ 100., 200. });
    expect(near_eq(viaRenderer.x, static_cast<float>(viaSnapshot.x))
           && near_eq(viaRenderer.y, static_cast<float>(viaSnapshot.y)),
           "screenToWorld matches committed snapshot");

    const auto layout = renderer.compositorLayout();
    expect(near_eq(static_cast<float>(layout.scaleX),
                   static_cast<float>(snapshot.placement.scaleX)),
           "compositorLayout reads committed placement");

    renderer.setGameViewCompositorEnabled(true);
    renderer.setPresentationMode(ArtCade::Presentation::PresentationMode::PlayEmbedded);
    renderer.setWindowSize(1920, 1080, "integration-fill");
    renderer.setSceneViewport({ 640.f, 480.f }, { 320.f, 240.f });
    renderer.setOutputPolicy(ArtCade::OutputPolicy::Fill);
    const auto& playSnapshot = renderer.committedPresentationSnapshot();
    const auto playWorld = renderer.screenToWorld(960.f, 540.f);
    const auto playSnap = playSnapshot.surface_to_world(SurfacePoint{ 960., 540. });
    expect(near_eq(playWorld.x, static_cast<float>(playSnap.x))
           && near_eq(playWorld.y, static_cast<float>(playSnap.y)),
           "play compositor picking uses committed snapshot");

    std::puts("presentation_integration_test: all passed");
    return 0;
}

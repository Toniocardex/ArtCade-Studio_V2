// presentation-camera-modes-test.cpp — Phase 3: dual camera, explicit modes, modifiers.

#include "../src/modules/renderer/include/renderer.h"
#include "../src/modules/presentation/include/presentation_bindings.h"
#include "../src/modules/presentation/include/presentation_mode.h"
#include "../src/modules/presentation/include/presentation_types.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>

using ArtCade::Modules::Renderer;
using ArtCade::Presentation::CameraModifiers;
using ArtCade::Presentation::PresentationBindings;
using ArtCade::Presentation::PresentationMode;
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
    renderer.setWindowSize(1280, 720, "camera-modes");
    renderer.setSceneViewport({ 2560.f, 1440.f }, { 1280.f, 720.f });
    renderer.setPresentationMode(PresentationMode::CameraPreview);
    renderer.setCameraZoom(2.f);
    renderer.setCameraPosition({ 100.f, 50.f });

    renderer.setEditorCamera({ 400.f, 300.f }, 1.5f);
    const auto gamePos = renderer.getCameraPosition();
    expect(near_eq(gamePos.x, 100.f) && near_eq(gamePos.y, 50.f),
           "setEditorCamera does not overwrite authoritative game camera");

    renderer.commitPresentationFrame();
    const auto& editSnapshot = renderer.committedPresentationSnapshot();
    const auto editPick = editSnapshot.surface_to_world(SurfacePoint{ 0., 0. });
    expect(near_eq(static_cast<float>(editPick.x), 400.f)
           && near_eq(static_cast<float>(editPick.y), 300.f),
           "SceneEdit picking uses editor camera");

    renderer.setPresentationMode(PresentationMode::CameraPreview);
    renderer.setSceneViewport({ 1280.f, 720.f }, { 1280.f, 720.f });
    renderer.setWindowSize(1280, 720, "camera-modes-refresh");
    renderer.commitPresentationFrame();
    const auto& playSnapshot = renderer.committedPresentationSnapshot();
    const auto playPick = playSnapshot.surface_to_world(SurfacePoint{ 0., 0. });
    expect(near_eq(static_cast<float>(playPick.x), 100.f)
           && near_eq(static_cast<float>(playPick.y), 50.f),
           "CameraPreview picking uses game camera");

    renderer.setGameCameraModifiers({ 30., -20., 1., 0. });
    renderer.commitPresentationFrame();
    const auto pickWithShake = PresentationBindings::surface_to_world(
        renderer.committedPresentationSnapshot(), SurfacePoint{ 200., 300. });
    renderer.setGameCameraModifiers({});
    renderer.commitPresentationFrame();
    const auto pickNoShake = PresentationBindings::surface_to_world(
        renderer.committedPresentationSnapshot(), SurfacePoint{ 200., 300. });
    expect(!near_eq(static_cast<float>(pickWithShake.x), static_cast<float>(pickNoShake.x))
           || !near_eq(static_cast<float>(pickWithShake.y), static_cast<float>(pickNoShake.y)),
           "shake modifiers affect picking through the effective camera");

    renderer.setGameViewCompositorEnabled(true);
    renderer.setPresentationMode(PresentationMode::PlayEmbedded);
    renderer.setWindowSize(1920, 1080, "play-embedded");
    renderer.setSceneViewport({ 640.f, 480.f }, { 320.f, 240.f });
    renderer.setCameraPosition({ 0.f, 0.f });
    expect(renderer.presentationMode() == PresentationMode::PlayEmbedded,
           "explicit PlayEmbedded mode is preserved");

    std::puts("presentation_camera_modes_test: all passed");
    return 0;
}

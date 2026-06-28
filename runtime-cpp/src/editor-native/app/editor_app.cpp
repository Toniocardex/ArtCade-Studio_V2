#include "editor-native/app/editor_app.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/app/editor_input.h"
#include "editor-native/app/input_routing.h"
#include "editor-native/app/rml_host.h"
#include "editor-native/commands/editor_intent.h"
#include "editor-native/demo/demo_project.h"
#include "editor-native/model/play_session.h"
#include "editor-native/model/scene_frame_snapshot.h"
#include "editor-native/ui/editor_ui.h"
#include "editor-native/view/scene_view.h"
#include "editor-native/view/texture_cache.h"

#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>

#include <raylib.h>

#include <cstring>
#include <filesystem>
#include <string>
#include <unordered_map>

namespace ArtCade::EditorNative {

namespace {

ViewportRect viewportRectFromDocument(Rml::ElementDocument* document) {
    ViewportRect rect;
    if (!document) return rect;
    if (Rml::Element* vp = document->GetElementById("viewport")) {
        const Rml::Vector2f off = vp->GetAbsoluteOffset();
        rect.x = static_cast<int>(off.x);
        rect.y = static_cast<int>(off.y);
        rect.width  = static_cast<int>(vp->GetClientWidth());
        rect.height = static_cast<int>(vp->GetClientHeight());
    }
    return rect;
}

void routeViewportInput(EditorCoordinator& coordinator, const ViewportRect& rect,
                        const RmlInputResult& rml) {
    // Inside the viewport region we are not over a panel; a focused text field
    // still blocks the viewport (prompt §19 / §24.16).
    const ViewportInputContext ctx{
        rect.contains(GetMouseX(), GetMouseY()),
        /*rmlConsumedEvent*/ false,
        rml.textFocus,
        /*rmlPopupOpen*/ false,
    };
    if (!shouldViewportReceiveInput(ctx)) return;

    const PlaySession* playSession = coordinator.playSession();
    const SceneId active = playSession ? playSession->sceneId()
                                       : coordinator.state().activeSceneId;
    const float zoom = coordinator.sceneView(active).zoom;

    const float wheel = GetMouseWheelMove();
    if (wheel != 0.0f)
        coordinator.apply(SetViewportZoomIntent{active, zoom * (1.0f + wheel * 0.1f)});

    if (IsMouseButtonDown(MOUSE_BUTTON_MIDDLE) || IsMouseButtonDown(MOUSE_BUTTON_RIGHT)) {
        const Vector2 d = GetMouseDelta();
        coordinator.apply(PanViewportIntent{active, {-d.x / zoom, -d.y / zoom}});
    }
}

void routePlayRuntimeInput(PlaySession& session, const RmlInputResult& rml) {
    if (rml.textFocus) return;
    Vec2 delta{};
    const float step = IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT) ? 4.f : 1.f;
    if (IsKeyDown(KEY_RIGHT) || IsKeyDown(KEY_D)) delta.x += step;
    if (IsKeyDown(KEY_LEFT)  || IsKeyDown(KEY_A)) delta.x -= step;
    if (IsKeyDown(KEY_DOWN)  || IsKeyDown(KEY_S)) delta.y += step;
    if (IsKeyDown(KEY_UP)    || IsKeyDown(KEY_W)) delta.y -= step;
    if (delta.x == 0.f && delta.y == 0.f) return;
    if (!session.entities().empty()) {
        (void)session.translateEntity(session.entities().front().id, delta);
    }
}

std::filesystem::path editorResourceRoot() {
    return std::filesystem::path(GetApplicationDirectory()) / "resources";
}

void applyWindowIcon(const std::filesystem::path& resourceRoot) {
    const std::string iconPath = (resourceRoot / "app-icon.png").string();
    Image icon = LoadImage(iconPath.c_str());
    if (!icon.data) {
        TraceLog(LOG_WARNING, "[editor] failed to load window icon: %s", iconPath.c_str());
        return;
    }
    SetWindowIcon(icon);
    UnloadImage(icon);
}

std::filesystem::path resolveImageAssetPath(const std::filesystem::path& resourceRoot,
                                            const std::string& sourcePath) {
    if (sourcePath.empty()) return {};
    const std::filesystem::path path(sourcePath);
    if (path.is_absolute()) return path.lexically_normal();
    return std::filesystem::absolute(resourceRoot / path).lexically_normal();
}

std::unordered_map<AssetId, TextureRequest> textureRequestsFor(
    const ProjectDoc& doc, const std::filesystem::path& resourceRoot) {
    std::unordered_map<AssetId, TextureRequest> out;
    for (const ImageAssetDef& asset : doc.imageAssets) {
        out.emplace(asset.assetId, TextureRequest{
            asset.assetId,
            resolveImageAssetPath(resourceRoot, asset.sourcePath),
        });
    }
    return out;
}

std::unordered_map<AssetId, TextureRequest> textureRequestsFor(
    const PlayAssetCatalogSnapshot& catalog, const std::filesystem::path& resourceRoot) {
    std::unordered_map<AssetId, TextureRequest> out;
    for (const auto& [assetId, asset] : catalog.imageAssets) {
        out.emplace(assetId, TextureRequest{
            assetId,
            resolveImageAssetPath(resourceRoot, asset.sourcePath),
        });
    }
    return out;
}

} // namespace

int EditorApp::run(int argc, char** argv) {
    // Optional one-shot screenshot mode: "--shot <path>" renders a few frames,
    // captures the framebuffer and exits. Used to verify the shell renders.
    std::string shotPath;
    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--shot") == 0 && i + 1 < argc) shotPath = argv[i + 1];
    }

    EditorCoordinator coordinator(makeDemoProject());

    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT);
    InitWindow(1340, 840, "ArtCade Studio");
    const std::filesystem::path resourceRoot = editorResourceRoot();
    applyWindowIcon(resourceRoot);
    MaximizeWindow();
    SetExitKey(KEY_NULL);
    SetTargetFPS(60);

    const float dpi = GetWindowScaleDPI().x;
    RmlHost host;
    if (!host.initialize(GetScreenWidth(), GetScreenHeight(), dpi > 0.f ? dpi : 1.f,
                         resourceRoot, "ui/editor_shell.rml")) {
        TraceLog(LOG_ERROR, "[editor] failed to load native editor resources from %s",
                 resourceRoot.string().c_str());
        host.shutdown();
        CloseWindow();
        return 1;
    }

    EditorUi ui(coordinator, host.document());
    ui.bind();
    // Default focus so the inspector shows the headline Position fields.
    coordinator.apply(SelectEntityIntent{1});
    coordinator.logInfo("ArtCade Studio ready.");
    SceneView sceneView;
    TextureCache textureCache;

    int frame = 0;
    while (!WindowShouldClose()) {
        if (IsWindowResized())
            host.resize(GetScreenWidth(), GetScreenHeight(), GetWindowScaleDPI().x);
        if (IsKeyPressed(KEY_F8)) host.toggleDebugger();

        const RmlInputResult rml = pumpRmlInput(host.context());
        const ViewportRect rect = viewportRectFromDocument(host.document());
        routeViewportInput(coordinator, rect, rml);
        if (PlaySession* playSession = coordinator.playSession()) {
            routePlayRuntimeInput(*playSession, rml);
        }

        ui.processFrame();
        host.update();

        BeginDrawing();
        ClearBackground(Color{15, 16, 20, 255});
        const PlaySession* playSession = coordinator.playSession();
        const SceneId active = playSession ? playSession->sceneId()
                                           : coordinator.state().activeSceneId;
        const SceneFrameSnapshot snapshot = playSession
            ? collectSceneFrameSnapshot(*playSession)
            : collectSceneFrameSnapshot(coordinator.document(), active,
                                        coordinator.selection().primaryEntity);
        const auto textureRequests = playSession
            ? textureRequestsFor(playSession->assets(), resourceRoot)
            : textureRequestsFor(coordinator.document().data(), resourceRoot);
        textureCache.prepare(snapshot.sprites, textureRequests);
        sceneView.render(snapshot, coordinator.sceneView(active), rect, textureCache);
        host.render();
        EndDrawing();

        if (!shotPath.empty() && ++frame == 12) {
            TakeScreenshot(shotPath.c_str());
            break;
        }
    }

    textureCache.clear();
    host.shutdown();
    CloseWindow();
    return 0;
}

} // namespace ArtCade::EditorNative

#include "editor-native/app/editor_app.h"

#include "editor-native/app/asset_import.h"
#include "editor-native/app/confirm_dialog.h"
#include "editor-native/app/editor_coordinator.h"
#include "editor-native/app/editor_input.h"
#include "editor-native/app/file_dialog.h"
#include "editor-native/app/input_routing.h"
#include "editor-native/app/project_file.h"
#include "editor-native/app/rml_host.h"
#include "editor-native/app/unsaved_guard.h"
#include "editor-native/commands/editor_intent.h"
#include "editor-native/commands/entity_commands.h"
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
#include <optional>
#include <string>
#include <unordered_map>

// raylib (5.0) has no public way to cancel a requested window close, so we reset
// GLFW's flag directly to keep the app open when the user picks Cancel in the
// unsaved-changes guard. GetWindowHandle() returns the GLFWwindow*.
extern "C" void glfwSetWindowShouldClose(void* window, int value);

namespace ArtCade::EditorNative {

namespace {

// HiDPI bridge: RmlUi runs in physical framebuffer pixels (GetRenderWidth),
// while raylib's drawing and mouse stay in logical pixels (GetScreenWidth) —
// raylib applies the DPI scale itself via screenScale / SetMouseScale. The
// factor is 1.0 on a 100% display, so this is a no-op there.
float uiPixelScaleX() {
    const int sw = GetScreenWidth();
    return sw > 0 ? static_cast<float>(GetRenderWidth()) / static_cast<float>(sw) : 1.f;
}
float uiPixelScaleY() {
    const int sh = GetScreenHeight();
    return sh > 0 ? static_cast<float>(GetRenderHeight()) / static_cast<float>(sh) : 1.f;
}

// The viewport element is laid out in RmlUi's physical-pixel space; the raylib
// scene renderer and pick/drag hit-testing both work in logical pixels, so the
// rect is converted physical -> logical here once at the boundary.
ViewportRect viewportRectFromDocument(Rml::ElementDocument* document) {
    ViewportRect rect;
    if (!document) return rect;
    const float sx = uiPixelScaleX();
    const float sy = uiPixelScaleY();
    if (Rml::Element* vp = document->GetElementById("viewport")) {
        const Rml::Vector2f off = vp->GetAbsoluteOffset();
        rect.x = static_cast<int>(off.x / sx);
        rect.y = static_cast<int>(off.y / sy);
        rect.width  = static_cast<int>(vp->GetClientWidth()  / sx);
        rect.height = static_cast<int>(vp->GetClientHeight() / sy);
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

// Transient viewport drag state — local presentation only (prompt §3: "valori
// temporanei durante un drag"). It never enters ProjectDocument; the single
// SetEntityPositionCommand is issued once, on release.
struct ViewportDrag {
    bool     active = false;
    EntityId entity = INVALID_ENTITY;
    Vec2     startMouseWorld{};
    Vec2     startEntityPos{};
};

// Edit-mode pick + drag: press hit-tests and selects; release commits one move.
// Motion between press and release is shown as a local preview by the draw path,
// not as a stream of commands.
void routeViewportPickDrag(EditorCoordinator& coordinator, const ViewportRect& rect,
                           const RmlInputResult& rml, ViewportDrag& drag) {
    const SceneId active = coordinator.state().activeSceneId;
    const SceneFrameSnapshot frame = collectSceneFrameSnapshot(
        coordinator.document(), active, coordinator.selection().primaryEntity);
    const SceneViewCamera cam =
        makeSceneViewCamera(rect, coordinator.sceneView(active), frame.worldSize);
    const Vec2 mouse{static_cast<float>(GetMouseX()), static_cast<float>(GetMouseY())};

    if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT)) {
        const ViewportInputContext ctx{rect.contains(GetMouseX(), GetMouseY()),
                                       /*rmlConsumedEvent*/ false, rml.textFocus,
                                       /*rmlPopupOpen*/ false};
        if (shouldViewportReceiveInput(ctx)) {
            const Vec2 world = screenToWorld(cam, mouse);
            const EntityId picked = pickEntityAt(frame, world);
            coordinator.apply(SelectEntityIntent{picked});   // INVALID clears selection
            if (picked != INVALID_ENTITY) {
                if (const SceneInstanceDef* inst =
                        coordinator.document().findInstanceInScene(active, picked)) {
                    drag = ViewportDrag{true, picked, world, inst->transform.position};
                }
            }
        }
    }

    if (drag.active && IsMouseButtonReleased(MOUSE_BUTTON_LEFT)) {
        const Vec2 world = screenToWorld(cam, mouse);
        const Vec2 delta{world.x - drag.startMouseWorld.x, world.y - drag.startMouseWorld.y};
        if (delta.x != 0.f || delta.y != 0.f) {
            coordinator.execute(SetEntityPositionCommand{
                active, drag.entity,
                Vec2{drag.startEntityPos.x + delta.x, drag.startEntityPos.y + delta.y}});
        }
        drag = ViewportDrag{};
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

    // Start empty: the editor opens a real project (File > Open) or builds one
    // from scratch (add scene/entity, import assets, Save As). No bundled demo.
    EditorCoordinator coordinator{ProjectDoc{}};

    // FLAG_WINDOW_HIGHDPI: create a framebuffer at the monitor's physical
    // resolution so RmlUi rasterises and renders at real pixels (crisp text on
    // scaled displays) instead of being upscaled from a logical-size buffer.
    SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT |
                   FLAG_WINDOW_HIGHDPI);
    InitWindow(1340, 840, "ArtCade Studio");
    const std::filesystem::path resourceRoot = editorResourceRoot();
    applyWindowIcon(resourceRoot);
    MaximizeWindow();
    SetExitKey(KEY_NULL);
    SetTargetFPS(60);

    // RmlUi context + viewport are sized in physical framebuffer pixels; the dp
    // ratio scales `dp` lengths in the RCSS so the UI keeps its intended size.
    float dpi = GetWindowScaleDPI().x;
    RmlHost host;
    if (!host.initialize(GetRenderWidth(), GetRenderHeight(), dpi > 0.f ? dpi : 1.f,
                         resourceRoot, "ui/editor_shell.rml")) {
        TraceLog(LOG_ERROR, "[editor] failed to load native editor resources from %s",
                 resourceRoot.string().c_str());
        host.shutdown();
        CloseWindow();
        return 1;
    }

    EditorUi ui(coordinator, host.document());
    ui.bind();
    coordinator.logInfo("ArtCade Studio ready.");
    SceneView sceneView;
    TextureCache textureCache;
    ViewportDrag drag;

    // Project I/O is owned by the application: it holds the texture cache it must
    // clear when the document is replaced, and the platform file pickers. The UI
    // only requests these operations; it never touches files or the renderer.
    std::filesystem::path currentProjectPath;
    // The window title reflects the current project: its file name, or "Untitled"
    // before the first Save As. Kept truthful wherever the path changes (New,
    // Open, Save), so "Untitled" means "no destination on disk yet", which is
    // distinct from dirty (content differs from the last baseline).
    const auto refreshWindowTitle = [&]() {
        const std::string name = currentProjectPath.empty()
            ? std::string("Untitled")
            : currentProjectPath.stem().string();
        SetWindowTitle(("ArtCade Studio - " + name).c_str());
    };
    const auto saveTo = [&](const std::filesystem::path& path) -> bool {
        const ProjectSaveResult result = saveProjectToFile(coordinator, path);
        if (!result.ok) {
            coordinator.logError("Save failed: " + result.error.message);
            return false;
        }
        currentProjectPath = path;
        refreshWindowTitle();
        coordinator.logInfo("Saved " + path.filename().string());
        return true;
    };
    // Save to the current path, or prompt for one. False when cancelled or failed.
    const auto saveCurrent = [&]() -> bool {
        if (currentProjectPath.empty()) {
            const auto picked = saveProjectFileDialog(currentProjectPath);
            return picked ? saveTo(*picked) : false;
        }
        return saveTo(currentProjectPath);
    };
    // Unsaved-changes guard for destructive actions. Returns true to proceed.
    const auto guardPasses = [&]() -> bool {
        if (!coordinator.document().isDirty()) return true;
        const UnsavedChoice choice = confirmUnsavedChanges();
        const bool saveOk = (choice == UnsavedChoice::Save) ? saveCurrent() : false;
        return resolveUnsavedGuard(true, choice, saveOk) == GuardOutcome::Proceed;
    };
    ui.setProjectFileHandlers(
        [&]() {  // New
            if (coordinator.isPlaying()) {
                coordinator.logWarning("Stop Play before creating a new project");
                return;  // no hidden auto-stop
            }
            if (!guardPasses()) return;     // dirty + Cancel / failed Save: abort
            coordinator.replaceProject(ProjectDocument{ProjectDoc{}});  // empty valid project
            textureCache.clear();           // explicit app path consuming ProjectReplaced
            currentProjectPath.clear();     // a new project has no destination yet
            refreshWindowTitle();           // -> "Untitled"
            coordinator.logInfo("New project");
        },
        [&]() {  // Open
            if (coordinator.isPlaying()) {
                coordinator.logWarning("Stop Play before opening another project");
                return;
            }
            if (!guardPasses()) return;     // dirty + Cancel / failed Save: abort
            const std::optional<std::filesystem::path> picked = openProjectFileDialog();
            if (!picked) return;  // cancelled
            const ProjectLoadResult result = loadProjectFromFile(coordinator, *picked);
            if (!result.ok) {
                coordinator.logError("Open failed: " + result.error.message);
                return;
            }
            textureCache.clear();  // explicit app path consuming ProjectReplaced
            currentProjectPath = *picked;
            refreshWindowTitle();
            coordinator.logInfo("Opened " + picked->filename().string());
        },
        [&]() {  // Save (Save As when no current path)
            saveCurrent();
        },
        [&]() {  // Save As
            if (const auto picked = saveProjectFileDialog(currentProjectPath))
                saveTo(*picked);
        });

    // Import is one canonical pipeline (asset_import). This is only the trigger:
    // pick the file for the kind, then converge on importAsset like any other UI
    // source would.
    ui.setImportHandler([&](AssetKind kind) {
        std::optional<std::filesystem::path> picked;
        switch (kind) {
            case AssetKind::Image: picked = openImageFileDialog(); break;
            case AssetKind::Audio: picked = openAudioFileDialog(); break;
            case AssetKind::Font:  picked = openFontFileDialog();  break;
        }
        if (!picked) return;  // cancelled
        const std::filesystem::path projectRoot =
            currentProjectPath.empty() ? std::filesystem::path{} : currentProjectPath.parent_path();
        ImportAssetRequest request;
        request.kind = kind;
        request.sourcePath = *picked;
        const ImportAssetResult result = importAsset(coordinator, projectRoot, request);
        if (!result.ok) coordinator.logError(result.error);
        else            coordinator.logInfo("Imported " + result.assetId);
    });

    refreshWindowTitle();   // empty start project -> "Untitled"

    int   frame       = 0;
    int   lastRenderW = GetRenderWidth();
    int   lastRenderH = GetRenderHeight();
    float lastDpi     = dpi > 0.f ? dpi : 1.f;
    while (true) {
        // Exit guard: a requested close (window X) is held until the unsaved
        // guard passes. On Cancel we clear GLFW's close flag and keep running.
        // Screenshot mode skips the guard (no window interaction).
        if (WindowShouldClose()) {
            if (shotPath.empty() && !guardPasses()) {
                glfwSetWindowShouldClose(GetWindowHandle(), 0);
            } else {
                break;
            }
        }

        // Re-sync RmlUi on a resize *or* a DPI change (e.g. the window dragged
        // onto a monitor with different scaling): both alter the physical
        // framebuffer size and/or the dp ratio, and must stay in lockstep.
        const int   renderW = GetRenderWidth();
        const int   renderH = GetRenderHeight();
        const float curDpi  = GetWindowScaleDPI().x > 0.f ? GetWindowScaleDPI().x : 1.f;
        if (renderW != lastRenderW || renderH != lastRenderH || curDpi != lastDpi) {
            host.resize(renderW, renderH, curDpi);
            lastRenderW = renderW;
            lastRenderH = renderH;
            lastDpi     = curDpi;
        }
        if (IsKeyPressed(KEY_F8)) host.toggleDebugger();

        const RmlInputResult rml = pumpRmlInput(host.context());

        // Undo/redo keyboard shortcuts share the single coordinator entry points
        // with the toolbar buttons; suppressed while a text field has focus, and
        // guarded against Play by the coordinator. Ctrl+Z = undo; Ctrl+Y or
        // Ctrl+Shift+Z = redo.
        if (!rml.textFocus
            && (IsKeyDown(KEY_LEFT_CONTROL) || IsKeyDown(KEY_RIGHT_CONTROL))) {
            const bool shift = IsKeyDown(KEY_LEFT_SHIFT) || IsKeyDown(KEY_RIGHT_SHIFT);
            if (IsKeyPressed(KEY_Y) || (shift && IsKeyPressed(KEY_Z))) {
                coordinator.redo();
            } else if (IsKeyPressed(KEY_Z)) {
                coordinator.undo();
            } else if (IsKeyPressed(KEY_C)) {
                // Copy the selected Console message. A focused RmlUi text field
                // keeps its own Ctrl+C (guarded by textFocus above); with no
                // selection this is a no-op.
                ui.copySelectedConsoleMessage();
            }
        }

        const ViewportRect rect = viewportRectFromDocument(host.document());
        routeViewportInput(coordinator, rect, rml);
        if (coordinator.isPlaying()) {
            const float dt = GetFrameTime();
            coordinator.advanceRuntime(dt);               // authored motion (LinearMover)
            // Gameplay input is neutral while a text field has focus.
            RuntimeInputSnapshot input;
            if (!rml.textFocus) {
                input.moveLeft  = IsKeyDown(KEY_LEFT)  || IsKeyDown(KEY_A);
                input.moveRight = IsKeyDown(KEY_RIGHT) || IsKeyDown(KEY_D);
                input.moveUp    = IsKeyDown(KEY_UP)    || IsKeyDown(KEY_W);
                input.moveDown  = IsKeyDown(KEY_DOWN)  || IsKeyDown(KEY_S);
            }
            coordinator.updateRuntime(input, dt);         // input-driven (TopDownController)
        } else {
            routeViewportPickDrag(coordinator, rect, rml, drag);
        }

        ui.processFrame();
        host.update();

        BeginDrawing();
        ClearBackground(Color{15, 16, 20, 255});
        const PlaySession* playSession = coordinator.playSession();
        const SceneId active = playSession ? playSession->sceneId()
                                           : coordinator.state().activeSceneId;
        SceneFrameSnapshot snapshot = playSession
            ? collectSceneFrameSnapshot(*playSession)
            : collectSceneFrameSnapshot(coordinator.document(), active,
                                        coordinator.selection().primaryEntity);
        if (!playSession && drag.active) {
            // Local drag preview: offset the dragged entity by the live delta so
            // the move is visible before the single command lands on release.
            const SceneViewCamera cam =
                makeSceneViewCamera(rect, coordinator.sceneView(active), snapshot.worldSize);
            const Vec2 cur = screenToWorld(cam, Vec2{static_cast<float>(GetMouseX()),
                                                     static_cast<float>(GetMouseY())});
            const Vec2 d{cur.x - drag.startMouseWorld.x, cur.y - drag.startMouseWorld.y};
            for (SceneFrameEntity& e : snapshot.entities)
                if (e.entityId == drag.entity) { e.bounds.x += d.x; e.bounds.y += d.y; }
            for (SceneFrameSprite& s : snapshot.sprites)
                if (s.entityId == drag.entity) { s.destination.x += d.x; s.destination.y += d.y; }
        }
        // Sprite source paths are relative to the loaded project; with no project
        // open yet (a new/Untitled project) they fall back to the executable resources.
        const std::filesystem::path assetRoot =
            currentProjectPath.empty() ? resourceRoot : currentProjectPath.parent_path();
        const auto textureRequests = playSession
            ? textureRequestsFor(playSession->assets(), assetRoot)
            : textureRequestsFor(coordinator.document().data(), assetRoot);
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

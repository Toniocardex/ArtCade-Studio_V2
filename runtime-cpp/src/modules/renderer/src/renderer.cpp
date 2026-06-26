#include "../include/renderer.h"
#include "../include/compositor-layout.h"
#include "../../presentation/include/camera_compose.h"
#include "../../presentation/include/coordinate_mapper.h"
#include "../../presentation/include/output_policy.h"
#include "../../presentation/include/presentation_mode.h"
#include "../../presentation/include/presentation_types.h"
#include "../../presentation/include/presentation_system.h"
#include "../../presentation/include/surface_metrics.h"
#include "../../presentation/include/view_controller.h"
#include "../../../core/project-defaults.h"
#include "sprite-outline-shader.h"
#include "texture-cache.h"
#include "font-cache.h"
#include "../../../core/sprite-draw-math.h"
#include <raylib.h>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <vector>

namespace ArtCade::Modules {

namespace {

using ArtCade::Presentation::OutputPlacement;
using ArtCade::Presentation::CameraModifiers;
using ArtCade::Presentation::EditorCamera;
using ArtCade::Presentation::GameCameraState;
using ArtCade::Presentation::PresentationMode;
using ArtCade::Presentation::compose_effective_game_camera;
using ArtCade::Presentation::view_camera_from_editor;
using ArtCade::Presentation::view_camera_from_effective;
using ArtCade::Presentation::SurfacePoint;
using ArtCade::Presentation::ViewCamera2D;
using ArtCade::Presentation::WorldPoint;
using ArtCade::Presentation::surface_metrics_from_css;
using ArtCade::Presentation::EditorViewState;
using ArtCade::Presentation::ViewController;

ViewCamera2D to_view_camera(const Camera2D& cam) {
    return {
        static_cast<double>(cam.target.x),
        static_cast<double>(cam.target.y),
        static_cast<double>(cam.offset.x),
        static_cast<double>(cam.offset.y),
        static_cast<double>(cam.zoom),
    };
}

OutputPlacement identity_surface_placement(double surfaceW, double surfaceH) {
    OutputPlacement placement{};
    placement.destW = surfaceW;
    placement.destH = surfaceH;
    placement.srcW = surfaceW;
    placement.srcH = surfaceH;
    placement.scaleX = 1.;
    placement.scaleY = 1.;
    return placement;
}

void apply_game_modifiers_to_frame_camera(Camera2D& frameCamera,
                                          const CameraModifiers& modifiers) {
    const float zoom = (frameCamera.zoom > 0.f) ? frameCamera.zoom : 1.f;
    frameCamera.offset.x += static_cast<float>(modifiers.translationOffsetX) * zoom;
    frameCamera.offset.y += static_cast<float>(modifiers.translationOffsetY) * zoom;
    frameCamera.rotation += static_cast<float>(modifiers.rotationOffset);
}

} // namespace

// ------------------------------------------------------------------ Pimpl

// Deferred draw command — queued during tick(), flushed in endFrame().
struct DrawCmd {
    enum class Type { Rect, Line, Circle, Text, Image } type = Type::Rect;
    float x  = 0.f, y  = 0.f;  // position / start
    float x2 = 0.f, y2 = 0.f;  // end (Line) or w/h (Rect)
    float r  = 0.f;             // radius (Circle)
    int   fontSize = 20;        // Text font size
    int   align    = 0;         // Text: 0=left, 1=center, 2=right of (x,y)
    int   valign   = 0;         // Text: 0=top, 1=middle, 2=bottom of (x,y)
    std::string text;           // Text content
    std::string fontPath;       // empty = Raylib default bitmap font
    std::string assetId;        // Image texture key
    unsigned char cr=255, cg=255, cb=255, ca=255;  // packed colour
};

// Draw one Text command (align + font already resolved). Shared by the
// world pass (camera space) and the screen pass (HUD).
static void drawTextCommand(const DrawCmd& cmd, const Font* font) {
    Color c{ cmd.cr, cmd.cg, cmd.cb, cmd.ca };
    float drawX = cmd.x;
    float drawY = cmd.y;
    if (cmd.align != 0) {
        const float w = font
            ? MeasureTextEx(*font, cmd.text.c_str(),
                            static_cast<float>(cmd.fontSize), 1.f).x
            : static_cast<float>(MeasureText(cmd.text.c_str(), cmd.fontSize));
        drawX -= (cmd.align == 1) ? w * 0.5f : w;
    }
    if (cmd.valign != 0) {
        // Single-line label: height is the font size (MeasureTextEx.y matches it).
        const float h = font
            ? MeasureTextEx(*font, cmd.text.c_str(),
                            static_cast<float>(cmd.fontSize), 1.f).y
            : static_cast<float>(cmd.fontSize);
        drawY -= (cmd.valign == 1) ? h * 0.5f : h;
    }
    if (font) {
        DrawTextEx(*font, cmd.text.c_str(), Vector2{ drawX, drawY },
                   static_cast<float>(cmd.fontSize), 1.f, c);
    } else {
        DrawText(cmd.text.c_str(),
                 static_cast<int>(drawX), static_cast<int>(drawY),
                 cmd.fontSize, c);
    }
}

static bool drawImageCommand(TextureCache& texCache,
                             const std::string& textureKey,
                             const DrawCmd& cmd) {
    const Texture2D* tex = texCache.getByPath(textureKey);
    if (!tex || tex->id == 0) {
        texCache.load(textureKey);
        tex = texCache.getByPath(textureKey);
    }
    if (!tex || tex->id == 0) return false;

    DrawTexturePro(*tex,
                   Rectangle{ 0.f, 0.f,
                              static_cast<float>(tex->width),
                              static_cast<float>(tex->height) },
                   Rectangle{ cmd.x, cmd.y, cmd.x2, cmd.y2 },
                   Vector2{ 0.f, 0.f },
                   0.f,
                   Color{ 255, 255, 255, cmd.ca });
    return true;
}

struct Renderer::Impl {
    uint32_t    width  = 1280;
    uint32_t    height = 720;
    std::string title  = "ArtCade V2";
    bool        open   = false;
    Vec2        worldSize = {
        ProjectDefaults::kSceneWorldWidth,
        ProjectDefaults::kSceneWorldHeight,
    };
    Vec2        viewportSize = {
        ProjectDefaults::kSceneViewportWidth,
        ProjectDefaults::kSceneViewportHeight,
    };

    Camera2D camera = {};
    Camera2D gameViewCamera = {};
    float cameraZoom = 1.f;
    float displayScale = 1.f;
    Vec2  viewportOffset = { 0.f, 0.f };
    Vec2  viewportDrawSize = {
        ProjectDefaults::kSceneViewportWidth,
        ProjectDefaults::kSceneViewportHeight,
    };
    EditorCamera storedEditorCamera_{};
    GameCameraState storedGameCamera_{};
    CameraModifiers gameModifiers_{};
    bool worldScissorActive = false;
    bool gameViewCompositorEnabled = false;
    bool inGameViewTexturePass = false;
    PresentationMode presentationMode = PresentationMode::CameraPreview;
    OutputPolicy outputPolicy = OutputPolicy::Fit;
    CompositorLayout compositorLayout{};
    ArtCade::Presentation::PresentationSystem presentation;
    ViewController viewController;
    float editorSurfaceDpr = 1.f;

    void syncViewControllerMetrics() {
        const double dpr = editorSurfaceDpr > 0.f
            ? static_cast<double>(editorSurfaceDpr)
            : 1.;
        const double cssW = static_cast<double>(width) / dpr;
        const double cssH = static_cast<double>(height) / dpr;
        viewController.set_surface_metrics(
            surface_metrics_from_css(cssW, cssH, dpr));
    }

    void syncViewControllerFromEditorCamera() {
        EditorViewState view{};
        view.positionX = storedEditorCamera_.positionX;
        view.positionY = storedEditorCamera_.positionY;
        view.zoom = storedEditorCamera_.zoom > 0.
            ? storedEditorCamera_.zoom
            : 1.;
        viewController.set_editor_view(view);
        syncViewControllerMetrics();
    }

    void applyViewControllerToEditorCamera() {
        const EditorViewState& view = viewController.editor_view();
        storedEditorCamera_.positionX = view.positionX;
        storedEditorCamera_.positionY = view.positionY;
        storedEditorCamera_.zoom = view.zoom > 0. ? view.zoom : 1.;
        presentationMode = PresentationMode::SceneEdit;
        displayScale = 1.f;
        viewportOffset = { 0.f, 0.f };
        viewportDrawSize = {
            static_cast<float>(width),
            static_cast<float>(height),
        };
        syncActiveCameraFromStores();
        updateGameViewCamera();
        syncPresentationState();
        presentation.refresh_snapshot();
    }

    static SurfacePoint css_to_surface(float cssX, float cssY, float dpr) {
        const double scale = dpr > 0.f ? static_cast<double>(dpr) : 1.;
        return { static_cast<double>(cssX) * scale,
                 static_cast<double>(cssY) * scale };
    }
    struct GameViewTarget {
        RenderTexture2D rt{};
        uint32_t w = 0;
        uint32_t h = 0;
    } gameView;
    TextureCache texCache;
    FontCache    fontCache;

    // Draw commands queued by Lua during tick(); flushed in endFrame().
    std::vector<DrawCmd> drawQueue;
    // Screen-space (HUD) draws (text + rects), flushed after EndMode2D so the
    // camera does not transform them — stay fixed on screen as the world scrolls.
    std::vector<DrawCmd> screenQueue;
    std::string screenShader;
    SpriteOutlineShader spriteOutline;
    std::function<std::string(const std::string&)> textureKeyResolver;
    std::function<std::string(const std::string&)> fontKeyResolver;

    void updateWindowSizeFromRaylib();
    void syncActiveCameraFromStores();
    void syncPresentationState();
    void updateCameraProjection();
    void updateGameViewCamera();
    bool ensureGameViewTarget(uint32_t w, uint32_t h);
    void releaseGameViewTarget();
    void beginWorldScissor(const Camera2D& frameCamera);
    void endWorldScissor();
    Camera2D frameCameraWithShake() const;
    static uint32_t calculateInitialWindowScale(uint32_t logicalWidth,
                                                uint32_t logicalHeight);
};

// ------------------------------------------------------------------ helpers

static Color toColor(const Vec4& v, float extraAlpha = 1.f) {
    return Color{
        static_cast<unsigned char>(v.r * 255.f),
        static_cast<unsigned char>(v.g * 255.f),
        static_cast<unsigned char>(v.b * 255.f),
        static_cast<unsigned char>(v.a * extraAlpha * 255.f)
    };
}

static Vec2 worldToScreen(const Camera2D& cam, float wx, float wy) {
    const float zoom = (cam.zoom > 0.f) ? cam.zoom : 1.f;
    return {
        (wx - cam.target.x) * zoom + cam.offset.x,
        (wy - cam.target.y) * zoom + cam.offset.y,
    };
}

static ScreenClipRect computeWorldScreenClipRect(const Camera2D& cam,
                                                 const Vec2& worldSize,
                                                 uint32_t fbW,
                                                 uint32_t fbH) {
    if (worldSize.x <= 0.f || worldSize.y <= 0.f || fbW == 0 || fbH == 0)
        return {};

    const Vec2 corners[4] = {
        worldToScreen(cam, 0.f, 0.f),
        worldToScreen(cam, worldSize.x, 0.f),
        worldToScreen(cam, 0.f, worldSize.y),
        worldToScreen(cam, worldSize.x, worldSize.y),
    };
    float minX = corners[0].x;
    float minY = corners[0].y;
    float maxX = corners[0].x;
    float maxY = corners[0].y;
    for (int i = 1; i < 4; ++i) {
        minX = std::min(minX, corners[i].x);
        minY = std::min(minY, corners[i].y);
        maxX = std::max(maxX, corners[i].x);
        maxY = std::max(maxY, corners[i].y);
    }

    const float fbWf = static_cast<float>(fbW);
    const float fbHf = static_cast<float>(fbH);
    const float clipX = std::max(0.f, std::floor(minX));
    const float clipY = std::max(0.f, std::floor(minY));
    const float clipRight = std::min(fbWf, std::ceil(maxX));
    const float clipBottom = std::min(fbHf, std::ceil(maxY));
    const float clipW = clipRight - clipX;
    const float clipH = clipBottom - clipY;
    if (clipW <= 0.f || clipH <= 0.f) return {};
    return { clipX, clipY, clipW, clipH };
}

static Vec2 clampCameraTarget(
    const Vec2& viewportSize,
    const Vec2& worldSize,
    float cameraZoom,
    Vec2 target)
{
    const float z = (cameraZoom > 0.f) ? cameraZoom : 1.f;
    const float visibleW = viewportSize.x / z;
    const float visibleH = viewportSize.y / z;
    const float maxX = std::max(0.f, worldSize.x - visibleW);
    const float maxY = std::max(0.f, worldSize.y - visibleH);
    return {
        std::min(std::max(0.f, target.x), maxX),
        std::min(std::max(0.f, target.y), maxY),
    };
}

void Renderer::Impl::updateWindowSizeFromRaylib() {
    if (!open) return;
#ifdef __EMSCRIPTEN__
    // In the WebView the canvas has two independent sizes: the framebuffer
    // controlled by setWindowSize/editor_set_edit_camera, and the CSS box used
    // by React/Tauri for preview scaling. Raylib may report the CSS-facing size
    // here, which would make the gameplay camera apply a second display scale.
    return;
#else
    const int liveW = GetScreenWidth();
    const int liveH = GetScreenHeight();
    if (liveW > 0) width = static_cast<uint32_t>(liveW);
    if (liveH > 0) height = static_cast<uint32_t>(liveH);
#endif
}

void Renderer::Impl::syncActiveCameraFromStores() {
    if (presentationMode == PresentationMode::SceneEdit) {
        const float zoom = static_cast<float>(
            storedEditorCamera_.zoom > 0. ? storedEditorCamera_.zoom : 1.);
        camera.target = {
            static_cast<float>(storedEditorCamera_.positionX),
            static_cast<float>(storedEditorCamera_.positionY),
        };
        camera.zoom = zoom;
        cameraZoom = zoom;
        camera.offset = { 0.f, 0.f };
        return;
    }
    const float zoom = static_cast<float>(
        storedGameCamera_.zoom > 0. ? storedGameCamera_.zoom : 1.);
    camera.target = {
        static_cast<float>(storedGameCamera_.positionX),
        static_cast<float>(storedGameCamera_.positionY),
    };
    camera.zoom = zoom;
    cameraZoom = zoom;
}

void Renderer::Impl::syncPresentationState() {
    using ArtCade::Presentation::PresentationState;
    PresentationState& state = presentation.mutable_state();
    state.surface = surface_metrics_from_css(
        static_cast<double>(width),
        static_cast<double>(height),
        1.);
    state.surface.framebufferWidth = static_cast<double>(width);
    state.surface.framebufferHeight = static_cast<double>(height);
    state.logicalWidth = static_cast<double>(viewportSize.x);
    state.logicalHeight = static_cast<double>(viewportSize.y);
    state.outputPolicy = outputPolicy;
    state.mode = presentationMode;
    state.gameViewCompositorEnabled = gameViewCompositorEnabled;
    state.editorCamera = storedEditorCamera_;
    state.gameCamera = storedGameCamera_;
    state.gameModifiers = gameModifiers_;
    state.placement = compositorLayout;
    state.useIdentityPlacement = !gameViewCompositorEnabled;

    if (gameViewCompositorEnabled) {
        const CameraModifiers noShake{};
        const auto effective = compose_effective_game_camera(
            state.gameCamera, noShake);
        state.pickingCamera = view_camera_from_effective(
            effective,
            static_cast<double>(gameViewCamera.offset.x),
            static_cast<double>(gameViewCamera.offset.y));
    } else if (presentationMode == PresentationMode::SceneEdit) {
        state.pickingCamera = view_camera_from_editor(state.editorCamera);
    } else {
        state.pickingCamera = to_view_camera(camera);
    }
}

void Renderer::Impl::updateCameraProjection() {
    syncActiveCameraFromStores();
    const float backW = static_cast<float>(width);
    const float backH = static_cast<float>(height);

    if (presentationMode == PresentationMode::SceneEdit && !gameViewCompositorEnabled) {
        compositorLayout = ArtCade::Presentation::output_placement_compute(
            backW, backH, viewportSize.x, viewportSize.y, OutputPolicy::Fit);
        displayScale = 1.f;
        viewportOffset = { 0.f, 0.f };
        viewportDrawSize = { backW, backH };
        updateGameViewCamera();
        syncPresentationState();
        presentation.refresh_snapshot();
        return;
    }

    const OutputPolicy policy = gameViewCompositorEnabled
        ? outputPolicy
        : OutputPolicy::Fit;
    compositorLayout = ArtCade::Presentation::output_placement_compute(
        backW, backH, viewportSize.x, viewportSize.y, policy);
    displayScale = static_cast<float>(compositorLayout.scaleX);
    viewportDrawSize = {
        static_cast<float>(compositorLayout.destW),
        static_cast<float>(compositorLayout.destH),
    };
    viewportOffset = {
        static_cast<float>(compositorLayout.destX),
        static_cast<float>(compositorLayout.destY),
    };

    const float zoom = (cameraZoom > 0.f) ? cameraZoom : 0.01f;
    const float finalZoom = gameViewCompositorEnabled
        ? zoom
        : displayScale * zoom;
    const Vec2 drawSize = gameViewCompositorEnabled
        ? Vec2{ viewportSize.x, viewportSize.y }
        : viewportDrawSize;
    const Vec2 worldInset = {
        std::max(0.f, (drawSize.x - worldSize.x * finalZoom) * 0.5f),
        std::max(0.f, (drawSize.y - worldSize.y * finalZoom) * 0.5f),
    };
    camera.zoom = gameViewCompositorEnabled ? zoom : displayScale * zoom;
    if (gameViewCompositorEnabled) {
        camera.offset = { worldInset.x, worldInset.y };
    } else {
        camera.offset = {
            viewportOffset.x + worldInset.x,
            viewportOffset.y + worldInset.y,
        };
    }
    const Vec2 clamped = clampCameraTarget(
        viewportSize, worldSize, cameraZoom,
        { camera.target.x, camera.target.y });
    camera.target = { clamped.x, clamped.y };
    storedGameCamera_.positionX = static_cast<double>(clamped.x);
    storedGameCamera_.positionY = static_cast<double>(clamped.y);
    updateGameViewCamera();
    syncPresentationState();
    presentation.refresh_snapshot();
}

void Renderer::Impl::updateGameViewCamera() {
    const float zoom = (cameraZoom > 0.f) ? cameraZoom : 0.01f;
    const Vec2 worldInset = {
        std::max(0.f, (viewportSize.x - worldSize.x * zoom) * 0.5f),
        std::max(0.f, (viewportSize.y - worldSize.y * zoom) * 0.5f),
    };
    gameViewCamera = camera;
    gameViewCamera.zoom = zoom;
    gameViewCamera.offset = { worldInset.x, worldInset.y };
}

bool Renderer::Impl::ensureGameViewTarget(uint32_t w, uint32_t h) {
    const uint32_t safeW = std::max(1u, w);
    const uint32_t safeH = std::max(1u, h);
    if (gameView.rt.id != 0 && gameView.w == safeW && gameView.h == safeH)
        return true;
    releaseGameViewTarget();
    gameView.rt = LoadRenderTexture(static_cast<int>(safeW),
                                    static_cast<int>(safeH));
    if (gameView.rt.id == 0) return false;
    gameView.w = safeW;
    gameView.h = safeH;
    return true;
}

void Renderer::Impl::releaseGameViewTarget() {
    if (gameView.rt.id == 0) return;
    UnloadRenderTexture(gameView.rt);
    gameView.rt = {};
    gameView.w = 0;
    gameView.h = 0;
}

Camera2D Renderer::Impl::frameCameraWithShake() const {
    Camera2D frameCamera = camera;
    apply_game_modifiers_to_frame_camera(frameCamera, gameModifiers_);
    return frameCamera;
}

void Renderer::Impl::beginWorldScissor(const Camera2D& frameCamera) {
    const uint32_t fbW = inGameViewTexturePass ? gameView.w : width;
    const uint32_t fbH = inGameViewTexturePass ? gameView.h : height;
    const ScreenClipRect clip = computeWorldScreenClipRect(
        frameCamera, worldSize, fbW, fbH);
    if (clip.width <= 0.f || clip.height <= 0.f) {
        worldScissorActive = false;
        return;
    }
    BeginScissorMode(static_cast<int>(clip.x),
                     static_cast<int>(clip.y),
                     static_cast<int>(clip.width),
                     static_cast<int>(clip.height));
    worldScissorActive = true;
}

void Renderer::Impl::endWorldScissor() {
    if (!worldScissorActive) return;
    EndScissorMode();
    worldScissorActive = false;
}

uint32_t Renderer::Impl::calculateInitialWindowScale(uint32_t logicalWidth,
                                                     uint32_t logicalHeight) {
    constexpr float kMaxScreenUsage = 0.80f;
    const uint32_t safeWidth = std::max(1u, logicalWidth);
    const uint32_t safeHeight = std::max(1u, logicalHeight);
    int monitor = 0;
    if (IsWindowReady()) monitor = GetCurrentMonitor();
    const int monitorWidth = GetMonitorWidth(monitor);
    const int monitorHeight = GetMonitorHeight(monitor);
    if (monitorWidth <= 0 || monitorHeight <= 0) return 1u;
    const uint32_t availableWidth =
        static_cast<uint32_t>(static_cast<float>(monitorWidth) * kMaxScreenUsage);
    const uint32_t availableHeight =
        static_cast<uint32_t>(static_cast<float>(monitorHeight) * kMaxScreenUsage);
    const uint32_t scaleX = availableWidth / safeWidth;
    const uint32_t scaleY = availableHeight / safeHeight;
    return std::max(1u, std::min(scaleX, scaleY));
}

// ------------------------------------------------------------------ lifecycle

Renderer::Renderer() : impl_(std::make_unique<Impl>()) {
    impl_->camera.zoom = 1.f;
    impl_->updateCameraProjection();
}

Renderer::~Renderer() {
    if (impl_->open) shutdown();
}

bool Renderer::init() {
    SetTraceLogLevel(LOG_WARNING);
#ifndef __EMSCRIPTEN__
    SetConfigFlags(FLAG_WINDOW_RESIZABLE);
#else
    // The editor owns canvas sizing via setWindowSize / editor_set_edit_camera.
    // FLAG_WINDOW_RESIZABLE enables Raylib's EmscriptenResizeCallback, which
    // stretches the framebuffer to window.innerWidth and breaks play preview.
    SetConfigFlags(0);
#endif
    InitWindow(static_cast<int>(impl_->width),
               static_cast<int>(impl_->height),
               impl_->title.c_str());
    impl_->open = true;
    SetWindowMinSize(static_cast<int>(impl_->viewportSize.x),
                     static_cast<int>(impl_->viewportSize.y));
    SetTargetFPS(60);

    // Top-left origin: world (0,0) == screen top-left.
    // This matches the coordinate system used by project.json positions
    // (e.g. position [640, 360] == centre of a 1280×720 window).
    impl_->camera.offset = { 0.f, 0.f };
    impl_->camera.target = { 0.f, 0.f };
    impl_->cameraZoom    = 1.f;
    impl_->updateWindowSizeFromRaylib();
    impl_->updateCameraProjection();
    impl_->spriteOutline.load();
    return true;
}

void Renderer::shutdown() {
    if (!impl_->open) return;
    impl_->releaseGameViewTarget();
    impl_->spriteOutline.unload();
    impl_->texCache.unloadAll();
    impl_->fontCache.unloadAll();
    CloseWindow();
    impl_->open = false;
}

// ------------------------------------------------------------------ config

void Renderer::setWindowSize(uint32_t w, uint32_t h, const std::string& title) {
    impl_->width  = std::max(1u, w);
    impl_->height = std::max(1u, h);
    impl_->title  = title;

    if (impl_->open) {
        SetWindowSize(static_cast<int>(impl_->width),
                      static_cast<int>(impl_->height));
        SetWindowTitle(title.c_str());
        impl_->updateWindowSizeFromRaylib();
    }
    impl_->updateCameraProjection();
}

void Renderer::setWindowSizeForLogicalViewport(uint32_t logicalWidth,
                                               uint32_t logicalHeight,
                                               const std::string& title) {
    const uint32_t safeWidth = std::max(1u, logicalWidth);
    const uint32_t safeHeight = std::max(1u, logicalHeight);
    const uint32_t scale = Impl::calculateInitialWindowScale(safeWidth, safeHeight);
    setWindowSize(safeWidth * scale, safeHeight * scale, title);
}

uint32_t Renderer::windowWidth()  const { return impl_->width;  }
uint32_t Renderer::windowHeight() const { return impl_->height; }

void Renderer::setSceneViewport(const Vec2& worldSize, const Vec2& viewportSize) {
    impl_->worldSize = {
        std::max(1.f, worldSize.x),
        std::max(1.f, worldSize.y),
    };
    impl_->viewportSize = {
        std::max(1.f, viewportSize.x),
        std::max(1.f, viewportSize.y),
    };

    if (impl_->open) {
        SetWindowMinSize(static_cast<int>(impl_->viewportSize.x),
                         static_cast<int>(impl_->viewportSize.y));
    }
    impl_->updateCameraProjection();
}

void Renderer::setGameViewCompositorEnabled(bool enabled) {
    impl_->gameViewCompositorEnabled = enabled;
    if (!enabled) impl_->releaseGameViewTarget();
    impl_->updateCameraProjection();
}

void Renderer::setOutputPolicy(OutputPolicy policy) {
    impl_->outputPolicy = policy;
    if (impl_->open || impl_->width > 0)
        impl_->updateCameraProjection();
}

OutputPolicy Renderer::outputPolicy() const {
    return impl_->outputPolicy;
}

CompositorLayout Renderer::compositorLayout() const {
    return impl_->presentation.committed_snapshot().placement;
}

ScreenClipRect Renderer::worldScreenClipRect() const {
    const uint32_t fbW = impl_->gameViewCompositorEnabled
        ? std::max(1u, static_cast<uint32_t>(impl_->viewportSize.x))
        : impl_->width;
    const uint32_t fbH = impl_->gameViewCompositorEnabled
        ? std::max(1u, static_cast<uint32_t>(impl_->viewportSize.y))
        : impl_->height;
    Camera2D cam = impl_->gameViewCompositorEnabled
        ? impl_->gameViewCamera
        : impl_->camera;
    apply_game_modifiers_to_frame_camera(cam, impl_->gameModifiers_);
    return computeWorldScreenClipRect(cam, impl_->worldSize, fbW, fbH);
}

// ------------------------------------------------------------------ frame

void Renderer::clearDrawQueue() {
    impl_->drawQueue.clear();
}

void Renderer::setGameCameraModifiers(const ArtCade::Presentation::CameraModifiers& modifiers) {
    impl_->gameModifiers_ = modifiers;
}

void Renderer::beginFrame(const Vec4& clearColor) {
    impl_->updateWindowSizeFromRaylib();
    impl_->updateCameraProjection();
    impl_->presentation.begin_frame();
    impl_->worldScissorActive = false;
    impl_->inGameViewTexturePass = false;
    BeginDrawing();

    if (impl_->gameViewCompositorEnabled) {
        const uint32_t vpW = std::max(1u, static_cast<uint32_t>(impl_->viewportSize.x));
        const uint32_t vpH = std::max(1u, static_cast<uint32_t>(impl_->viewportSize.y));
        if (!impl_->ensureGameViewTarget(vpW, vpH)) {
            impl_->gameViewCompositorEnabled = false;
        }
    }

    if (impl_->gameViewCompositorEnabled) {
        ClearBackground(toColor(clearColor));
        BeginTextureMode(impl_->gameView.rt);
        impl_->inGameViewTexturePass = true;
        ClearBackground(toColor(clearColor));
        Camera2D frameCamera = impl_->gameViewCamera;
        apply_game_modifiers_to_frame_camera(frameCamera, impl_->gameModifiers_);
        BeginMode2D(frameCamera);
        impl_->beginWorldScissor(frameCamera);
        return;
    }

    ClearBackground(toColor(clearColor));
    const Camera2D frameCamera = impl_->frameCameraWithShake();
    BeginMode2D(frameCamera);
    impl_->beginWorldScissor(frameCamera);
}

void Renderer::blitGameViewToBackbuffer() {
    if (!impl_->gameViewCompositorEnabled || impl_->gameView.rt.id == 0)
        return;
    const OutputPlacement& layout = impl_->presentation.committed_snapshot().placement;
    const float srcW = layout.srcW > 0.
        ? static_cast<float>(layout.srcW)
        : static_cast<float>(impl_->gameView.w);
    const float srcH = layout.srcH > 0.
        ? static_cast<float>(layout.srcH)
        : static_cast<float>(impl_->gameView.h);
    const float srcX = static_cast<float>(layout.srcX);
    const float srcY = static_cast<float>(layout.srcY);
    DrawTexturePro(
        impl_->gameView.rt.texture,
        Rectangle{ srcX, srcY, srcW, -srcH },
        Rectangle{
            static_cast<float>(layout.destX),
            static_cast<float>(layout.destY),
            static_cast<float>(layout.destW),
            static_cast<float>(layout.destH),
        },
        Vector2{ 0.f, 0.f },
        0.f,
        WHITE);
}

void Renderer::endWorldPass() {
    for (const auto& cmd : impl_->drawQueue) {
        Color c{ cmd.cr, cmd.cg, cmd.cb, cmd.ca };
        switch (cmd.type) {
        case DrawCmd::Type::Rect:
            DrawRectangleV({ cmd.x, cmd.y }, { cmd.x2, cmd.y2 }, c);
            break;
        case DrawCmd::Type::Line:
            DrawLineV({ cmd.x, cmd.y }, { cmd.x2, cmd.y2 }, c);
            break;
        case DrawCmd::Type::Circle:
            DrawCircleV({ cmd.x, cmd.y }, cmd.r, c);
            break;
        case DrawCmd::Type::Text: {
            const std::string fontKey = resolvedFontKey(cmd.fontPath);
            const Font* font = fontKey.empty()
                ? nullptr
                : impl_->fontCache.get(fontKey);
            drawTextCommand(cmd, font);
            break;
        }
        case DrawCmd::Type::Image:
            (void)drawImageCommand(impl_->texCache,
                                   resolvedTextureKey(cmd.assetId),
                                   cmd);
            break;
        }
    }
    impl_->drawQueue.clear();
    impl_->endWorldScissor();
    EndMode2D();
    if (impl_->inGameViewTexturePass) {
        EndTextureMode();
        impl_->inGameViewTexturePass = false;
        blitGameViewToBackbuffer();
    }
}

void Renderer::endScreenPass() {
    Camera2D screenCamera = {};
    screenCamera.offset = { impl_->viewportOffset.x, impl_->viewportOffset.y };
    screenCamera.target = { 0.f, 0.f };
    screenCamera.zoom = impl_->displayScale;
    BeginMode2D(screenCamera);
    for (const auto& cmd : impl_->screenQueue) {
        Color c{ cmd.cr, cmd.cg, cmd.cb, cmd.ca };
        if (cmd.type == DrawCmd::Type::Rect) {
            DrawRectangleV({ cmd.x, cmd.y }, { cmd.x2, cmd.y2 }, c);
        } else if (cmd.type == DrawCmd::Type::Text) {
            const std::string fontKey = resolvedFontKey(cmd.fontPath);
            const Font* font = fontKey.empty()
                ? nullptr
                : impl_->fontCache.get(fontKey);
            drawTextCommand(cmd, font);
        } else if (cmd.type == DrawCmd::Type::Image) {
            (void)drawImageCommand(impl_->texCache,
                                   resolvedTextureKey(cmd.assetId),
                                   cmd);
        }
    }
    EndMode2D();
    impl_->screenQueue.clear();
}

void Renderer::presentScreen() {
    drawScreenPostEffects();
    EndDrawing();
}

void Renderer::endFrame() {
    endWorldPass();
    endScreenPass();
    presentScreen();
}

void Renderer::setScreenShader(const std::string& name) {
    impl_->screenShader = name;
}

void Renderer::drawFadeOverlay(float alpha) {
    if (alpha <= 0.f) return;
    DrawCmd cmd;
    cmd.type = DrawCmd::Type::Rect;
    cmd.x = 0.f;
    cmd.y = 0.f;
    cmd.x2 = impl_->viewportSize.x;
    cmd.y2 = impl_->viewportSize.y;
    cmd.cr = 0;
    cmd.cg = 0;
    cmd.cb = 0;
    cmd.ca = static_cast<unsigned char>(std::min(255.f, alpha * 255.f));
    impl_->screenQueue.push_back(std::move(cmd));
}

void Renderer::drawScreenPostEffects() {
    if (impl_->screenShader.empty() || impl_->screenShader == "none") return;
    const int w = static_cast<int>(impl_->width);
    const int h = static_cast<int>(impl_->height);
    if (impl_->screenShader == "crt" || impl_->screenShader == "scanlines") {
        for (int y = 0; y < h; y += 4)
            DrawRectangle(0, y, w, 2, Color{ 0, 0, 0, 40 });
    }
}

bool Renderer::shouldClose() const {
    return WindowShouldClose();
}

// ------------------------------------------------------------------ draw

namespace {

constexpr float kOutlineTexelRadius = 2.f;
constexpr float kPlaceholderOutlinePad = 1.06f;
constexpr float kPlaceholderSpriteSize = 32.f;

void drawPlaceholderOutlineSilhouette(const Vec2& pos,
                                      const Vec2& pivot,
                                      float fw,
                                      float fh,
                                      float alpha)
{
    const float padW = fw * kPlaceholderOutlinePad;
    const float padH = fh * kPlaceholderOutlinePad;
    const Vec2 topLeft = SpriteDrawMath::placeholderTopLeft(pos, pivot, padW, padH);
    const unsigned char ca =
        static_cast<unsigned char>(std::clamp(alpha, 0.f, 1.f) * 255.f);
    DrawRectangleV({ topLeft.x, topLeft.y }, { padW, padH }, Color{ 0, 0, 0, ca });
}

} // anonymous namespace (draw helpers)

std::string Renderer::resolvedTextureKey(const std::string& ref) const {
    if (ref.empty()) return ref;
    if (impl_->textureKeyResolver) {
        return impl_->textureKeyResolver(ref);
    }
    return ref;
}

void Renderer::setTextureKeyResolver(
    std::function<std::string(const std::string&)> resolver)
{
    impl_->textureKeyResolver = std::move(resolver);
}

std::string Renderer::resolvedFontKey(const std::string& ref) const {
    if (ref.empty()) return ref;
    if (impl_->fontKeyResolver) return impl_->fontKeyResolver(ref);
    return ref;
}

void Renderer::setFontKeyResolver(
    std::function<std::string(const std::string&)> resolver)
{
    impl_->fontKeyResolver = std::move(resolver);
}

void Renderer::drawSprite(const AssetId& assetId,
                           const Vec2&    pos,
                           float          rotation,
                           const Vec2&    scale,
                           const Vec4&    tint,
                           const Vec3&    fillColor,
                           float          alpha,
                           const std::string& shaderEffect,
                           const Vec2&    pivot,
                           bool           flipX,
                           bool           flipY)
{
    const bool outline = (shaderEffect == "outline");

    Vec4 drawTint = tint;
    if (shaderEffect == "hit_flash")
        drawTint = { 1.f, 1.f, 1.f, tint.a };

    const std::string texKey = resolvedTextureKey(assetId);
    const Texture2D* tex = impl_->texCache.getByPath(texKey);
    if (!tex || tex->id == 0) {
        // abs(): scale is magnitude; flip is a flag and does not size the rect.
        const float fw = kPlaceholderSpriteSize * (scale.x < 0.f ? -scale.x : scale.x);
        const float fh = kPlaceholderSpriteSize * (scale.y < 0.f ? -scale.y : scale.y);
        const unsigned char ca =
            static_cast<unsigned char>(std::clamp(alpha, 0.f, 1.f) * 255.f);
        const Color fill{
            static_cast<unsigned char>(std::clamp(fillColor.x, 0.f, 1.f) * 255.f),
            static_cast<unsigned char>(std::clamp(fillColor.y, 0.f, 1.f) * 255.f),
            static_cast<unsigned char>(std::clamp(fillColor.z, 0.f, 1.f) * 255.f),
            ca };
        if (outline)
            drawPlaceholderOutlineSilhouette(pos, pivot, fw, fh, tint.a * alpha);
        const Vec2 topLeft = SpriteDrawMath::placeholderTopLeft(pos, pivot, fw, fh);
        DrawRectangleV({ topLeft.x, topLeft.y }, { fw, fh }, fill);
        return;
    }

    // Flip via a negative SOURCE rect (raylib's mirror path); keep the dest rect
    // positive so origin/pivot/rotation stay correct. Facing comes from the flip
    // flags, decoupled from scale (which is magnitude only).
    const float texW = static_cast<float>(tex->width);
    const float texH = static_cast<float>(tex->height);
    Rectangle src = { 0.f, 0.f,
                      flipX ? -texW : texW,
                      flipY ? -texH : texH };
    Rectangle dst = { pos.x, pos.y,
                      texW * (scale.x < 0.f ? -scale.x : scale.x),
                      texH * (scale.y < 0.f ? -scale.y : scale.y) };
    const Vec2 originVec = SpriteDrawMath::drawOrigin(pivot, dst.width, dst.height);
    Vector2 origin = { originVec.x, originVec.y };
    const Color tintColor = toColor(drawTint, alpha);

    if (outline && impl_->spriteOutline.ready) {
        const float texelSize[2] = {
            1.f / static_cast<float>(tex->width),
            1.f / static_cast<float>(tex->height),
        };
        const float outlineSize = kOutlineTexelRadius;
        const float outlineColor[4] = { 0.f, 0.f, 0.f, tint.a * alpha };
        SetShaderValue(impl_->spriteOutline.shader,
                       impl_->spriteOutline.locTexelSize,
                       texelSize,
                       SHADER_UNIFORM_VEC2);
        SetShaderValue(impl_->spriteOutline.shader,
                       impl_->spriteOutline.locOutlineSize,
                       &outlineSize,
                       SHADER_UNIFORM_FLOAT);
        SetShaderValue(impl_->spriteOutline.shader,
                       impl_->spriteOutline.locOutlineColor,
                       outlineColor,
                       SHADER_UNIFORM_VEC4);
        BeginShaderMode(impl_->spriteOutline.shader);
        DrawTexturePro(*tex, src, dst, origin, rotation, tintColor);
        EndShaderMode();
        return;
    }

    DrawTexturePro(*tex, src, dst, origin, rotation, tintColor);
}

void Renderer::drawSpriteFrame(const AssetId& assetId,
                               float srcX, float srcY, float srcW, float srcH,
                               const Vec2&    pos,
                               float          rotation,
                               const Vec2&    scale,
                               const Vec4&    tint,
                               float          alpha,
                               const Vec2&    pivot,
                               bool           flipX,
                               bool           flipY)
{
    const std::string texKey = resolvedTextureKey(assetId);
    const Texture2D* tex = impl_->texCache.getByPath(texKey);
    if (!tex || tex->id == 0 || srcW <= 0.f || srcH <= 0.f) {
        drawSprite(assetId, pos, rotation, scale, tint, { tint.r, tint.g, tint.b },
                   alpha, "", pivot, flipX, flipY);
        return;
    }

    // Flip via a negative SOURCE rect (raylib mirrors the region in place); keep
    // the dest rect positive so origin/pivot/rotation stay correct. Facing comes
    // from the flip flags, decoupled from scale (magnitude only).
    Rectangle src = { srcX, srcY,
                      flipX ? -srcW : srcW,
                      flipY ? -srcH : srcH };
    Rectangle dst = { pos.x, pos.y,
                      srcW * (scale.x < 0.f ? -scale.x : scale.x),
                      srcH * (scale.y < 0.f ? -scale.y : scale.y) };
    const Vec2 originVec = SpriteDrawMath::drawOrigin(pivot, dst.width, dst.height);
    Vector2 origin = { originVec.x, originVec.y };
    DrawTexturePro(*tex, src, dst, origin, rotation, toColor(tint, alpha));
}

Vec2 Renderer::spriteDestinationSize(const AssetId& assetId, const Vec2& scale) const {
    const float sx = std::abs(scale.x);
    const float sy = std::abs(scale.y);
    const std::string texKey = resolvedTextureKey(assetId);
    const Texture2D* tex = impl_->texCache.getByPath(texKey);
    if (!tex || tex->id == 0) {
        return { kPlaceholderSpriteSize * sx, kPlaceholderSpriteSize * sy };
    }
    return {
        static_cast<float>(tex->width)  * sx,
        static_cast<float>(tex->height) * sy,
    };
}

namespace {

struct RegionPreviewTarget {
    RenderTexture2D rt{};
    int w = 0;
    int h = 0;
};

RegionPreviewTarget g_regionPreview;

bool ensureRegionPreviewTarget(int w, int h) {
    if (w <= 0 || h <= 0) return false;
    if (g_regionPreview.rt.id != 0 && g_regionPreview.w == w && g_regionPreview.h == h)
        return true;
    if (g_regionPreview.rt.id != 0)
        UnloadRenderTexture(g_regionPreview.rt);
    g_regionPreview.rt = LoadRenderTexture(w, h);
    g_regionPreview.w  = w;
    g_regionPreview.h  = h;
    return g_regionPreview.rt.id != 0;
}

} // namespace

int Renderer::captureSpriteRegionFrame(const AssetId& assetId,
                                       float srcX, float srcY, float srcW, float srcH,
                                       int canvasW, int canvasH,
                                       unsigned char* rgbaOut,
                                       int rgbaOutLen) {
    if (!rgbaOut || rgbaOutLen <= 0) return -1;
    const int w = canvasW > 0 ? canvasW : 64;
    const int h = canvasH > 0 ? canvasH : 64;
    const int need = w * h * 4;
    if (rgbaOutLen < need || srcW <= 0.f || srcH <= 0.f) return -2;
    if (!ensureRegionPreviewTarget(w, h)) return -3;

    BeginTextureMode(g_regionPreview.rt);
    ClearBackground(BLANK);
    constexpr float kPreviewPad = 8.f;
    const float dx = kPreviewPad;
    const float dy = kPreviewPad;
    if (!drawSpriteRegion(assetId, srcX, srcY, srcW, srcH, dx, dy, srcW, srcH)) {
        EndTextureMode();
        return -4;
    }
    EndTextureMode();

    Image pixels = LoadImageFromTexture(g_regionPreview.rt.texture);
    if (!pixels.data || pixels.width != w || pixels.height != h) {
        if (pixels.data) UnloadImage(pixels);
        return -5;
    }
    ImageFlipVertical(&pixels);
    std::memcpy(rgbaOut, pixels.data, static_cast<size_t>(need));
    UnloadImage(pixels);
    return 0;
}

bool Renderer::drawSpriteRegion(const AssetId& assetId,
                                float srcX, float srcY, float srcW, float srcH,
                                float dstX, float dstY, float dstW, float dstH,
                                float alpha)
{
    const std::string texKey = resolvedTextureKey(assetId);
    const Texture2D* tex = impl_->texCache.getByPath(texKey);
    if (!tex || tex->id == 0) {
        // getByPath only looks up the cache; load on first use.
        impl_->texCache.load(texKey);
        tex = impl_->texCache.getByPath(texKey);
    }
    if (!tex || tex->id == 0) return false;   // caller falls back to colour

    Rectangle src = { srcX, srcY, srcW, srcH };
    Rectangle dst = { dstX, dstY, dstW, dstH };
    const unsigned char ca =
        static_cast<unsigned char>(std::clamp(alpha, 0.f, 1.f) * 255.f);
    DrawTexturePro(*tex, src, dst, { 0.f, 0.f }, 0.f, Color{ 255, 255, 255, ca });
    return true;
}

void Renderer::drawRect(float x, float y, float w, float h, const Vec4& color,
                        bool screenSpace) {
    Color c = toColor(color);
    DrawCmd cmd;
    cmd.type = DrawCmd::Type::Rect;
    cmd.x = x;  cmd.y = y;  cmd.x2 = w;  cmd.y2 = h;
    cmd.cr = c.r; cmd.cg = c.g; cmd.cb = c.b; cmd.ca = c.a;
    (screenSpace ? impl_->screenQueue : impl_->drawQueue)
        .push_back(std::move(cmd));
}

void Renderer::drawRectImmediate(float x, float y, float w, float h, const Vec4& color) {
    DrawRectangleV({ x, y }, { w, h }, toColor(color));
}

void Renderer::drawImage(const AssetId& assetId, float x, float y, float w, float h,
                         float alpha, bool screenSpace) {
    if (assetId.empty() || w <= 0.f || h <= 0.f || alpha <= 0.f) return;
    DrawCmd cmd;
    cmd.type = DrawCmd::Type::Image;
    cmd.x = x; cmd.y = y; cmd.x2 = w; cmd.y2 = h;
    cmd.assetId = assetId;
    cmd.ca = static_cast<unsigned char>(std::clamp(alpha, 0.f, 1.f) * 255.f);
    (screenSpace ? impl_->screenQueue : impl_->drawQueue)
        .push_back(std::move(cmd));
}

void Renderer::drawLine(float x1, float y1, float x2, float y2, const Vec4& color) {
    Color c = toColor(color);
    DrawCmd cmd;
    cmd.type = DrawCmd::Type::Line;
    cmd.x = x1; cmd.y = y1; cmd.x2 = x2; cmd.y2 = y2;
    cmd.cr = c.r; cmd.cg = c.g; cmd.cb = c.b; cmd.ca = c.a;
    impl_->drawQueue.push_back(std::move(cmd));
}

void Renderer::drawCircle(float x, float y, float radius, const Vec4& color) {
    Color c = toColor(color);
    DrawCmd cmd;
    cmd.type = DrawCmd::Type::Circle;
    cmd.x = x; cmd.y = y; cmd.r = radius;
    cmd.cr = c.r; cmd.cg = c.g; cmd.cb = c.b; cmd.ca = c.a;
    impl_->drawQueue.push_back(std::move(cmd));
}

void Renderer::drawText(const std::string& text, float x, float y,
                        int fontSize, const Vec4& color,
                        const std::string& fontPath, int align,
                        bool screenSpace, int valign) {
    Color c = toColor(color);
    DrawCmd cmd;
    cmd.type     = DrawCmd::Type::Text;
    cmd.x        = x;
    cmd.y        = y;
    cmd.fontSize = fontSize;
    cmd.align    = align;
    cmd.valign   = valign;
    cmd.text     = text;
    cmd.fontPath = fontPath;
    cmd.cr = c.r; cmd.cg = c.g; cmd.cb = c.b; cmd.ca = c.a;
    (screenSpace ? impl_->screenQueue : impl_->drawQueue)
        .push_back(std::move(cmd));
}

bool Renderer::registerFontFromMemory(const std::string& path,
                                      const unsigned char* data, int len,
                                      const std::string& ext,
                                      int baseSize) {
    return impl_->fontCache.registerFromMemory(path, data, len, ext, baseSize);
}

void Renderer::invalidateFontAsset(const std::string& path) {
    impl_->fontCache.invalidate(path);
}

void Renderer::evictCachedAssets() {
    impl_->texCache.unloadAll();
    impl_->fontCache.unloadAll();
}

// ------------------------------------------------------------------ textures

uint32_t Renderer::loadTexture(const std::string& path) {
    return impl_->texCache.load(path);
}

bool Renderer::registerImageFromMemory(const std::string& assetId,
                                       const unsigned char* data, int len,
                                       const std::string& ext) {
    return impl_->texCache.registerFromMemory(assetId, data, len, ext) != 0;
}

void Renderer::invalidateImageAsset(const std::string& assetPath) {
    impl_->texCache.unloadByPath(assetPath);
}

void Renderer::unloadTexture(uint32_t handle) {
    impl_->texCache.unload(handle);
}

bool Renderer::isTextureLoaded(const AssetId& assetId) const {
    return impl_->texCache.isLoaded(resolvedTextureKey(assetId));
}

// ------------------------------------------------------------------ camera

void Renderer::setCameraPosition(const Vec2& pos) {
    const Vec2 clamped = clampCameraTarget(
        impl_->viewportSize, impl_->worldSize, impl_->cameraZoom, pos);
    impl_->storedGameCamera_.positionX = static_cast<double>(clamped.x);
    impl_->storedGameCamera_.positionY = static_cast<double>(clamped.y);
    impl_->updateCameraProjection();
}

void Renderer::setCameraCenter(const Vec2& center) {
    const Vec2 visible = visibleWorldSize();
    setCameraPosition({
        center.x - visible.x * 0.5f,
        center.y - visible.y * 0.5f,
    });
}

void Renderer::setPresentationMode(ArtCade::Presentation::PresentationMode mode) {
    impl_->presentationMode = mode;
    if (impl_->open || impl_->width > 0)
        impl_->updateCameraProjection();
}

ArtCade::Presentation::PresentationMode Renderer::presentationMode() const {
    return impl_->presentationMode;
}

void Renderer::setCameraZoom(float zoom) {
    const float safeZoom = (zoom > 0.f) ? zoom : 0.01f;
    impl_->cameraZoom = safeZoom;
    impl_->storedGameCamera_.zoom = static_cast<double>(safeZoom);
    impl_->updateCameraProjection();
}

void Renderer::setEditorCamera(const Vec2& target, float zoom) {
    // Editor preview drives the camera explicitly: the editor owns pan/zoom
    // (scroll + zoom factor) and the visible-bounds clamping, so this setter
    // applies target/zoom verbatim — no clampCameraTarget, no offset. The
    // framebuffer is the visible viewport (device px) so the world is drawn at
    // native resolution: 1px grid lines stay crisp and in-phase at any zoom.
    impl_->presentationMode = PresentationMode::SceneEdit;
    const float safeZoom = (zoom > 0.f) ? zoom : 0.01f;
    impl_->storedEditorCamera_ = {
        static_cast<double>(target.x),
        static_cast<double>(target.y),
        static_cast<double>(safeZoom),
        0.,
    };
    impl_->displayScale  = 1.f;
    impl_->viewportOffset = { 0.f, 0.f };
    impl_->viewportDrawSize = {
        static_cast<float>(impl_->width),
        static_cast<float>(impl_->height),
    };
    impl_->syncActiveCameraFromStores();
    impl_->updateGameViewCamera();
    impl_->syncPresentationState();
    impl_->presentation.refresh_snapshot();
    impl_->syncViewControllerFromEditorCamera();
}

void Renderer::editorResizeSurface(float cssW, float cssH, float devicePixelRatio) {
    const float safeDpr = devicePixelRatio > 0.f ? devicePixelRatio : 1.f;
    impl_->editorSurfaceDpr = safeDpr;
    const uint32_t fbW = static_cast<uint32_t>(
        std::max(1., std::round(static_cast<double>(cssW) * static_cast<double>(safeDpr))));
    const uint32_t fbH = static_cast<uint32_t>(
        std::max(1., std::round(static_cast<double>(cssH) * static_cast<double>(safeDpr))));
    if (fbW != impl_->width || fbH != impl_->height) {
        setWindowSize(fbW, fbH, "ArtCade V2");
    }
    impl_->syncViewControllerFromEditorCamera();
    impl_->viewController.resize_surface(
        static_cast<double>(cssW),
        static_cast<double>(cssH),
        static_cast<double>(safeDpr));
    impl_->syncPresentationState();
    impl_->presentation.refresh_snapshot();
}

void Renderer::editorBeginPan(float cssX, float cssY) {
    if (impl_->presentationMode != PresentationMode::SceneEdit)
        return;
    impl_->syncViewControllerFromEditorCamera();
    const SurfacePoint surface = impl_->css_to_surface(
        cssX, cssY, impl_->editorSurfaceDpr);
    impl_->viewController.begin_pan(surface);
    impl_->applyViewControllerToEditorCamera();
}

void Renderer::editorUpdatePan(float cssX, float cssY) {
    if (impl_->presentationMode != PresentationMode::SceneEdit)
        return;
    const SurfacePoint surface = impl_->css_to_surface(
        cssX, cssY, impl_->editorSurfaceDpr);
    impl_->viewController.update_pan(surface);
    impl_->applyViewControllerToEditorCamera();
}

void Renderer::editorEndPan() {
    if (impl_->presentationMode != PresentationMode::SceneEdit)
        return;
    impl_->viewController.end_pan();
}

void Renderer::editorZoomAt(float cssX, float cssY, float zoomFactor) {
    if (impl_->presentationMode != PresentationMode::SceneEdit)
        return;
    if (!(zoomFactor > 0.f))
        return;
    impl_->syncViewControllerFromEditorCamera();
    const SurfacePoint surface = impl_->css_to_surface(
        cssX, cssY, impl_->editorSurfaceDpr);
    impl_->viewController.zoom_at(surface, static_cast<double>(zoomFactor));
    impl_->applyViewControllerToEditorCamera();
}

void Renderer::editorFrameWorldBounds(float minX, float minY,
                                      float maxX, float maxY) {
    if (impl_->presentationMode != PresentationMode::SceneEdit)
        impl_->presentationMode = PresentationMode::SceneEdit;
    impl_->syncViewControllerFromEditorCamera();
    impl_->viewController.frame_world_bounds(
        static_cast<double>(minX),
        static_cast<double>(minY),
        static_cast<double>(maxX),
        static_cast<double>(maxY));
    impl_->applyViewControllerToEditorCamera();
}

void Renderer::editorGetView(float* outX, float* outY, float* outZoom) const {
    if (outX)
        *outX = static_cast<float>(impl_->storedEditorCamera_.positionX);
    if (outY)
        *outY = static_cast<float>(impl_->storedEditorCamera_.positionY);
    if (outZoom) {
        const double zoom = impl_->storedEditorCamera_.zoom > 0.
            ? impl_->storedEditorCamera_.zoom
            : 1.;
        *outZoom = static_cast<float>(zoom);
    }
}

void Renderer::editorSetView(float targetX, float targetY, float zoomDevicePx) {
    setEditorCamera({ targetX, targetY }, zoomDevicePx);
}

void Renderer::panCameraByScreenDelta(float dx, float dy) {
    const float zoom = (impl_->camera.zoom > 0.f) ? impl_->camera.zoom : 1.f;
    setCameraPosition({
        impl_->camera.target.x - dx / zoom,
        impl_->camera.target.y - dy / zoom,
    });
}

const ArtCade::Presentation::PresentationSnapshot&
Renderer::committedPresentationSnapshot() const {
    return impl_->presentation.committed_snapshot();
}

uint64_t Renderer::presentationRevision() const {
    return impl_->presentation.committed_snapshot().revision;
}

Vec2 Renderer::visibleWorldSize() const {
    const float zoom = (impl_->cameraZoom > 0.f) ? impl_->cameraZoom : 1.f;
    return {
        impl_->viewportSize.x / zoom,
        impl_->viewportSize.y / zoom,
    };
}

Vec2 Renderer::getCameraPosition() const {
    return {
        static_cast<float>(impl_->storedGameCamera_.positionX),
        static_cast<float>(impl_->storedGameCamera_.positionY),
    };
}

Vec2 Renderer::getCameraCenter() const {
    const float zoom = (impl_->camera.zoom > 0.f) ? impl_->camera.zoom : 1.f;
    return {
        impl_->camera.target.x
            + (impl_->viewportOffset.x + impl_->viewportDrawSize.x * 0.5f
               - impl_->camera.offset.x) / zoom,
        impl_->camera.target.y
            + (impl_->viewportOffset.y + impl_->viewportDrawSize.y * 0.5f
               - impl_->camera.offset.y) / zoom,
    };
}

float Renderer::getCameraZoom() const {
    return static_cast<float>(impl_->storedGameCamera_.zoom);
}

float Renderer::deltaTime() const {
    return GetFrameTime();
}

void Renderer::toggleBorderlessFullscreen() {
#ifndef __EMSCRIPTEN__
    if (!impl_->open) return;
    ToggleBorderlessWindowed();
    impl_->updateWindowSizeFromRaylib();
    if (IsWindowState(FLAG_BORDERLESS_WINDOWED_MODE)) {
        impl_->presentationMode = PresentationMode::PlayFullscreen;
    } else if (impl_->gameViewCompositorEnabled) {
        impl_->presentationMode = PresentationMode::PlayEmbedded;
    }
    impl_->updateCameraProjection();
#endif
}

} // namespace ArtCade::Modules

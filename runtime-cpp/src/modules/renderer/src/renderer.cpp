#include "../include/renderer.h"
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
    float cameraZoom = 1.f;
    float displayScale = 1.f;
    Vec2  viewportOffset = { 0.f, 0.f };
    Vec2  viewportDrawSize = {
        ProjectDefaults::kSceneViewportWidth,
        ProjectDefaults::kSceneViewportHeight,
    };
    Vec2 renderShakeOffset = { 0.f, 0.f };
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
    void updateCameraProjection();
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

void Renderer::Impl::updateCameraProjection() {
    const float sx = static_cast<float>(width) / viewportSize.x;
    const float sy = static_cast<float>(height) / viewportSize.y;
    float displayScale = std::max(0.01f, std::min(sx, sy));
    if (displayScale >= 1.f)
        displayScale = std::max(1.f, std::floor(displayScale));
    this->displayScale = displayScale;
    viewportDrawSize = {
        viewportSize.x * this->displayScale,
        viewportSize.y * this->displayScale,
    };
    viewportOffset = {
        (static_cast<float>(width) - viewportDrawSize.x) * 0.5f,
        (static_cast<float>(height) - viewportDrawSize.y) * 0.5f,
    };

    const float zoom = (cameraZoom > 0.f) ? cameraZoom : 0.01f;
    const float finalZoom = this->displayScale * zoom;
    const Vec2 worldInset = {
        std::max(0.f, (viewportDrawSize.x - worldSize.x * finalZoom) * 0.5f),
        std::max(0.f, (viewportDrawSize.y - worldSize.y * finalZoom) * 0.5f),
    };
    camera.zoom = finalZoom;
    camera.offset = {
        viewportOffset.x + worldInset.x,
        viewportOffset.y + worldInset.y,
    };
    const Vec2 clamped = clampCameraTarget(
        viewportSize, worldSize, cameraZoom,
        { camera.target.x, camera.target.y });
    camera.target = { clamped.x, clamped.y };
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
    SetConfigFlags(FLAG_WINDOW_RESIZABLE);
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
    impl_->spriteOutline.unload();
    impl_->texCache.unloadAll();
    impl_->fontCache.unloadAll();
    CloseWindow();
    impl_->open = false;
}

// ------------------------------------------------------------------ config

void Renderer::setWindowSize(uint32_t w, uint32_t h, const std::string& title) {
    impl_->width  = w;
    impl_->height = h;
    impl_->title  = title;

    if (impl_->open) {
        SetWindowSize(static_cast<int>(w), static_cast<int>(h));
        SetWindowTitle(title.c_str());
        impl_->updateWindowSizeFromRaylib();
        impl_->updateCameraProjection();
    }
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

// ------------------------------------------------------------------ frame

void Renderer::clearDrawQueue() {
    impl_->drawQueue.clear();
}

void Renderer::setRenderShakeOffset(const Vec2& offset) {
    impl_->renderShakeOffset = offset;
}

void Renderer::beginFrame(const Vec4& clearColor) {
    impl_->updateWindowSizeFromRaylib();
    impl_->updateCameraProjection();
    BeginDrawing();
    ClearBackground(toColor(clearColor));
    Camera2D frameCamera = impl_->camera;
    // Jitter in screen pixels (world shake × zoom). Applied to offset, not target,
    // so clampCameraTarget cannot zero it out in 1:1 editor preview viewports.
    const float z = (frameCamera.zoom > 0.f) ? frameCamera.zoom : 1.f;
    frameCamera.offset.x += impl_->renderShakeOffset.x * z;
    frameCamera.offset.y += impl_->renderShakeOffset.y * z;
    BeginMode2D(frameCamera);
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
    EndMode2D();
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
    const int w = GetScreenWidth();
    const int h = GetScreenHeight();
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
    impl_->camera.target = { clamped.x, clamped.y };
    impl_->updateCameraProjection();
}

void Renderer::setCameraCenter(const Vec2& center) {
    const Vec2 visible = visibleWorldSize();
    setCameraPosition({
        center.x - visible.x * 0.5f,
        center.y - visible.y * 0.5f,
    });
}

void Renderer::setCameraZoom(float zoom) {
    impl_->cameraZoom = (zoom > 0.f) ? zoom : 0.01f;
    impl_->updateCameraProjection();
}

void Renderer::setEditorCamera(const Vec2& target, float zoom) {
    // Editor preview drives the camera explicitly: the editor owns pan/zoom
    // (scroll + zoom factor) and the visible-bounds clamping, so this setter
    // applies target/zoom verbatim — no clampCameraTarget, no offset. The
    // framebuffer is the visible viewport (device px) so the world is drawn at
    // native resolution: 1px grid lines stay crisp and in-phase at any zoom.
    impl_->camera.offset = { 0.f, 0.f };
    impl_->cameraZoom    = (zoom > 0.f) ? zoom : 0.01f;
    impl_->displayScale  = 1.f;
    impl_->viewportOffset = { 0.f, 0.f };
    impl_->viewportDrawSize = {
        static_cast<float>(impl_->width),
        static_cast<float>(impl_->height),
    };
    impl_->camera.zoom   = impl_->cameraZoom;
    impl_->camera.target = { target.x, target.y };
}

void Renderer::panCameraByScreenDelta(float dx, float dy) {
    const float zoom = (impl_->camera.zoom > 0.f) ? impl_->camera.zoom : 1.f;
    setCameraPosition({
        impl_->camera.target.x - dx / zoom,
        impl_->camera.target.y - dy / zoom,
    });
}

Vec2 Renderer::screenToWorld(float screenX, float screenY) const {
    const float zoom = (impl_->camera.zoom > 0.f) ? impl_->camera.zoom : 1.f;
    return {
        (screenX - impl_->camera.offset.x) / zoom + impl_->camera.target.x,
        (screenY - impl_->camera.offset.y) / zoom + impl_->camera.target.y,
    };
}

Vec2 Renderer::visibleWorldSize() const {
    const float zoom = (impl_->cameraZoom > 0.f) ? impl_->cameraZoom : 1.f;
    return {
        impl_->viewportSize.x / zoom,
        impl_->viewportSize.y / zoom,
    };
}

Vec2 Renderer::getCameraPosition() const {
    return { impl_->camera.target.x, impl_->camera.target.y };
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
    return impl_->cameraZoom;
}

float Renderer::deltaTime() const {
    return GetFrameTime();
}

void Renderer::toggleBorderlessFullscreen() {
#ifndef __EMSCRIPTEN__
    if (!impl_->open) return;
    ToggleBorderlessWindowed();
    impl_->updateWindowSizeFromRaylib();
    impl_->updateCameraProjection();
#endif
}

} // namespace ArtCade::Modules

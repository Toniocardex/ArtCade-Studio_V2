#include "../include/renderer.h"
#include "texture-cache.h"
#include <raylib.h>
#include <algorithm>
#include <vector>

namespace ArtCade::Modules {

// ------------------------------------------------------------------ Pimpl

// Deferred draw command — queued during tick(), flushed in endFrame().
struct DrawCmd {
    enum class Type { Rect, Line, Circle, Text } type = Type::Rect;
    float x  = 0.f, y  = 0.f;  // position / start
    float x2 = 0.f, y2 = 0.f;  // end (Line) or w/h (Rect)
    float r  = 0.f;             // radius (Circle)
    int   fontSize = 20;        // Text font size
    std::string text;           // Text content
    unsigned char cr=255, cg=255, cb=255, ca=255;  // packed colour
};

struct Renderer::Impl {
    uint32_t    width  = 1280;
    uint32_t    height = 720;
    std::string title  = "ArtCade V2";
    bool        open   = false;
    Vec2        worldSize = {1280.f, 720.f};
    Vec2        viewportSize = {1280.f, 720.f};

    Camera2D camera = {};
    TextureCache texCache;

    // Draw commands queued by Lua during tick(); flushed in endFrame().
    std::vector<DrawCmd> drawQueue;
    std::string screenShader;
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
    uint32_t width,
    uint32_t height,
    const Vec2& worldSize,
    float zoom,
    Vec2 target)
{
    const float z = (zoom > 0.f) ? zoom : 1.f;
    const float visibleW = static_cast<float>(width) / z;
    const float visibleH = static_cast<float>(height) / z;
    const float maxX = std::max(0.f, worldSize.x - visibleW);
    const float maxY = std::max(0.f, worldSize.y - visibleH);
    return {
        std::min(std::max(0.f, target.x), maxX),
        std::min(std::max(0.f, target.y), maxY),
    };
}

// ------------------------------------------------------------------ lifecycle

Renderer::Renderer() : impl_(std::make_unique<Impl>()) {
    impl_->camera.zoom = 1.f;
}

Renderer::~Renderer() {
    if (impl_->open) shutdown();
}

bool Renderer::init() {
    SetTraceLogLevel(LOG_WARNING);
    InitWindow(static_cast<int>(impl_->width),
               static_cast<int>(impl_->height),
               impl_->title.c_str());
    SetTargetFPS(60);

    // Top-left origin: world (0,0) == screen top-left.
    // This matches the coordinate system used by project.json positions
    // (e.g. position [640, 360] == centre of a 1280×720 window).
    impl_->camera.offset = { 0.f, 0.f };
    impl_->camera.target = { 0.f, 0.f };
    impl_->camera.zoom   = 1.f;
    impl_->open = true;
    return true;
}

void Renderer::shutdown() {
    if (!impl_->open) return;
    impl_->texCache.unloadAll();
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
        setSceneViewport(impl_->worldSize, impl_->viewportSize);
    }
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

    const float sx = static_cast<float>(impl_->width) / impl_->viewportSize.x;
    const float sy = static_cast<float>(impl_->height) / impl_->viewportSize.y;
    impl_->camera.offset = { 0.f, 0.f };
    impl_->camera.zoom = std::max(0.01f, std::min(sx, sy));
    const Vec2 clamped = clampCameraTarget(
        impl_->width, impl_->height, impl_->worldSize, impl_->camera.zoom,
        { impl_->camera.target.x, impl_->camera.target.y });
    impl_->camera.target = { clamped.x, clamped.y };
}

// ------------------------------------------------------------------ frame

void Renderer::clearDrawQueue() {
    impl_->drawQueue.clear();
}

void Renderer::beginFrame(const Vec4& clearColor) {
    BeginDrawing();
    ClearBackground(toColor(clearColor));
    BeginMode2D(impl_->camera);
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
        case DrawCmd::Type::Text:
            DrawText(cmd.text.c_str(),
                     static_cast<int>(cmd.x), static_cast<int>(cmd.y),
                     cmd.fontSize, c);
            break;
        }
    }
    impl_->drawQueue.clear();
    EndMode2D();
}

void Renderer::presentScreen() {
    drawScreenPostEffects();
    EndDrawing();
}

void Renderer::endFrame() {
    endWorldPass();
    presentScreen();
}

void Renderer::setScreenShader(const std::string& name) {
    impl_->screenShader = name;
}

void Renderer::drawFadeOverlay(float alpha) {
    if (alpha <= 0.f) return;
    const int w = GetScreenWidth();
    const int h = GetScreenHeight();
    DrawRectangle(0, 0, w, h, Color{ 0, 0, 0,
        static_cast<unsigned char>(std::min(255.f, alpha * 255.f)) });
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

void Renderer::drawSprite(const AssetId& assetId,
                           const Vec2&    pos,
                           float          rotation,
                           const Vec2&    scale,
                           const Vec4&    tint,
                           const Vec3&    fillColor,
                           float          alpha,
                           const std::string& shaderEffect)
{
    const bool outline = (shaderEffect == "outline");
    if (outline) {
        const Vec4 outlineTint{ 0.f, 0.f, 0.f, tint.a };
        const float o = 2.f;
        drawSprite(assetId, { pos.x - o, pos.y }, rotation, scale, outlineTint, fillColor, alpha, "");
        drawSprite(assetId, { pos.x + o, pos.y }, rotation, scale, outlineTint, fillColor, alpha, "");
        drawSprite(assetId, { pos.x, pos.y - o }, rotation, scale, outlineTint, fillColor, alpha, "");
        drawSprite(assetId, { pos.x, pos.y + o }, rotation, scale, outlineTint, fillColor, alpha, "");
    }

    Vec4 drawTint = tint;
    if (shaderEffect == "hit_flash")
        drawTint = { 1.f, 1.f, 1.f, tint.a };

    const Texture2D* tex = impl_->texCache.getByPath(assetId);
    if (!tex || tex->id == 0) {
        const float fw = 32.f * scale.x;
        const float fh = 32.f * scale.y;
        const unsigned char ca =
            static_cast<unsigned char>(std::clamp(alpha, 0.f, 1.f) * 255.f);
        const Color fill{
            static_cast<unsigned char>(std::clamp(fillColor.x, 0.f, 1.f) * 255.f),
            static_cast<unsigned char>(std::clamp(fillColor.y, 0.f, 1.f) * 255.f),
            static_cast<unsigned char>(std::clamp(fillColor.z, 0.f, 1.f) * 255.f),
            ca };
        DrawRectangleV({ pos.x - fw * 0.5f, pos.y - fh * 0.5f },
                       { fw, fh }, fill);
        return;
    }

    Rectangle src = { 0.f, 0.f, static_cast<float>(tex->width), static_cast<float>(tex->height) };
    Rectangle dst = { pos.x, pos.y,
                      tex->width  * scale.x,
                      tex->height * scale.y };
    Vector2 origin = { dst.width * 0.5f, dst.height * 0.5f };

    DrawTexturePro(*tex, src, dst, origin, rotation, toColor(drawTint, alpha));
}

bool Renderer::drawSpriteRegion(const AssetId& assetId,
                                float srcX, float srcY, float srcW, float srcH,
                                float dstX, float dstY, float dstW, float dstH)
{
    const Texture2D* tex = impl_->texCache.getByPath(assetId);
    if (!tex || tex->id == 0) {
        // getByPath only looks up the cache; load on first use.
        impl_->texCache.load(assetId);
        tex = impl_->texCache.getByPath(assetId);
    }
    if (!tex || tex->id == 0) return false;   // caller falls back to colour

    Rectangle src = { srcX, srcY, srcW, srcH };
    Rectangle dst = { dstX, dstY, dstW, dstH };
    DrawTexturePro(*tex, src, dst, { 0.f, 0.f }, 0.f, WHITE);
    return true;
}

void Renderer::drawRect(float x, float y, float w, float h, const Vec4& color) {
    Color c = toColor(color);
    DrawCmd cmd;
    cmd.type = DrawCmd::Type::Rect;
    cmd.x = x;  cmd.y = y;  cmd.x2 = w;  cmd.y2 = h;
    cmd.cr = c.r; cmd.cg = c.g; cmd.cb = c.b; cmd.ca = c.a;
    impl_->drawQueue.push_back(std::move(cmd));
}

void Renderer::drawRectImmediate(float x, float y, float w, float h, const Vec4& color) {
    DrawRectangleV({ x, y }, { w, h }, toColor(color));
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
                        int fontSize, const Vec4& color) {
    Color c = toColor(color);
    DrawCmd cmd;
    cmd.type     = DrawCmd::Type::Text;
    cmd.x        = x;
    cmd.y        = y;
    cmd.fontSize = fontSize;
    cmd.text     = text;
    cmd.cr = c.r; cmd.cg = c.g; cmd.cb = c.b; cmd.ca = c.a;
    impl_->drawQueue.push_back(std::move(cmd));
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

void Renderer::unloadTexture(uint32_t handle) {
    impl_->texCache.unload(handle);
}

bool Renderer::isTextureLoaded(const AssetId& assetId) const {
    return impl_->texCache.isLoaded(assetId);
}

// ------------------------------------------------------------------ camera

void Renderer::setCameraPosition(const Vec2& pos) {
    const Vec2 clamped = clampCameraTarget(
        impl_->width, impl_->height, impl_->worldSize, impl_->camera.zoom, pos);
    impl_->camera.target = { clamped.x, clamped.y };
}

void Renderer::setCameraZoom(float zoom) {
    impl_->camera.zoom = (zoom > 0.f) ? zoom : 0.01f;
    const Vec2 clamped = clampCameraTarget(
        impl_->width, impl_->height, impl_->worldSize, impl_->camera.zoom,
        { impl_->camera.target.x, impl_->camera.target.y });
    impl_->camera.target = { clamped.x, clamped.y };
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
    const float zoom = (impl_->camera.zoom > 0.f) ? impl_->camera.zoom : 1.f;
    return {
        static_cast<float>(impl_->width) / zoom,
        static_cast<float>(impl_->height) / zoom,
    };
}

Vec2 Renderer::getCameraPosition() const {
    return { impl_->camera.target.x, impl_->camera.target.y };
}

float Renderer::getCameraZoom() const {
    return impl_->camera.zoom;
}

float Renderer::deltaTime() const {
    return GetFrameTime();
}

} // namespace ArtCade::Modules

#include "../include/renderer.h"
#include "texture-cache.h"
#include <raylib.h>
#include <cstdint>

namespace ArtCade::Modules {

// ------------------------------------------------------------------ Pimpl

struct Renderer::Impl {
    uint32_t    width  = 1280;
    uint32_t    height = 720;
    std::string title  = "ArtCade V2";
    bool        open   = false;

    Camera2D camera = {};
    TextureCache texCache;
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

    // Camera origin at screen centre
    impl_->camera.offset = { impl_->width * 0.5f, impl_->height * 0.5f };
    impl_->camera.target = { 0.f, 0.f };
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
        impl_->camera.offset = { w * 0.5f, h * 0.5f };
    }
}

uint32_t Renderer::windowWidth()  const { return impl_->width;  }
uint32_t Renderer::windowHeight() const { return impl_->height; }

// ------------------------------------------------------------------ frame

void Renderer::beginFrame(const Vec4& clearColor) {
    BeginDrawing();
    ClearBackground(toColor(clearColor));
    BeginMode2D(impl_->camera);
}

void Renderer::endFrame() {
    EndMode2D();
    EndDrawing();
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
                           float          alpha)
{
    const Texture2D* tex = impl_->texCache.getByPath(assetId);
    if (!tex || tex->id == 0) return;

    Rectangle src = { 0.f, 0.f, static_cast<float>(tex->width), static_cast<float>(tex->height) };
    Rectangle dst = { pos.x, pos.y,
                      tex->width  * scale.x,
                      tex->height * scale.y };
    Vector2 origin = { dst.width * 0.5f, dst.height * 0.5f };

    DrawTexturePro(*tex, src, dst, origin, rotation, toColor(tint, alpha));
}

void Renderer::drawRect(float x, float y, float w, float h, const Vec4& color) {
    DrawRectangleV({ x, y }, { w, h }, toColor(color));
}

void Renderer::drawLine(float x1, float y1, float x2, float y2, const Vec4& color) {
    DrawLineV({ x1, y1 }, { x2, y2 }, toColor(color));
}

void Renderer::drawCircle(float x, float y, float radius, const Vec4& color) {
    DrawCircleV({ x, y }, radius, toColor(color));
}

// ------------------------------------------------------------------ textures

uint32_t Renderer::loadTexture(const std::string& path) {
    return impl_->texCache.load(path);
}

void Renderer::unloadTexture(uint32_t handle) {
    impl_->texCache.unload(handle);
}

bool Renderer::isTextureLoaded(const AssetId& assetId) const {
    return impl_->texCache.isLoaded(assetId);
}

// ------------------------------------------------------------------ camera

void Renderer::setCameraPosition(const Vec2& pos) {
    impl_->camera.target = { pos.x, pos.y };
}

void Renderer::setCameraZoom(float zoom) {
    impl_->camera.zoom = (zoom > 0.f) ? zoom : 0.01f;
}

float Renderer::deltaTime() const {
    return GetFrameTime();
}

} // namespace ArtCade::Modules

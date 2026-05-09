#include "renderer.h"
#include "../utils/logger.h"

namespace ArtCade {

Renderer::Renderer() = default;

Renderer::~Renderer() {
    shutdown();
}

bool Renderer::init(uint32_t width, uint32_t height, const std::string& windowTitle) {
    // TODO: Initialize Raylib
    // - SetConfigFlags(FLAG_MSAA_4X_HINT | FLAG_WINDOW_RESIZABLE)
    // - InitWindow(width, height, windowTitle.c_str())
    // - SetTargetFPS(60)
    // - ...

    windowWidth_ = width;
    windowHeight_ = height;
    isInitialized_ = true;

    Logger::log("Renderer initialized: " + std::to_string(width) + "x" + std::to_string(height));

    return true;
}

void Renderer::shutdown() {
    if (!isInitialized_) return;

    // TODO: CloseWindow() from Raylib

    isInitialized_ = false;
    Logger::log("Renderer shutdown");
}

void Renderer::beginFrame(const glm::vec4& clearColor) {
    // TODO: BeginDrawing() from Raylib
    // ClearBackground({(unsigned char)(clearColor.r * 255), ...})
}

void Renderer::endFrame() {
    // TODO: EndDrawing() from Raylib
}

bool Renderer::shouldClose() const {
    // TODO: return WindowShouldClose()
    return false;
}

void Renderer::drawSprite(
    const AssetId& spriteId,
    const glm::vec2& position,
    float rotation,
    const glm::vec2& scale,
    const glm::vec4& tint,
    float alpha) {

    // TODO: Draw sprite using Raylib
    // - Load or lookup texture
    // - DrawTexturePro with rotation/scale/tint
}

void Renderer::drawRectangle(
    float x, float y, float width, float height,
    const glm::vec4& color) {

    // TODO: DrawRectangle() from Raylib
}

void Renderer::drawLine(
    float x1, float y1, float x2, float y2,
    const glm::vec4& color) {

    // TODO: DrawLine() from Raylib
}

uint32_t Renderer::loadTexture(const std::string& path) {
    // TODO: Implement texture loading via Raylib
    // return (uint32_t)LoadTexture(path.c_str());
    return 0;
}

void Renderer::unloadTexture(uint32_t textureHandle) {
    // TODO: Implement texture unloading
}

void Renderer::setCameraPosition(const glm::vec2& pos) {
    // TODO: Implement camera positioning (future)
}

void Renderer::setCameraZoom(float zoom) {
    // TODO: Implement camera zoom (future)
}

} // namespace ArtCade

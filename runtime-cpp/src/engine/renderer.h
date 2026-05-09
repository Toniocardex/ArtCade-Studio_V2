#pragma once

#include "types.h"
#include <glm/glm.hpp>

namespace ArtCade {

class Renderer {
public:
    Renderer();
    ~Renderer();

    bool init(uint32_t width, uint32_t height, const std::string& windowTitle);
    void shutdown();

    void beginFrame(const glm::vec4& clearColor);
    void endFrame();

    bool shouldClose() const;

    void drawSprite(
        const AssetId& spriteId,
        const glm::vec2& position,
        float rotation,
        const glm::vec2& scale,
        const glm::vec4& tint,
        float alpha
    );

    void drawRectangle(
        float x, float y, float width, float height,
        const glm::vec4& color
    );

    void drawLine(
        float x1, float y1, float x2, float y2,
        const glm::vec4& color
    );

    // Asset loading
    uint32_t loadTexture(const std::string& path);
    void unloadTexture(uint32_t textureHandle);

    // Camera control (future)
    void setCameraPosition(const glm::vec2& pos);
    void setCameraZoom(float zoom);

private:
    uint32_t windowWidth_ = 0;
    uint32_t windowHeight_ = 0;
    bool isInitialized_ = false;
};

} // namespace ArtCade

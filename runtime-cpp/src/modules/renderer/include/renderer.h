#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <string>

namespace ArtCade::Modules {

/**
 * Renderer — public interface.
 *
 * Only this header is included by other modules.
 * Raylib, texture caching and drawable internals live in src/ (private).
 */
class Renderer final : public IModule {
public:
    Renderer() = default;

    bool init() override;
    void shutdown() override;

    void setWindowSize(uint32_t width, uint32_t height, const std::string& title);

    // Frame control
    void beginFrame(const Vec4& clearColor);
    void endFrame();
    bool shouldClose() const;

    // Drawing primitives
    void drawSprite(const AssetId& assetId,
                    const Vec2& position,
                    float       rotation,
                    const Vec2& scale,
                    const Vec4& tint,
                    float       alpha);

    void drawRect(float x, float y, float w, float h, const Vec4& color);
    void drawLine(float x1, float y1, float x2, float y2, const Vec4& color);
    void drawCircle(float x, float y, float radius, const Vec4& color);

    // Texture asset management
    uint32_t    loadTexture(const std::string& filePath);
    void        unloadTexture(uint32_t handle);
    bool        isTextureLoaded(const AssetId& assetId) const;

    // Camera (basic; extend later)
    void setCameraPosition(const Vec2& pos);
    void setCameraZoom(float zoom);

    uint32_t windowWidth()  const { return width_;  }
    uint32_t windowHeight() const { return height_; }

private:
    uint32_t    width_  = 1280;
    uint32_t    height_ = 720;
    std::string title_  = "ArtCade V2";
};

} // namespace ArtCade::Modules

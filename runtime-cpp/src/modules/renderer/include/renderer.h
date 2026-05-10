#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <string>
#include <memory>

namespace ArtCade::Modules {

/**
 * Renderer — Raylib window + 2D draw API.
 *
 * All Raylib types (Texture2D, Camera2D, Color …) are confined to
 * renderer.cpp via Pimpl — no raylib.h leaks into includers.
 */
class Renderer final : public IModule {
public:
    Renderer();
    ~Renderer();

    bool init()     override;
    void shutdown() override;

    // Must be called before init() to configure window parameters
    void setWindowSize(uint32_t width, uint32_t height, const std::string& title);

    // Frame lifecycle
    void beginFrame(const Vec4& clearColor);
    void endFrame();
    bool shouldClose() const;

    // Discard any draw commands queued by Lua this tick.
    // Called once per fixed-timestep iteration (before luaHost->tick) so that
    // only the LAST tick's drawScene() commands survive to endFrame().
    // Without this, a frame that runs 2+ ticks accumulates draw lists from
    // every tick, which creates a one-frame ghost of objects destroyed
    // mid-frame (e.g. the coin flash on pickup).
    void clearDrawQueue();

    // Draw calls (valid between beginFrame/endFrame)
    void drawSprite(const AssetId& assetId,
                    const Vec2&    position,
                    float          rotation,   // degrees
                    const Vec2&    scale,
                    const Vec4&    tint,
                    float          alpha);

    void drawRect  (float x, float y, float w, float h, const Vec4& color);
    void drawLine  (float x1, float y1, float x2, float y2, const Vec4& color);
    void drawCircle(float x, float y, float radius, const Vec4& color);
    void drawText  (const std::string& text, float x, float y,
                    int fontSize, const Vec4& color);

    // GPU texture management
    uint32_t loadTexture  (const std::string& filePath);
    void     unloadTexture(uint32_t handle);
    bool     isTextureLoaded(const AssetId& assetId) const;

    // 2D camera
    void setCameraPosition(const Vec2& pos);
    void setCameraZoom    (float zoom);
    Vec2 getCameraPosition() const;
    float getCameraZoom()   const;

    uint32_t windowWidth()  const;
    uint32_t windowHeight() const;
    float    deltaTime()    const;   // wraps Raylib GetFrameTime()

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace ArtCade::Modules

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
                    float          alpha,
                    const std::string& shaderEffect = "");

    /**
     * Phase F3: draw a sub-rectangle (atlas cell) of a texture at a
     * top-left destination. Returns false if the texture is missing
     * (caller can fall back to a colour rect). No rotation/origin —
     * tiles are axis-aligned and positioned by their top-left corner.
     */
    bool drawSpriteRegion(const AssetId& assetId,
                          float srcX, float srcY, float srcW, float srcH,
                          float dstX, float dstY, float dstW, float dstH);

    void drawRect  (float x, float y, float w, float h, const Vec4& color);
    void drawLine  (float x1, float y1, float x2, float y2, const Vec4& color);
    void drawCircle(float x, float y, float radius, const Vec4& color);
    void drawText  (const std::string& text, float x, float y,
                    int fontSize, const Vec4& color);

    /**
     * Register/replace a GPU texture decoded from an in-memory image buffer
     * under `assetId` (e.g. a tileset uploaded from the editor that is not
     * in the VFS). `ext` is a raylib file-type hint, e.g. ".png".
     * Returns false if the buffer could not be decoded.
     */
    bool registerImageFromMemory(const std::string& assetId,
                                 const unsigned char* data, int len,
                                 const std::string& ext);

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

    void setScreenShader(const std::string& name);
    void drawFadeOverlay(float alpha);
    void drawScreenPostEffects();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace ArtCade::Modules

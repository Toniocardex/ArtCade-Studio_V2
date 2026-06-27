#pragma once

#include <RmlUi/Core/RenderInterface.h>

#include <cstdint>
#include <unordered_map>

namespace ArtCade::EditorNative {

// =============================================================================
// RmlRenderer — Rml::RenderInterface implemented on raylib's rlgl.
//
// Drawing RmlUi geometry through rlgl (rather than a separate GL3 backend)
// keeps a single GL context and a single GL loader — the one raylib already
// owns. Textures are raylib Texture2D, clipping is raylib's scissor, and
// RmlUi's premultiplied-alpha vertices are blended with BLEND_ALPHA_PREMULTIPLY
// (set by RmlHost around the render pass).
// =============================================================================
class RmlRenderer final : public Rml::RenderInterface {
public:
    RmlRenderer() = default;
    ~RmlRenderer() override;

    Rml::CompiledGeometryHandle CompileGeometry(Rml::Span<const Rml::Vertex> vertices,
                                                Rml::Span<const int> indices) override;
    void RenderGeometry(Rml::CompiledGeometryHandle geometry, Rml::Vector2f translation,
                        Rml::TextureHandle texture) override;
    void ReleaseGeometry(Rml::CompiledGeometryHandle geometry) override;

    Rml::TextureHandle LoadTexture(Rml::Vector2i& texture_dimensions,
                                   const Rml::String& source) override;
    Rml::TextureHandle GenerateTexture(Rml::Span<const Rml::byte> source,
                                       Rml::Vector2i source_dimensions) override;
    void ReleaseTexture(Rml::TextureHandle texture) override;

    void EnableScissorRegion(bool enable) override;
    void SetScissorRegion(Rml::Rectanglei region) override;

private:
    void applyScissor();

    bool          scissorEnabled_ = false;
    Rml::Rectanglei scissorRegion_ = Rml::Rectanglei::MakeInvalid();
    std::uintptr_t nextTextureHandle_ = 1;
    std::unordered_map<std::uintptr_t, unsigned int> textures_;  // handle → raylib id
};

} // namespace ArtCade::EditorNative

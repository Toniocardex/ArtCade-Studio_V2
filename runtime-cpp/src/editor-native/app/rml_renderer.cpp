#include "editor-native/app/rml_renderer.h"

#include <raylib.h>
#include <rlgl.h>

#include <vector>

namespace ArtCade::EditorNative {

namespace {
struct CompiledGeo {
    std::vector<Rml::Vertex> vertices;
    std::vector<int>         indices;
};
} // namespace

RmlRenderer::~RmlRenderer() {
    for (const auto& [handle, id] : textures_) {
        if (id != 0) rlUnloadTexture(id);
    }
    textures_.clear();
}

Rml::CompiledGeometryHandle RmlRenderer::CompileGeometry(
    Rml::Span<const Rml::Vertex> vertices, Rml::Span<const int> indices) {
    auto* geo = new CompiledGeo;
    geo->vertices.assign(vertices.begin(), vertices.end());
    geo->indices.assign(indices.begin(), indices.end());
    return reinterpret_cast<Rml::CompiledGeometryHandle>(geo);
}

void RmlRenderer::RenderGeometry(Rml::CompiledGeometryHandle geometry,
                                 Rml::Vector2f translation,
                                 Rml::TextureHandle texture) {
    const auto* geo = reinterpret_cast<const CompiledGeo*>(geometry);
    if (!geo || geo->indices.empty()) return;

    unsigned int textureId = rlGetTextureIdDefault();   // 1x1 white for untextured
    if (texture != 0) {
        const auto it = textures_.find(static_cast<std::uintptr_t>(texture));
        if (it != textures_.end()) textureId = it->second;
    }

    rlSetTexture(textureId);
    rlBegin(RL_TRIANGLES);
    for (const int index : geo->indices) {
        const Rml::Vertex& v = geo->vertices[static_cast<std::size_t>(index)];
        rlColor4ub(v.colour.red, v.colour.green, v.colour.blue, v.colour.alpha);
        rlTexCoord2f(v.tex_coord.x, v.tex_coord.y);
        rlVertex2f(v.position.x + translation.x, v.position.y + translation.y);
    }
    rlEnd();
    rlSetTexture(0);
}

void RmlRenderer::ReleaseGeometry(Rml::CompiledGeometryHandle geometry) {
    delete reinterpret_cast<CompiledGeo*>(geometry);
}

Rml::TextureHandle RmlRenderer::LoadTexture(Rml::Vector2i& texture_dimensions,
                                            const Rml::String& source) {
    const Texture2D texture = ::LoadTexture(source.c_str());
    if (texture.id == 0) return 0;
    texture_dimensions.x = texture.width;
    texture_dimensions.y = texture.height;
    const std::uintptr_t handle = nextTextureHandle_++;
    textures_[handle] = texture.id;
    return static_cast<Rml::TextureHandle>(handle);
}

Rml::TextureHandle RmlRenderer::GenerateTexture(Rml::Span<const Rml::byte> source,
                                                Rml::Vector2i source_dimensions) {
    Image image;
    image.data    = const_cast<Rml::byte*>(source.data());
    image.width   = source_dimensions.x;
    image.height  = source_dimensions.y;
    image.mipmaps = 1;
    image.format  = PIXELFORMAT_UNCOMPRESSED_R8G8B8A8;
    const Texture2D texture = LoadTextureFromImage(image);  // uploads a copy to the GPU
    if (texture.id == 0) return 0;
    const std::uintptr_t handle = nextTextureHandle_++;
    textures_[handle] = texture.id;
    return static_cast<Rml::TextureHandle>(handle);
}

void RmlRenderer::ReleaseTexture(Rml::TextureHandle texture) {
    const auto it = textures_.find(static_cast<std::uintptr_t>(texture));
    if (it == textures_.end()) return;
    if (it->second != 0) rlUnloadTexture(it->second);
    textures_.erase(it);
}

void RmlRenderer::EnableScissorRegion(bool enable) {
    scissorEnabled_ = enable;
    applyScissor();
}

void RmlRenderer::SetScissorRegion(Rml::Rectanglei region) {
    scissorRegion_ = region;
    if (scissorEnabled_) applyScissor();
}

void RmlRenderer::applyScissor() {
    if (scissorEnabled_ && scissorRegion_.Valid()) {
        const Rml::Vector2i pos  = scissorRegion_.Position();
        const Rml::Vector2i size = scissorRegion_.Size();
        BeginScissorMode(pos.x, pos.y, size.x, size.y);
    } else {
        EndScissorMode();
    }
}

} // namespace ArtCade::EditorNative

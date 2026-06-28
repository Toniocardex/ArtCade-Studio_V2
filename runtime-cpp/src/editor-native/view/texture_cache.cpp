#include "editor-native/view/texture_cache.h"

#include <raylib.h>

#include <utility>

namespace ArtCade::EditorNative {

TextureCache::TextureCache(std::filesystem::path resourceRoot)
    : resourceRoot_(std::move(resourceRoot)) {}

TextureCache::~TextureCache() {
    clear();
}

void TextureCache::prepare(const std::vector<SceneFrameSprite>& sprites,
                           const std::unordered_map<AssetId, ImageAssetDef>& imageAssets) {
    for (const SceneFrameSprite& sprite : sprites) {
        if (!sprite.visible || sprite.assetId.empty()) continue;
        const auto assetIt = imageAssets.find(sprite.assetId);
        if (assetIt == imageAssets.end()) continue;
        (void)findOrLoad(sprite.assetId, assetIt->second);
    }
}

const TextureResource* TextureCache::find(const AssetId& assetId) const {
    const auto it = entries_.find(assetId);
    return it == entries_.end() ? nullptr : &it->second;
}

void TextureCache::clear() {
    if (!IsWindowReady()) {
        entries_.clear();
        return;
    }
    for (auto& [_, resource] : entries_) {
        if (resource.loaded && resource.texture.id != 0) {
            UnloadTexture(resource.texture);
            resource.texture = Texture2D{};
        }
    }
    entries_.clear();
}

const TextureResource* TextureCache::findOrLoad(const AssetId& assetId,
                                                const ImageAssetDef& asset) {
    const auto existing = entries_.find(assetId);
    if (existing != entries_.end()) return &existing->second;

    TextureResource resource;
    if (asset.sourcePath.empty()) {
        resource.error = "image asset has no sourcePath";
        const auto [it, _] = entries_.emplace(assetId, std::move(resource));
        return &it->second;
    }

    const std::filesystem::path path = resolvePath(asset);
    if (!std::filesystem::exists(path)) {
        resource.error = "missing image file: " + path.string();
        const auto [it, _] = entries_.emplace(assetId, std::move(resource));
        return &it->second;
    }

    resource.texture = LoadTexture(path.string().c_str());
    if (resource.texture.id == 0) {
        resource.error = "failed to load image file: " + path.string();
    } else {
        resource.loaded = true;
        SetTextureFilter(resource.texture, TEXTURE_FILTER_POINT);
    }

    const auto [it, _] = entries_.emplace(assetId, std::move(resource));
    return &it->second;
}

std::filesystem::path TextureCache::resolvePath(const ImageAssetDef& asset) const {
    const std::filesystem::path path(asset.sourcePath);
    if (path.is_absolute()) return path;
    return resourceRoot_ / path;
}

} // namespace ArtCade::EditorNative

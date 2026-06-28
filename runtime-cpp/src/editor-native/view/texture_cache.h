#pragma once

#include "core/types.h"
#include "editor-native/model/scene_frame_snapshot.h"

#include <filesystem>
#include <string>
#include <unordered_map>
#include <vector>

#include <raylib.h>

namespace ArtCade::EditorNative {

struct TextureResource {
    Texture2D texture{};
    bool loaded = false;
    std::string error;
};

class TextureCache {
public:
    explicit TextureCache(std::filesystem::path resourceRoot);
    ~TextureCache();

    void prepare(const std::vector<SceneFrameSprite>& sprites,
                 const std::unordered_map<AssetId, ImageAssetDef>& imageAssets);
    const TextureResource* find(const AssetId& assetId) const;
    void clear();

private:
    const TextureResource* findOrLoad(const AssetId& assetId, const ImageAssetDef& asset);
    std::filesystem::path resolvePath(const ImageAssetDef& asset) const;

    std::filesystem::path resourceRoot_;
    std::unordered_map<AssetId, TextureResource> entries_;
};

} // namespace ArtCade::EditorNative

#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <string>
#include <vector>

namespace ArtCade::Modules {

/**
 * AssetLoader — project loading and asset path resolution.
 *
 * Supports two modes:
 *   - Dev  : loose directory (fast iteration)
 *   - Ship : packed .artcade ZIP (single-file distribution)
 *
 * Asset caching (GPU textures, audio handles) is the responsibility of
 * the Renderer and Audio modules; AssetLoader only handles disk I/O.
 */
class AssetLoader final : public IModule {
public:
    AssetLoader() = default;

    bool init() override;
    void shutdown() override;

    // Load from packed .artcade archive
    bool loadArtcade(const std::string& archivePath, ProjectDoc& outDoc);

    // Load from loose directory (dev mode)
    bool loadDirectory(const std::string& dirPath, ProjectDoc& outDoc);

    // Load raw Lua bytecode
    bool loadLuaBytecode(const std::string& scriptPath,
                         std::vector<uint8_t>& outBytes);

    // Resolve asset file path (works in both dev and packed mode)
    std::string resolveAssetPath(const std::string& assetId,
                                 const std::string& assetType) const;

    bool isDevMode() const { return devMode_; }

private:
    bool        devMode_  = false;
    std::string rootPath_;

    bool parseProjectJson(const std::string& path, ProjectDoc& out);
    bool parseGameJson(const std::string& path,    ProjectDoc& out);
    bool extractZip(const std::string& zipPath, const std::string& destDir);
};

} // namespace ArtCade::Modules

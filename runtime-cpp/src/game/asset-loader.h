#pragma once

#include "../engine/types.h"
#include <string>

namespace ArtCade {

/**
 * AssetLoader: Loads ProjectDoc and game assets
 *
 * Parses .artcade ZIP files and loads ProjectDoc JSON + assets.
 */
class AssetLoader {
public:
    AssetLoader();
    ~AssetLoader();

    // Load project from .artcade file
    bool loadProject(const std::string& artcadeFilePath, ProjectDoc& outProjectDoc);

    // Load project from loose files (development mode)
    bool loadProjectFromDirectory(const std::string& projectDirectory, ProjectDoc& outProjectDoc);

    // Load raw Lua bytecode
    bool loadLuaBytecode(const std::string& path, std::vector<uint8_t>& outBytecode);

    // Asset path resolution
    std::string resolveAssetPath(const std::string& assetId, const std::string& assetType) const;

private:
    std::string projectRoot_;

    // Parse JSON files
    bool parseProjectJson(const std::string& jsonPath, ProjectDoc& outProjectDoc);
    bool parseGameJson(const std::string& jsonPath, ProjectDoc& outProjectDoc);

    // ZIP extraction (for .artcade)
    bool extractArtcadeZip(const std::string& zipPath, const std::string& extractDir);
};

} // namespace ArtCade

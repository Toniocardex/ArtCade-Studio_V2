#include "../include/asset-loader.h"
#include "zip-reader.h"
#include "object-type-materialize.h"
#include "asset-json.h"
#include "entity-json.h"
#include "json-primitives.h"
#include "scene-json.h"
#include "project-meta-json.h"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <functional>
#include <sstream>
#include <system_error>

using json = nlohmann::json;

namespace ArtCade::Modules {

using ProjectJson::read_float_any;
using ProjectJson::read_string_any;

// ------------------------------------------------------------------ lifecycle

bool AssetLoader::init()     { return true; }
void AssetLoader::shutdown() {
    if (!extractTempDir_.empty()) {
        std::error_code ec;
        std::filesystem::remove_all(extractTempDir_, ec);
        extractTempDir_.clear();
    }
}

// ------------------------------------------------------------------ loaders

void AssetLoader::loadManifestForRoot(const std::string& rootPath) {
    manifestIndex_.clear();
    manifestIndex_.loadFromJsonFile(rootPath + "/manifest.json");
}

std::string AssetLoader::resolveImagePath(const std::string& ref) const {
    return manifestIndex_.resolveImageKey(ref);
}

std::string AssetLoader::resolveAudioPath(const std::string& ref) const {
    return manifestIndex_.resolveAudioKey(ref);
}

bool AssetLoader::loadDirectory(const std::string& dirPath, ProjectDoc& out) {
    extractTempDir_.clear();
    rootPath_ = dirPath;
    devMode_  = true;
    loadManifestForRoot(dirPath);
    try {
        if (!parseProjectJson(dirPath + "/project.json", out)) return false;
        parseGameJson(dirPath + "/game.json", out);
    } catch (...) {
        return false;
    }
    return true;
}

bool AssetLoader::loadArtcade(const std::string& archivePath, ProjectDoc& out) {
    // Build a stable temp directory derived from the archive path
    const std::size_t h = std::hash<std::string>{}(archivePath);
    namespace fs = std::filesystem;
    const std::string tmpDir =
        (fs::temp_directory_path() / ("artcade_" + std::to_string(h))).string();

    std::error_code ec;
    fs::remove_all(tmpDir, ec);
    if (!extractZip(archivePath, tmpDir)) return false;

    extractTempDir_ = tmpDir;
    rootPath_ = tmpDir;
    devMode_  = false;
    loadManifestForRoot(tmpDir);
    try {
        if (!parseProjectJson(tmpDir + "/project.json", out)) return false;
        parseGameJson(tmpDir + "/game.json", out);
    } catch (...) {
        return false;
    }
    return true;
}

bool AssetLoader::loadLuaBytecode(const std::string& path,
                                   std::vector<uint8_t>& outBytes) {
    // If the path is relative, resolve it against the project root
    bool isAbsolute = !path.empty() &&
        (path[0] == '/' || path[0] == '\\' ||
         (path.size() > 1 && path[1] == ':'));
    std::string fullPath = isAbsolute ? path : (rootPath_ + "/" + path);

    std::ifstream f(fullPath, std::ios::binary);
    if (!f) return false;
    outBytes.assign(std::istreambuf_iterator<char>(f),
                    std::istreambuf_iterator<char>());
    return !outBytes.empty();
}

std::string AssetLoader::resolveAssetPath(const std::string& assetId,
                                          const std::string& assetType) const {
    return rootPath_ + "/assets/" + assetType + "/" + assetId;
}

// ------------------------------------------------------------------ JSON parsing

bool AssetLoader::parseProjectJson(const std::string& path, ProjectDoc& out) {
    imagePointsByAsset_.clear();
    // project.json assets augment manifest (dev mode may have no manifest.json).
    std::ifstream f(path);
    if (!f) return false;

    json j;
    try { j = json::parse(f); }
    catch (...) { return false; }

    ProjectJson::read_project_header(j, out);

    if (j.contains("world") && j["world"].is_object())
        ProjectJson::read_world_settings(j["world"], out.world);

    ProjectJson::read_object_types_map(j, out.objectTypes);
    ProjectJson::read_entities_map(j, out.entities, false);
    ProjectJson::read_scenes_map(j, out.scenes);
    ProjectJson::read_thumbnails(j, out.thumbnails);
    ProjectJson::read_tile_palette(j, out.tilePalette);
    ProjectJson::read_tilesets(j, out.tilesets);

    materializeProjectEntities(out);

    if (j.contains("assets") && j["assets"].is_object()) {
        for (auto& [key, av] : j["assets"].items()) {
            if (!av.is_object()) continue;
            const std::string libId   = av.value("id", key);
            const std::string libPath = av.value("path", std::string{});
            if (!libPath.empty())
                manifestIndex_.addImageEntry(libId, libPath);
            ImageAssetDef ad;
            ProjectJson::read_image_asset(av, key, ad);
            out.imageAssets.push_back(ad);
            if (!ad.imagePoints.empty())
                imagePointsByAsset_[ad.assetId] = ad.imagePoints;
        }
    }

    resolveSpritePivotsFromImageAssets(out);

    return true;
}

std::optional<Vec2> AssetLoader::getImagePoint(const std::string& assetRef,
                                                const std::string& pointId) const {
    const std::string pathKey = manifestIndex_.resolveImageKey(assetRef);
    auto it = imagePointsByAsset_.find(pathKey);
    if (it == imagePointsByAsset_.end() && pathKey != assetRef)
        it = imagePointsByAsset_.find(assetRef);
    if (it == imagePointsByAsset_.end()) return std::nullopt;
    for (const auto& p : it->second) {
        if (p.id == pointId) return Vec2{ p.x, p.y };
    }
    return std::nullopt;
}

bool AssetLoader::parseGameJson(const std::string& path, ProjectDoc& out) {
    std::ifstream f(path);
    if (!f) return true;

    json j;
    try { j = json::parse(f); }
    catch (...) { return false; }

    out.targetFPS = read_float_any(j, "targetFPS", "target_fps", out.targetFPS);
    out.licenseTier = read_string_any(j, "licenseTier", "license_tier", out.licenseTier);
    return true;
}

bool AssetLoader::extractZip(const std::string& zipPath, const std::string& destDir) {
    return ArtCade::zipExtractAll(zipPath, destDir);
}

} // namespace ArtCade::Modules

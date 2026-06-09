#include "../include/asset-loader.h"
#include "zip-reader.h"
#include "object-type-materialize.h"
#include "entity-json.h"
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

// ------------------------------------------------------------------ helpers

static Vec2 readVec2(const json& j, Vec2 def = {}) {
    if (j.is_array() && j.size() >= 2)
        return { j[0].get<float>(), j[1].get<float>() };
    if (j.is_object())
        return { j.value("x", def.x), j.value("y", def.y) };
    return def;
}

static Vec4 readVec4(const json& j, Vec4 def = {1,1,1,1}) {
    if (j.is_array() && j.size() >= 4)
        return { j[0].get<float>(), j[1].get<float>(),
                 j[2].get<float>(), j[3].get<float>() };
    if (j.is_object())
        return {
            j.contains("r") ? j["r"].get<float>() : j.value("x", def.r),
            j.contains("g") ? j["g"].get<float>() : j.value("y", def.g),
            j.contains("b") ? j["b"].get<float>() : j.value("z", def.b),
            j.contains("a") ? j["a"].get<float>() : j.value("w", def.a)
        };
    return def;
}

static std::string readStringAny(const json& j,
                                 const char* camel,
                                 const char* snake,
                                 const std::string& def = {}) {
    if (j.contains(camel)) return j[camel].get<std::string>();
    if (j.contains(snake)) return j[snake].get<std::string>();
    return def;
}

static float readFloatAny(const json& j, const char* camel, const char* snake, float def) {
    if (j.contains(camel)) return j[camel].get<float>();
    if (j.contains(snake)) return j[snake].get<float>();
    return def;
}

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

    out.projectName    = readStringAny(j, "projectName", "project_name", "Untitled");
    out.version        = j.value("version", "2.0.0");
    out.licenseTier    = readStringAny(j, "licenseTier", "license_tier", "free");
    out.targetFPS      = readFloatAny(j, "targetFPS", "target_fps", 60.f);
    out.activeSceneId  = readStringAny(j, "activeSceneId", "active_scene_id");
    out.mainScriptPath = readStringAny(j, "mainScriptPath", "main_script_path", "scripts/main.luac");
    out.formatVersion  = j.value("formatVersion", j.value("format_version", 0));

    if (j.contains("world") && j["world"].is_object())
        ProjectJson::read_world_settings(j["world"], out.world);

    // Object types (v2)
    const json* objectTypesRaw = nullptr;
    if (j.contains("objectTypes") && j["objectTypes"].is_object())
        objectTypesRaw = &j["objectTypes"];
    else if (j.contains("object_types") && j["object_types"].is_object())
        objectTypesRaw = &j["object_types"];
    if (objectTypesRaw) {
        for (auto& [key, tv] : objectTypesRaw->items()) {
            if (!tv.is_object()) continue;
            EntityDef e;
            ProjectJson::read_object_type(tv, key, e);
            if (!e.className.empty())
                out.objectTypes[e.className] = std::move(e);
        }
    }

    // Entities
    if (j.contains("entities")) {
        const auto& ents = j["entities"];
        auto ingest_entity = [&](const json& ev, EntityId fallbackId) {
            EntityDef e;
            ProjectJson::read_entity_instance(ev, fallbackId, e, false);
            if (e.id != 0)
                out.entities[e.id] = std::move(e);
        };
        if (ents.is_object()) {
            for (auto& [key, ev] : ents.items()) {
                const EntityId fid = static_cast<EntityId>(std::stoul(key));
                ingest_entity(ev, fid);
            }
        } else if (ents.is_array()) {
            for (const auto& ev : ents) {
                ingest_entity(ev, static_cast<EntityId>(out.entities.size() + 1));
            }
        }
    }

    // Scenes
    if (j.contains("scenes")) {
        const auto& sc = j["scenes"];
        auto ingest_scene = [&](const json& sv, const SceneId& fallbackId) {
            SceneDef s;
            ProjectJson::read_scene_def(sv, fallbackId, s);
            out.scenes[s.id] = std::move(s);
        };
        if (sc.is_object()) {
            for (auto& [key, sv] : sc.items())
                ingest_scene(sv, key);
        } else if (sc.is_array()) {
            for (const auto& sv : sc)
                ingest_scene(sv, "scene_" + std::to_string(out.scenes.size()));
        }
    }

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
            ad.assetId = libPath.empty() ? libId : libPath;
            if (av.contains("imagePoints") && av["imagePoints"].is_array()) {
                for (const auto& pt : av["imagePoints"]) {
                    if (!pt.is_object()) continue;
                    ImagePointDef ip;
                    ip.id = pt.value("id", std::string{});
                    ip.x  = pt.value("x", 0.f);
                    ip.y  = pt.value("y", 0.f);
                    if (!ip.id.empty()) ad.imagePoints.push_back(ip);
                }
            }
            if (av.contains("clips") && av["clips"].is_array()) {
                for (const auto& cv : av["clips"]) {
                    if (!cv.is_object()) continue;
                    AnimationClipDef clip;
                    clip.name = cv.value("name", std::string{});
                    clip.fps  = cv.value("fps", 12.f);
                    clip.loop = cv.value("loop", true);
                    if (cv.contains("frames") && cv["frames"].is_array()) {
                        for (const auto& fr : cv["frames"]) {
                            if (!fr.is_object()) continue;
                            AnimationFrameRect rect;
                            rect.x = fr.value("x", 0.f);
                            rect.y = fr.value("y", 0.f);
                            rect.w = fr.value("w", 0.f);
                            rect.h = fr.value("h", 0.f);
                            if (rect.w > 0.f && rect.h > 0.f)
                                clip.frames.push_back(rect);
                        }
                    }
                    if (!clip.name.empty() && !clip.frames.empty())
                        ad.clips.push_back(std::move(clip));
                }
            }
            if (av.contains("defaultPivot"))
                ad.defaultPivot = readVec2(av["defaultPivot"], ad.defaultPivot);
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

    out.targetFPS = readFloatAny(j, "targetFPS", "target_fps", out.targetFPS);
    out.licenseTier = readStringAny(j, "licenseTier", "license_tier", out.licenseTier);
    return true;
}

bool AssetLoader::extractZip(const std::string& zipPath, const std::string& destDir) {
    return ArtCade::zipExtractAll(zipPath, destDir);
}

} // namespace ArtCade::Modules

#include "../include/asset-loader.h"
#include <nlohmann/json.hpp>
#include <fstream>
#include <sstream>

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
        return { j.value("r", def.r), j.value("g", def.g),
                 j.value("b", def.b), j.value("a", def.a) };
    return def;
}

// ------------------------------------------------------------------ lifecycle

bool AssetLoader::init()     { return true; }
void AssetLoader::shutdown() {}

// ------------------------------------------------------------------ loaders

bool AssetLoader::loadDirectory(const std::string& dirPath, ProjectDoc& out) {
    rootPath_ = dirPath;
    devMode_  = true;
    return parseProjectJson(dirPath + "/project.json", out);
}

bool AssetLoader::loadArtcade(const std::string& archivePath, ProjectDoc& out) {
    // Phase 10b: extract ZIP then parse project.json from temp dir
    rootPath_ = archivePath;
    devMode_  = false;
    return false;  // ZIP support: future
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
    std::ifstream f(path);
    if (!f) return false;

    json j;
    try { j = json::parse(f); }
    catch (...) { return false; }

    out.projectName    = j.value("projectName",   "Untitled");
    out.version        = j.value("version",        "2.0.0");
    out.targetFPS      = j.value("targetFPS",       60.f);
    out.activeSceneId  = j.value("activeSceneId",  std::string{});
    out.mainScriptPath = j.value("mainScriptPath", std::string{"scripts/main.luac"});

    if (j.contains("gameResolution"))
        out.gameResolution = readVec2(j["gameResolution"]);

    // Entities
    if (j.contains("entities") && j["entities"].is_object()) {
        for (auto& [key, ev] : j["entities"].items()) {
            EntityDef e;
            e.id        = ev.value("id",        static_cast<EntityId>(0));
            e.name      = ev.value("name",      std::string{});
            e.className = ev.value("className", std::string{});

            if (ev.contains("tags") && ev["tags"].is_array())
                e.tags = ev["tags"].get<std::vector<std::string>>();

            if (ev.contains("transform")) {
                auto& t = ev["transform"];
                if (t.contains("position"))
                    e.transform.position = readVec2(t["position"]);
                if (t.contains("scale"))
                    e.transform.scale = readVec2(t["scale"], {1,1});
                e.transform.rotation = t.value("rotation", 0.f);
            }

            if (ev.contains("sprite")) {
                auto& s = ev["sprite"];
                e.sprite.spriteAssetId = s.value("spriteAssetId", std::string{});
                if (s.contains("tint"))
                    e.sprite.tint = readVec4(s["tint"]);
                e.sprite.alpha       = s.value("alpha",       1.f);
                e.sprite.renderOrder = s.value("renderOrder", 0);
            }

            if (e.id != 0)
                out.entities[e.id] = std::move(e);
        }
    }

    // Scenes
    if (j.contains("scenes") && j["scenes"].is_object()) {
        for (auto& [key, sv] : j["scenes"].items()) {
            SceneDef s;
            s.id   = sv.value("id",   key);
            s.name = sv.value("name", key);

            if (sv.contains("worldSize"))
                s.worldSize    = readVec2(sv["worldSize"],    {800,600});
            if (sv.contains("viewportSize"))
                s.viewportSize = readVec2(sv["viewportSize"], {800,600});
            if (sv.contains("backgroundColor"))
                s.backgroundColor = readVec4(sv["backgroundColor"]);

            if (sv.contains("entityIds") && sv["entityIds"].is_array())
                s.entityIds = sv["entityIds"].get<std::vector<EntityId>>();

            out.scenes[s.id] = std::move(s);
        }
    }

    return true;
}

bool AssetLoader::parseGameJson(const std::string&, ProjectDoc&) {
    return false;  // used internally by loadArtcade (future)
}

bool AssetLoader::extractZip(const std::string&, const std::string&) {
    return false;  // Phase 10b
}

} // namespace ArtCade::Modules

#include "../include/asset-loader.h"
#include "zip-reader.h"
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <functional>
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

// "#RRGGBB" / "#RGB" → Vec4 (0..1). Falls back to opaque grey on bad input.
static Vec4 hexToVec4(const std::string& hex) {
    auto h = hex;
    if (!h.empty() && h[0] == '#') h.erase(0, 1);
    if (h.size() == 3) h = { h[0],h[0], h[1],h[1], h[2],h[2] };
    if (h.size() != 6) return {0.5f, 0.5f, 0.5f, 1.f};
    auto byte = [&](int i) {
        return static_cast<float>(std::stoi(h.substr(i, 2), nullptr, 16)) / 255.f;
    };
    return { byte(0), byte(2), byte(4), 1.f };
}

// ------------------------------------------------------------------ lifecycle

bool AssetLoader::init()     { return true; }
void AssetLoader::shutdown() {}

// ------------------------------------------------------------------ loaders

bool AssetLoader::loadDirectory(const std::string& dirPath, ProjectDoc& out) {
    rootPath_ = dirPath;
    devMode_  = true;
    if (!parseProjectJson(dirPath + "/project.json", out)) return false;
    parseGameJson(dirPath + "/game.json", out);
    return true;
}

bool AssetLoader::loadArtcade(const std::string& archivePath, ProjectDoc& out) {
    // Build a stable temp directory derived from the archive path
    const std::size_t h = std::hash<std::string>{}(archivePath);
    namespace fs = std::filesystem;
    const std::string tmpDir =
        (fs::temp_directory_path() / ("artcade_" + std::to_string(h))).string();

    if (!extractZip(archivePath, tmpDir)) return false;

    rootPath_ = tmpDir;
    devMode_  = false;
    if (!parseProjectJson(tmpDir + "/project.json", out)) return false;
    parseGameJson(tmpDir + "/game.json", out);
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

    // Entities
    if (j.contains("entities") && j["entities"].is_object()) {
        for (auto& [key, ev] : j["entities"].items()) {
            EntityDef e;
            e.id        = ev.value("id", static_cast<EntityId>(0));
            e.name      = ev.value("name", std::string{});
            e.className = readStringAny(ev, "className", "class_name");

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
                e.sprite.spriteAssetId = readStringAny(s, "spriteAssetId", "sprite_asset_id");
                if (s.contains("tint"))
                    e.sprite.tint = readVec4(s["tint"]);
                e.sprite.alpha       = s.value("alpha",       1.f);
                e.sprite.renderOrder = s.contains("renderOrder")
                    ? s["renderOrder"].get<int32_t>()
                    : s.value("render_order", 0);
            }

            if (ev.contains("physics") && ev["physics"].is_object()) {
                auto& p = ev["physics"];
                PhysicsComponent pc;
                const std::string bt = p.value("bodyType", std::string("Dynamic"));
                if (bt == "Static")
                    pc.bodyType = BodyType::Static;
                else if (bt == "Kinematic")
                    pc.bodyType = BodyType::Kinematic;
                else
                    pc.bodyType = BodyType::Dynamic;
                if (p.contains("collider") && p["collider"].is_object()) {
                    auto& c = p["collider"];
                    const std::string shape = c.value("shape", std::string("Rectangle"));
                    pc.collider.shape = (shape == "Circle")
                        ? ColliderShape::Circle
                        : ColliderShape::Rectangle;
                    if (c.contains("size"))
                        pc.collider.size = readVec2(c["size"]);
                    if (c.contains("offset"))
                        pc.collider.offset = readVec2(c["offset"]);
                    pc.collider.density  = c.value("density", 1.f);
                    pc.collider.friction = c.value("friction", 0.3f);
                    pc.collider.isSensor = c.value("isSensor", false);
                }
                e.physics = pc;
            }

            // Optional gameplay components (Phase D1) — names mirror editor TS
            if (ev.contains("sensor") && ev["sensor"].is_object()) {
                auto& s = ev["sensor"];
                SensorComponent sc;
                sc.shape     = s.value("shape", std::string("Circle"));
                sc.radius    = s.value("radius", 120.f);
                sc.width     = s.value("width", 64.f);
                sc.height    = s.value("height", 64.f);
                sc.targetTag = s.value("targetTag", std::string("player"));
                e.sensor = sc;
            }
            if (ev.contains("platformerController") && ev["platformerController"].is_object()) {
                auto& p = ev["platformerController"];
                PlatformerControllerComponent pc;
                pc.maxSpeed      = p.value("maxSpeed", 300.f);
                pc.jumpForce     = p.value("jumpForce", 600.f);
                pc.customGravity = p.value("customGravity", 1500.f);
                pc.coyoteTime    = p.value("coyoteTime", 0.15f);
                pc.jumpBuffer    = p.value("jumpBuffer", 0.1f);
                pc.groundClass   = p.value("groundClass", std::string("Ground"));
                e.platformerController = pc;
            }
            if (ev.contains("topDownController") && ev["topDownController"].is_object()) {
                auto& t = ev["topDownController"];
                TopDownControllerComponent tc;
                tc.maxSpeed       = t.value("maxSpeed", 260.f);
                tc.acceleration   = t.value("acceleration", 1600.f);
                tc.friction       = t.value("friction", 2200.f);
                tc.fourDirections = t.value("fourDirections", false);
                e.topDownController = tc;
            }
            if (ev.contains("linearMover") && ev["linearMover"].is_object()) {
                auto& m = ev["linearMover"];
                LinearMoverComponent lm;
                lm.directionX = m.value("directionX", 1.f);
                lm.directionY = m.value("directionY", 0.f);
                lm.speed      = m.value("speed", 300.f);
                e.linearMover = lm;
            }
            if (ev.contains("cameraTarget") && ev["cameraTarget"].is_object()) {
                auto& c = ev["cameraTarget"];
                CameraTargetComponent ct;
                ct.offsetX     = c.value("offsetX", 0.f);
                ct.offsetY     = c.value("offsetY", 0.f);
                ct.followSpeed = c.value("followSpeed", 8.f);
                e.cameraTarget = ct;
            }
            if (ev.contains("magneticItem") && ev["magneticItem"].is_object()) {
                auto& m = ev["magneticItem"];
                MagneticItemComponent mi;
                mi.attractTag = m.value("attractTag", std::string("pickup"));
                mi.radius     = m.value("radius", 200.f);
                mi.pullSpeed  = m.value("pullSpeed", 400.f);
                e.magneticItem = mi;
            }
            if (ev.contains("health") && ev["health"].is_object()) {
                auto& h = ev["health"];
                HealthComponent hc;
                hc.maxHp     = h.value("maxHp", 100.f);
                hc.currentHp = h.value("currentHp", hc.maxHp);
                hc.iFrames   = h.value("iFrames", 0.2f);
                e.health = hc;
            }
            if (ev.contains("autoDestroy") && ev["autoDestroy"].is_object()) {
                AutoDestroyComponent ac;
                ac.lifespan = ev["autoDestroy"].value("lifespan", 0.f);
                e.autoDestroy = ac;
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
            if (sv.contains("background_color"))
                s.backgroundColor = readVec4(sv["background_color"]);

            if (sv.contains("entityIds") && sv["entityIds"].is_array())
                s.entityIds = sv["entityIds"].get<std::vector<EntityId>>();
            if (sv.contains("entity_ids") && sv["entity_ids"].is_array())
                s.entityIds = sv["entity_ids"].get<std::vector<EntityId>>();

            if (sv.contains("tilemap") && sv["tilemap"].is_object()) {
                const auto& tm = sv["tilemap"];
                s.tilemap.tileSize = tm.value("tileSize", 32.f);
                s.tilemap.cols     = tm.value("cols", 0);
                s.tilemap.rows     = tm.value("rows", 0);
                if (tm.contains("data") && tm["data"].is_array())
                    s.tilemap.data = tm["data"].get<std::vector<int>>();
                s.tilemap.tilesetAssetId =
                    tm.value("tilesetAssetId", std::string{});
            }

            out.scenes[s.id] = std::move(s);
        }
    }

    if (j.contains("thumbnails") && j["thumbnails"].is_object()) {
        for (auto& [sceneId, thumbPath] : j["thumbnails"].items())
            out.thumbnails[sceneId] = thumbPath.get<std::string>();
    }

    // Tile palette (Phase D2) — id, name, hex color, solid
    if (j.contains("tilePalette") && j["tilePalette"].is_array()) {
        for (const auto& t : j["tilePalette"]) {
            if (!t.is_object()) continue;
            TilePaletteEntry e;
            e.id    = t.value("id", 0);
            if (e.id < 1) continue;
            e.name  = t.value("name", std::string{});
            e.color = hexToVec4(t.value("color", std::string("#808080")));
            e.solid = t.value("solid", false);
            out.tilePalette.push_back(e);
        }
    }

    // Tilesets (Phase F3) — spritesheet metadata, keyed by assetId
    if (j.contains("tilesets") && j["tilesets"].is_object()) {
        for (auto& [key, tv] : j["tilesets"].items()) {
            if (!tv.is_object()) continue;
            TilesetAsset ts;
            ts.assetId         = tv.value("assetId", key);
            ts.spriteImagePath = tv.value("spriteImagePath", std::string{});
            ts.tileSize        = tv.value("tileSize", 32.f);
            ts.margin          = tv.value("margin", 0);
            ts.cols            = tv.value("cols", 1);
            ts.rows            = tv.value("rows", 1);
            out.tilesets.push_back(ts);
        }
    }

    if (j.contains("assets") && j["assets"].is_object()) {
        for (auto& [key, av] : j["assets"].items()) {
            if (!av.is_object()) continue;
            ImageAssetDef ad;
            ad.assetId = av.value("path", key);
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
            out.imageAssets.push_back(ad);
            if (!ad.imagePoints.empty())
                imagePointsByAsset_[ad.assetId] = ad.imagePoints;
        }
    }

    return true;
}

std::optional<Vec2> AssetLoader::getImagePoint(const std::string& assetPath,
                                                const std::string& pointId) const {
    auto it = imagePointsByAsset_.find(assetPath);
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

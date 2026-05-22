#include "project-doc-parser.h"

#ifdef __EMSCRIPTEN__

#include <string>
#include <utility>

namespace ArtCade::ProjectDocParser {

using json = nlohmann::json;

Vec2 parseVec2(const json& j) {
    Vec2 v;
    if (j.is_array() && j.size() >= 2) {
        v.x = j[0].get<float>();
        v.y = j[1].get<float>();
    } else if (j.is_object()) {
        v.x = j.value("x", 0.f);
        v.y = j.value("y", 0.f);
    }
    return v;
}

Vec4 parseVec4(const json& j) {
    Vec4 v{1.f, 1.f, 1.f, 1.f};
    if (j.is_array() && j.size() >= 4) {
        v.r = j[0].get<float>();
        v.g = j[1].get<float>();
        v.b = j[2].get<float>();
        v.a = j[3].get<float>();
    } else if (j.is_object()) {
        // Accept both {r,g,b,a} (C++ serialiser) and {x,y,z,w} (TypeScript).
        v.r = j.contains("r") ? j["r"].get<float>() : j.value("x", 1.f);
        v.g = j.contains("g") ? j["g"].get<float>() : j.value("y", 1.f);
        v.b = j.contains("b") ? j["b"].get<float>() : j.value("z", 1.f);
        v.a = j.contains("a") ? j["a"].get<float>() : j.value("w", 1.f);
    }
    return v;
}

Transform parseTransform(const json& j) {
    Transform t;
    if (!j.is_object()) return t;
    if (j.contains("position")) t.position = parseVec2(j["position"]);
    if (j.contains("scale"))    t.scale    = parseVec2(j["scale"]);
    t.rotation = j.value("rotation", 0.f);
    return t;
}

SpriteComponent parseSprite(const json& j) {
    SpriteComponent s;
    if (!j.is_object()) return s;
    s.spriteAssetId = j.value("spriteAssetId", j.value("sprite_asset_id", std::string{}));
    if (j.contains("tint"))  s.tint  = parseVec4(j["tint"]);
    s.alpha       = j.value("alpha", 1.f);
    if (j.contains("pivot")) s.pivot = parseVec2(j["pivot"]);
    s.renderOrder = j.value("renderOrder", j.value("render_order", 0));
    return s;
}

EntityDef parseEntityDef(const json& j, EntityId fallbackId) {
    EntityDef e;
    e.id        = j.value("id", static_cast<uint32_t>(fallbackId));
    e.name      = j.value("name", std::string("Entity_") + std::to_string(fallbackId));
    e.className = j.value("className", j.value("class_name", std::string("Unknown")));
    if (j.contains("tags") && j["tags"].is_array())
        for (const auto& tag : j["tags"]) e.tags.push_back(tag.get<std::string>());
    if (j.contains("transform")) e.transform = parseTransform(j["transform"]);
    if (j.contains("sprite"))    e.sprite    = parseSprite(j["sprite"]);

    // -- Optional gameplay components (Phase D1) — names mirror the editor TS.
    if (j.contains("sensor") && j["sensor"].is_object()) {
        const auto& s = j["sensor"];
        SensorComponent sc;
        sc.shape     = s.value("shape", std::string("Circle"));
        sc.radius    = s.value("radius", 120.f);
        sc.width     = s.value("width", 64.f);
        sc.height    = s.value("height", 64.f);
        sc.targetTag = s.value("targetTag", std::string("player"));
        e.sensor = sc;
    }
    if (j.contains("platformerController") && j["platformerController"].is_object()) {
        const auto& p = j["platformerController"];
        PlatformerControllerComponent pc;
        pc.maxSpeed      = p.value("maxSpeed", 300.f);
        pc.jumpForce     = p.value("jumpForce", 600.f);
        pc.customGravity = p.value("customGravity", 1500.f);
        pc.coyoteTime    = p.value("coyoteTime", 0.15f);
        pc.jumpBuffer    = p.value("jumpBuffer", 0.1f);
        pc.groundClass   = p.value("groundClass", std::string("Ground"));
        e.platformerController = pc;
    }
    if (j.contains("topDownController") && j["topDownController"].is_object()) {
        const auto& t = j["topDownController"];
        TopDownControllerComponent tc;
        tc.maxSpeed       = t.value("maxSpeed", 260.f);
        tc.acceleration   = t.value("acceleration", 1600.f);
        tc.friction       = t.value("friction", 2200.f);
        tc.fourDirections = t.value("fourDirections", false);
        e.topDownController = tc;
    }
    if (j.contains("linearMover") && j["linearMover"].is_object()) {
        const auto& m = j["linearMover"];
        LinearMoverComponent lm;
        lm.directionX = m.value("directionX", 1.f);
        lm.directionY = m.value("directionY", 0.f);
        lm.speed      = m.value("speed", 300.f);
        e.linearMover = lm;
    }
    if (j.contains("cameraTarget") && j["cameraTarget"].is_object()) {
        const auto& c = j["cameraTarget"];
        CameraTargetComponent ct;
        ct.offsetX     = c.value("offsetX", 0.f);
        ct.offsetY     = c.value("offsetY", 0.f);
        ct.followSpeed = c.value("followSpeed", 8.f);
        e.cameraTarget = ct;
    }
    if (j.contains("magneticItem") && j["magneticItem"].is_object()) {
        const auto& m = j["magneticItem"];
        MagneticItemComponent mi;
        mi.attractTag = m.value("attractTag", std::string("pickup"));
        mi.radius     = m.value("radius", 200.f);
        mi.pullSpeed  = m.value("pullSpeed", 400.f);
        e.magneticItem = mi;
    }
    if (j.contains("hordeMember") && j["hordeMember"].is_object()) {
        const auto& h = j["hordeMember"];
        HordeMemberComponent hm;
        hm.targetClass      = h.value("targetClass", std::string("Player"));
        hm.maxSpeed         = h.value("maxSpeed", 120.f);
        hm.separationRadius = h.value("separationRadius", 48.f);
        hm.separationWeight = h.value("separationWeight", 1.5f);
        hm.chaseWeight      = h.value("chaseWeight", 1.f);
        e.hordeMember = hm;
    }
    if (j.contains("health") && j["health"].is_object()) {
        const auto& h = j["health"];
        HealthComponent hc;
        hc.maxHp     = h.value("maxHp", 100.f);
        hc.currentHp = h.value("currentHp", hc.maxHp);
        hc.iFrames   = h.value("iFrames", 0.2f);
        e.health = hc;
    }
    if (j.contains("autoDestroy") && j["autoDestroy"].is_object()) {
        AutoDestroyComponent ac;
        ac.lifespan = j["autoDestroy"].value("lifespan", 0.f);
        e.autoDestroy = ac;
    }
    return e;
}

SceneDef parseSceneDef(const json& j, const SceneId& fallbackId) {
    SceneDef s;
    s.id   = j.value("id",   fallbackId);
    s.name = j.value("name", fallbackId);
    if (j.contains("worldSize"))        s.worldSize       = parseVec2(j["worldSize"]);
    if (j.contains("world_size"))       s.worldSize       = parseVec2(j["world_size"]);
    if (j.contains("viewportSize"))     s.viewportSize    = parseVec2(j["viewportSize"]);
    if (j.contains("viewport_size"))    s.viewportSize    = parseVec2(j["viewport_size"]);
    if (j.contains("backgroundColor"))  s.backgroundColor = parseVec4(j["backgroundColor"]);
    if (j.contains("background_color")) s.backgroundColor = parseVec4(j["background_color"]);
    const json& eids = j.contains("entityIds") ? j["entityIds"]
                      : j.contains("entity_ids") ? j["entity_ids"] : json{};
    if (eids.is_array())
        for (const auto& id : eids) s.entityIds.push_back(id.get<EntityId>());
    if (j.contains("tilemap") && j["tilemap"].is_object()) {
        const auto& tm = j["tilemap"];
        s.tilemap.tileSize = tm.value("tileSize", 32.f);
        s.tilemap.cols     = tm.value("cols", 0);
        s.tilemap.rows     = tm.value("rows", 0);
        if (tm.contains("data") && tm["data"].is_array())
            s.tilemap.data = tm["data"].get<std::vector<int>>();
        s.tilemap.tilesetAssetId = tm.value("tilesetAssetId", std::string{});
    }
    return s;
}

TilesetAsset parseTilesetAsset(const json& j) {
    TilesetAsset t;
    t.assetId         = j.value("assetId",         j.value("asset_id", std::string{}));
    t.spriteImagePath = j.value("spriteImagePath", j.value("sprite_image_path", std::string{}));
    t.tileSize        = j.value("tileSize", j.value("tile_size", 32.f));
    t.margin          = j.value("margin", 0);
    t.cols            = j.value("cols", 1);
    t.rows            = j.value("rows", 1);
    return t;
}

std::unordered_map<EntityId, EntityDef>
parseEntities(const json& doc) {
    std::unordered_map<EntityId, EntityDef> entities;
    if (!doc.contains("entities")) return entities;
    const auto& ents = doc["entities"];
    if (ents.is_array()) {
        for (const auto& item : ents) {
            auto e = parseEntityDef(item, static_cast<EntityId>(entities.size() + 1));
            entities[e.id] = e;
        }
    } else if (ents.is_object()) {
        for (auto& [key, val] : ents.items()) {
            const EntityId fid = static_cast<EntityId>(std::stoul(key));
            auto e = parseEntityDef(val, fid);
            entities[e.id] = e;
        }
    }
    return entities;
}

std::unordered_map<SceneId, SceneDef>
parseScenes(const json& doc) {
    std::unordered_map<SceneId, SceneDef> scenes;
    if (!doc.contains("scenes")) return scenes;
    const auto& sc = doc["scenes"];
    if (sc.is_array()) {
        for (const auto& item : sc) {
            auto s = parseSceneDef(item, "scene_" + std::to_string(scenes.size()));
            scenes[s.id] = s;
        }
    } else if (sc.is_object()) {
        for (auto& [key, val] : sc.items()) {
            auto s = parseSceneDef(val, key);
            scenes[s.id] = s;
        }
    }
    return scenes;
}

std::vector<TilesetAsset>
parseTilesets(const json& doc) {
    std::vector<TilesetAsset> tilesets;
    if (!doc.contains("tilesets")) return tilesets;
    const auto& tsj = doc["tilesets"];
    if (tsj.is_array()) {
        for (const auto& item : tsj) tilesets.push_back(parseTilesetAsset(item));
    } else if (tsj.is_object()) {
        for (auto& [key, val] : tsj.items()) {
            auto t = parseTilesetAsset(val);
            if (t.assetId.empty()) t.assetId = key;
            tilesets.push_back(std::move(t));
        }
    }
    return tilesets;
}

std::vector<TilePaletteEntry>
parseTilePalette(const json& doc) {
    std::vector<TilePaletteEntry> out;
    if (!doc.contains("tilePalette") && !doc.contains("tile_palette"))
        return out;
    const auto& raw = doc.contains("tilePalette") ? doc["tilePalette"] : doc["tile_palette"];
    if (!raw.is_array()) return out;
    for (const auto& item : raw) {
        if (!item.is_object()) continue;
        TilePaletteEntry e;
        e.id    = item.value("id", 0);
        e.name  = item.value("name", std::string{});
        e.solid = item.value("solid", false);
        if (item.contains("color")) {
            if (item["color"].is_string()) {
                // Hex colours from the editor are display-only; use neutral grey.
                e.color = Vec4{0.5f, 0.5f, 0.5f, 1.f};
            } else {
                e.color = parseVec4(item["color"]);
            }
        }
        if (e.id > 0) out.push_back(std::move(e));
    }
    return out;
}

} // namespace ArtCade::ProjectDocParser

#endif // __EMSCRIPTEN__

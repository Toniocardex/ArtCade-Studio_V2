#include "project-doc-parser.h"
#include "object-type-materialize.h"
#include "physics-json.h"

#ifdef __EMSCRIPTEN__

#include <algorithm>
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

Vec3 parseVec3(const json& j) {
    Vec3 v{1.f, 1.f, 1.f};
    if (j.is_array() && j.size() >= 3) {
        v.x = j[0].get<float>();
        v.y = j[1].get<float>();
        v.z = j[2].get<float>();
    } else if (j.is_object()) {
        v.x = j.value("x", j.value("r", 1.f));
        v.y = j.value("y", j.value("g", 1.f));
        v.z = j.value("z", j.value("b", 1.f));
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
    if (j.contains("fillColor"))
        s.fillColor = parseVec3(j["fillColor"]);
    else
        s.fillColor = { s.tint.r, s.tint.g, s.tint.b };
    s.alpha       = j.value("alpha", 1.f);
    s.pivotFromAsset = j.value("pivotFromAsset", true);
    if (j.contains("pivot"))
        s.pivot = parseVec2(j["pivot"]);
    s.renderOrder = j.value("renderOrder", j.value("render_order", 0));
    if (j.contains("defaultClip"))
        s.defaultClip = j["defaultClip"].get<std::string>();
    else if (j.contains("default_clip"))
        s.defaultClip = j["default_clip"].get<std::string>();
    s.playClipOnSpawn = j.value("playClipOnSpawn", j.value("play_clip_on_spawn", false));
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

    ProjectJson::read_physics_component(j, e.physics);

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
    if (j.contains("solid") && j["solid"].is_object()) {
        const auto& s = j["solid"];
        SolidComponent solid;
        solid.groundClass  = s.value("groundClass", std::string("Ground"));
        solid.surfaceKind  = s.value("surfaceKind", std::string("solid"));
        e.solid = solid;
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
    if (j.contains("dialog") && j["dialog"].is_object()) {
        const auto& d = j["dialog"];
        DialogComponent dc;
        dc.dialogId       = d.value("dialogId", "");
        dc.startNode      = d.value("startNode", "");
        dc.textSpeed      = d.value("textSpeed", 40.f);
        dc.triggerMessage = d.value("triggerMessage", "");
        if (!dc.dialogId.empty())
            e.dialog = dc;
    }
    if (j.contains("visible") && j["visible"].is_boolean())
        e.visible = j["visible"].get<bool>();
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
    if (j.contains("instances") && j["instances"].is_array()) {
        for (const auto& item : j["instances"]) {
            if (!item.is_object()) continue;
            SceneInstanceDef inst;
            inst.id           = item.value("id", 0u);
            inst.objectTypeId = item.value("objectTypeId",
                                  item.value("object_type_id", std::string{}));
            inst.instanceName = item.value("instanceName",
                                  item.value("instance_name", std::string{}));
            if (item.contains("transform"))
                inst.transform = parseTransform(item["transform"]);
            if (item.contains("visible") && item["visible"].is_boolean())
                inst.visible = item["visible"].get<bool>();
            if (inst.id != 0 && !inst.objectTypeId.empty())
                s.instances.push_back(std::move(inst));
        }
    }
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
        e.groundClass = item.value("groundClass", std::string("Ground"));
        e.surfaceKind = item.value("surfaceKind", std::string("solid"));
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

std::unordered_map<std::string, EntityDef>
parseObjectTypes(const json& doc) {
    std::unordered_map<std::string, EntityDef> objectTypes;
    const json* raw = nullptr;
    if (doc.contains("objectTypes"))
        raw = &doc["objectTypes"];
    else if (doc.contains("object_types"))
        raw = &doc["object_types"];
    if (!raw || !raw->is_object()) return objectTypes;

    for (auto& [key, val] : raw->items()) {
        EntityDef e = parseEntityDef(val, 0);
        e.id = 0;
        e.className = val.value("id", key);
        e.name = val.value("displayName", val.value("display_name", e.className));
        objectTypes[e.className] = std::move(e);
    }
    return objectTypes;
}

void materializeV2Project(
    std::unordered_map<EntityId, EntityDef>& entities,
    std::unordered_map<SceneId, SceneDef>& scenes,
    const std::unordered_map<std::string, EntityDef>& objectTypes)
{
    if (objectTypes.empty()) return;
    const bool hasInstances = std::any_of(
        scenes.begin(), scenes.end(),
        [](const auto& kv) { return !kv.second.instances.empty(); });
    if (!hasInstances && !entities.empty()) return;

    ProjectDoc doc;
    doc.objectTypes = objectTypes;
    doc.scenes      = scenes;
    doc.entities    = entities;
    materializeProjectEntities(doc);
    entities = std::move(doc.entities);
    scenes   = std::move(doc.scenes);
}

std::vector<ImageAssetDef> parseImageAssets(const json& doc) {
    std::vector<ImageAssetDef> out;
    if (!doc.contains("assets") || !doc["assets"].is_object()) return out;
    for (auto& [key, av] : doc["assets"].items()) {
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
        if (av.contains("defaultPivot"))
            ad.defaultPivot = parseVec2(av["defaultPivot"]);
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
        out.push_back(std::move(ad));
    }
    return out;
}

ArtCade::ProjectRuntimeSettings parseRuntimeSettings(const json& doc) {
    ArtCade::ProjectRuntimeSettings s;
    if (doc.contains("targetFPS"))
        s.targetFPS = doc["targetFPS"].get<float>();
    else if (doc.contains("target_fps"))
        s.targetFPS = doc["target_fps"].get<float>();

    if (doc.contains("world") && doc["world"].is_object()) {
        const auto& wo = doc["world"];
        if (wo.contains("gravity"))
            s.gravity = wo["gravity"].get<float>();
        if (wo.contains("pixelsPerMeter"))
            s.pixelsPerMeter = wo["pixelsPerMeter"].get<float>();
        else if (wo.contains("pixels_per_meter"))
            s.pixelsPerMeter = wo["pixels_per_meter"].get<float>();
        if (wo.contains("timeScale"))
            s.timeScale = wo["timeScale"].get<float>();
        else if (wo.contains("time_scale"))
            s.timeScale = wo["time_scale"].get<float>();
        if (wo.contains("physicsDebugDraw"))
            s.physicsDebugDraw = wo["physicsDebugDraw"].get<bool>();
        const std::string mode = wo.value(
            "physicsMode",
            wo.value("physics_mode", std::string("auto")));
        if (mode == "off")
            s.physicsMode = ArtCade::PhysicsMode::Off;
        else if (mode == "on")
            s.physicsMode = ArtCade::PhysicsMode::On;
        else
            s.physicsMode = ArtCade::PhysicsMode::Auto;
    }
    return s;
}

} // namespace ArtCade::ProjectDocParser

#endif // __EMSCRIPTEN__

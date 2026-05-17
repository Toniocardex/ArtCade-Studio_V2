#include "../include/editor-api.h"

// =============================================================================
// Native build: static member definitions only (all methods are no-ops in .h)
// =============================================================================
#ifndef __EMSCRIPTEN__

namespace ArtCade {
int      EditorAPI::s_mode             = 0;
uint32_t EditorAPI::s_selectedEntityId = 0u;
bool     EditorAPI::s_isDragging       = false;
float    EditorAPI::s_dragStartX       = 0.f;
float    EditorAPI::s_dragStartY       = 0.f;
Modules::RuntimeEntityGateway* EditorAPI::s_entityGateway = nullptr;
Modules::LuaHost*              EditorAPI::s_luaHost       = nullptr;
} // namespace ArtCade

#else // __EMSCRIPTEN__ ─────────────────────────────────────────────────────────

// =============================================================================
// WASM implementation
// =============================================================================

#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/lua-runtime/include/lua-host.h"
#include "../../../core/types.h"

// nlohmann/json is available via artcade-core's include path
#include <nlohmann/json.hpp>

#include <cstring>
#include <cstdio>
#include <string>
#include <utility>
#include <vector>

using json = nlohmann::json;

namespace ArtCade {

// ── Static state ──────────────────────────────────────────────────────────────
int      EditorAPI::s_mode             = 0;
uint32_t EditorAPI::s_selectedEntityId = 0u;
bool     EditorAPI::s_isDragging       = false;
float    EditorAPI::s_dragStartX       = 0.f;
float    EditorAPI::s_dragStartY       = 0.f;

Modules::RuntimeEntityGateway* EditorAPI::s_entityGateway = nullptr;
Modules::LuaHost*              EditorAPI::s_luaHost       = nullptr;
std::vector<std::pair<std::string, std::string>> EditorAPI::s_consoleQueue;

// ── Engine wiring ─────────────────────────────────────────────────────────────
void EditorAPI::wireEngine(Modules::RuntimeEntityGateway* gateway) {
    s_entityGateway = gateway;
    notifyConsoleLine("[EditorAPI] Engine wired to RuntimeEntityGateway.", "info");
}

void EditorAPI::wireLua(Modules::LuaHost* luaHost) {
    s_luaHost = luaHost;
    notifyConsoleLine("[EditorAPI] Engine wired to LuaHost (hot-reload ready).", "info");
}

// ── Init / Shutdown ───────────────────────────────────────────────────────────
void EditorAPI::init(const char* canvasSelector) {
    // Smoke Test 2: register native callbacks -- bypasses JS event loop entirely.
    emscripten_set_mousemove_callback(canvasSelector, nullptr, 1, onMouseMove);
    emscripten_set_mousedown_callback(canvasSelector, nullptr, 1, onMouseDown);
    emscripten_set_mouseup_callback  (canvasSelector, nullptr, 1, onMouseUp  );
    emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, onKeyDown);
    emscripten_set_keyup_callback  (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, onKeyUp  );

    notifyConsoleLine("[EditorAPI] Bridge initialised -- native input active.", "info");
}

void EditorAPI::shutdown() {
    emscripten_set_mousemove_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_mousedown_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_mouseup_callback  (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_keydown_callback  (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
    emscripten_set_keyup_callback    (EMSCRIPTEN_EVENT_TARGET_WINDOW, nullptr, 1, nullptr);
}

// ── Native input callbacks (Smoke Test 2) ─────────────────────────────────────

EM_BOOL EditorAPI::onMouseMove(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    if (s_isDragging && s_selectedEntityId != 0u) {
        // Live drag -- update entity position in EntityManager
        if (s_entityGateway) {
            EntityDef* ent = s_entityGateway->get(s_selectedEntityId);
            if (ent) {
                ent->transform.position.x = static_cast<float>(e->targetX);
                ent->transform.position.y = static_cast<float>(e->targetY);
            }
        }
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onMouseDown(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    s_isDragging = true;
    s_dragStartX = static_cast<float>(e->targetX);
    s_dragStartY = static_cast<float>(e->targetY);
    return EM_TRUE;
}

// Smoke Test 3: notify React with FINAL coordinates only on mouse-up.
EM_BOOL EditorAPI::onMouseUp(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    s_isDragging = false;

    if (s_selectedEntityId != 0u) {
        const float finalX = static_cast<float>(e->targetX);
        const float finalY = static_cast<float>(e->targetY);
        notifyTransformChanged(s_selectedEntityId, finalX, finalY, 0.f, 1.f, 1.f);
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onKeyDown(int, const EmscriptenKeyboardEvent*, void*) {
    if (s_mode != 0) return EM_FALSE;
    return EM_FALSE; // don't consume -- let browser handle F5, tab, etc.
}

EM_BOOL EditorAPI::onKeyUp(int, const EmscriptenKeyboardEvent*, void*) {
    return EM_FALSE;
}

// ── C++ -> React notifications (Smoke Test 3) ─────────────────────────────────
// EM_ASM calls window.on* globals that wasm-bridge.ts sets BEFORE game.js loads.

void EditorAPI::notifyEntitySelected(uint32_t entityId) {
    EM_ASM({
        if (typeof window.onEntitySelected === 'function')
            window.onEntitySelected($0);
    }, static_cast<int>(entityId));
}

void EditorAPI::notifyTransformChanged(uint32_t entityId,
    float x, float y, float rotation, float scaleX, float scaleY)
{
    EM_ASM({
        if (typeof window.onEntityTransformChanged === 'function')
            window.onEntityTransformChanged($0, $1, $2, $3, $4, $5);
    }, static_cast<int>(entityId), x, y, rotation, scaleX, scaleY);
}

void EditorAPI::notifyConsoleLine(const char* message, const char* level) {
    EM_ASM({
        var msg = UTF8ToString($0);
        var lvl = UTF8ToString($1);
        if (typeof window.onConsoleLine === 'function')
            window.onConsoleLine(msg, lvl);
    }, message, level);
}

void EditorAPI::queueConsoleLine(const char* message, const char* level) {
    s_consoleQueue.emplace_back(message ? message : "", level ? level : "info");
}

void EditorAPI::flushConsoleLines() {
    for (const auto& [message, level] : s_consoleQueue)
        notifyConsoleLine(message.c_str(), level.c_str());
    s_consoleQueue.clear();
}

} // namespace ArtCade

// =============================================================================
// React -> C++ exported commands (Smoke Test 4)
// =============================================================================

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

static ArtCade::Vec2 parseVec2(const json& j) {
    ArtCade::Vec2 v;
    if (j.is_array() && j.size() >= 2) {
        v.x = j[0].get<float>();
        v.y = j[1].get<float>();
    } else if (j.is_object()) {
        v.x = j.value("x", 0.f);
        v.y = j.value("y", 0.f);
    }
    return v;
}

static ArtCade::Vec4 parseVec4(const json& j) {
    ArtCade::Vec4 v{1.f,1.f,1.f,1.f};
    if (j.is_array() && j.size() >= 4) {
        v.r = j[0].get<float>();
        v.g = j[1].get<float>();
        v.b = j[2].get<float>();
        v.a = j[3].get<float>();
    } else if (j.is_object()) {
        // Accept both {r,g,b,a} (C++ serialiser) and {x,y,z,w} (TypeScript)
        v.r = j.contains("r") ? j["r"].get<float>() : j.value("x", 1.f);
        v.g = j.contains("g") ? j["g"].get<float>() : j.value("y", 1.f);
        v.b = j.contains("b") ? j["b"].get<float>() : j.value("z", 1.f);
        v.a = j.contains("a") ? j["a"].get<float>() : j.value("w", 1.f);
    }
    return v;
}

static ArtCade::Transform parseTransform(const json& j) {
    ArtCade::Transform t;
    if (!j.is_object()) return t;
    if (j.contains("position")) t.position = parseVec2(j["position"]);
    if (j.contains("scale"))    t.scale    = parseVec2(j["scale"]);
    t.rotation = j.value("rotation", 0.f);
    return t;
}

static ArtCade::SpriteComponent parseSprite(const json& j) {
    ArtCade::SpriteComponent s;
    if (!j.is_object()) return s;
    s.spriteAssetId = j.value("spriteAssetId", j.value("sprite_asset_id", std::string{}));
    if (j.contains("tint"))  s.tint  = parseVec4(j["tint"]);
    s.alpha       = j.value("alpha", 1.f);
    if (j.contains("pivot")) s.pivot = parseVec2(j["pivot"]);
    s.renderOrder = j.value("renderOrder", j.value("render_order", 0));
    return s;
}

static ArtCade::EntityDef parseEntityDef(const json& j, ArtCade::EntityId fallbackId) {
    ArtCade::EntityDef e;
    e.id        = j.value("id", static_cast<uint32_t>(fallbackId));
    e.name      = j.value("name", std::string("Entity_") + std::to_string(fallbackId));
    e.className = j.value("className", j.value("class_name", std::string("Unknown")));
    if (j.contains("tags") && j["tags"].is_array())
        for (const auto& tag : j["tags"]) e.tags.push_back(tag.get<std::string>());
    if (j.contains("transform")) e.transform = parseTransform(j["transform"]);
    if (j.contains("sprite"))    e.sprite    = parseSprite(j["sprite"]);

    // ── Optional gameplay components (Phase D1) — names mirror editor TS ──
    if (j.contains("sensor") && j["sensor"].is_object()) {
        const auto& s = j["sensor"];
        ArtCade::SensorComponent sc;
        sc.shape     = s.value("shape", std::string("Circle"));
        sc.radius    = s.value("radius", 120.f);
        sc.width     = s.value("width", 64.f);
        sc.height    = s.value("height", 64.f);
        sc.targetTag = s.value("targetTag", std::string("player"));
        e.sensor = sc;
    }
    if (j.contains("platformerController") && j["platformerController"].is_object()) {
        const auto& p = j["platformerController"];
        ArtCade::PlatformerControllerComponent pc;
        pc.maxSpeed      = p.value("maxSpeed", 300.f);
        pc.jumpForce     = p.value("jumpForce", 600.f);
        pc.customGravity = p.value("customGravity", 1500.f);
        pc.coyoteTime    = p.value("coyoteTime", 0.15f);
        pc.jumpBuffer    = p.value("jumpBuffer", 0.1f);
        e.platformerController = pc;
    }
    if (j.contains("health") && j["health"].is_object()) {
        const auto& h = j["health"];
        ArtCade::HealthComponent hc;
        hc.maxHp     = h.value("maxHp", 100.f);
        hc.currentHp = h.value("currentHp", hc.maxHp);
        hc.iFrames   = h.value("iFrames", 0.2f);
        e.health = hc;
    }
    if (j.contains("autoDestroy") && j["autoDestroy"].is_object()) {
        ArtCade::AutoDestroyComponent ac;
        ac.lifespan = j["autoDestroy"].value("lifespan", 0.f);
        e.autoDestroy = ac;
    }
    return e;
}

static ArtCade::SceneDef parseSceneDef(const json& j, const ArtCade::SceneId& fallbackId) {
    ArtCade::SceneDef s;
    s.id   = j.value("id",   fallbackId);
    s.name = j.value("name", fallbackId);
    if (j.contains("worldSize"))       s.worldSize       = parseVec2(j["worldSize"]);
    if (j.contains("world_size"))      s.worldSize       = parseVec2(j["world_size"]);
    if (j.contains("viewportSize"))    s.viewportSize    = parseVec2(j["viewportSize"]);
    if (j.contains("viewport_size"))   s.viewportSize    = parseVec2(j["viewport_size"]);
    if (j.contains("backgroundColor")) s.backgroundColor = parseVec4(j["backgroundColor"]);
    if (j.contains("background_color"))s.backgroundColor = parseVec4(j["background_color"]);
    // entityIds: array of numbers
    const json& eids = j.contains("entityIds") ? j["entityIds"]
                      : j.contains("entity_ids") ? j["entity_ids"] : json{};
    if (eids.is_array())
        for (const auto& id : eids) s.entityIds.push_back(id.get<ArtCade::EntityId>());
    return s;
}

extern "C" {

EMSCRIPTEN_KEEPALIVE void editor_set_mode(int mode) {
    ArtCade::EditorAPI::s_mode = mode;
    ArtCade::EditorAPI::notifyConsoleLine(
        mode == 0 ? "[EditorAPI] Mode: EDIT" : "[EditorAPI] Mode: PLAY", "info");
}

EMSCRIPTEN_KEEPALIVE void editor_select_entity(uint32_t entityId) {
    ArtCade::EditorAPI::s_selectedEntityId = entityId;
    // Notify renderer to draw selection gizmo (future: call renderer API)
}

EMSCRIPTEN_KEEPALIVE void editor_deselect() {
    ArtCade::EditorAPI::s_selectedEntityId = 0u;
}

EMSCRIPTEN_KEEPALIVE void editor_load_project(const char* json_utf8) {
    if (!json_utf8 || !*json_utf8) {
        ArtCade::EditorAPI::notifyConsoleLine("[EditorAPI] editor_load_project: empty JSON.", "warn");
        return;
    }
    auto* gateway = ArtCade::EditorAPI::s_entityGateway;
    if (!gateway) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_load_project: engine not wired yet.", "warn");
        return;
    }

    try {
        const json doc = json::parse(json_utf8);

        // ── Parse entities ────────────────────────────────────────────────────
        std::unordered_map<ArtCade::EntityId, ArtCade::EntityDef> entityDefs;
        if (doc.contains("entities")) {
            const auto& ents = doc["entities"];
            if (ents.is_array()) {
                for (const auto& item : ents) {
                    auto e = parseEntityDef(item, static_cast<ArtCade::EntityId>(entityDefs.size() + 1));
                    entityDefs[e.id] = e;
                }
            } else if (ents.is_object()) {
                for (auto& [key, val] : ents.items()) {
                    ArtCade::EntityId fid = static_cast<ArtCade::EntityId>(std::stoul(key));
                    auto e = parseEntityDef(val, fid);
                    entityDefs[e.id] = e;
                }
            }
        }

        // ── Parse scenes ──────────────────────────────────────────────────────
        std::unordered_map<ArtCade::SceneId, ArtCade::SceneDef> sceneDefs;
        if (doc.contains("scenes")) {
            const auto& scenes = doc["scenes"];
            if (scenes.is_array()) {
                for (const auto& item : scenes) {
                    auto sc = parseSceneDef(item, "scene_" + std::to_string(sceneDefs.size()));
                    sceneDefs[sc.id] = sc;
                }
            } else if (scenes.is_object()) {
                for (auto& [key, val] : scenes.items()) {
                    auto sc = parseSceneDef(val, key);
                    sceneDefs[sc.id] = sc;
                }
            }
        }

        // ── Push into engine ──────────────────────────────────────────────────
        // Activate the first (or specified) scene
        std::string activeId = doc.value("activeSceneId",
                               doc.value("active_scene_id", std::string{}));
        if (activeId.empty() && !sceneDefs.empty())
            activeId = sceneDefs.begin()->first;
        gateway->replaceProject(sceneDefs, entityDefs, activeId);

        char buf[128];
        std::snprintf(buf, sizeof(buf),
            "[EditorAPI] Project loaded: %zu entities, %zu scenes.",
            entityDefs.size(), sceneDefs.size());
        ArtCade::EditorAPI::notifyConsoleLine(buf, "info");

    } catch (const std::exception& ex) {
        char buf[256];
        std::snprintf(buf, sizeof(buf), "[EditorAPI] JSON parse error: %s", ex.what());
        ArtCade::EditorAPI::notifyConsoleLine(buf, "error");
    }
}

EMSCRIPTEN_KEEPALIVE void editor_set_transform(
    uint32_t entityId,
    float x,      float y,
    float rotation,
    float scaleX, float scaleY)
{
    auto* gateway = ArtCade::EditorAPI::s_entityGateway;
    if (!gateway) return;
    if (!gateway->setTransform(entityId, {x, y}, rotation, {scaleX, scaleY})) return;
    // Notify React so Inspector stays in sync
    ArtCade::EditorAPI::notifyTransformChanged(entityId, x, y, rotation, scaleX, scaleY);
}

EMSCRIPTEN_KEEPALIVE void editor_reload_script(const char* lua_utf8) {
    if (!lua_utf8 || !*lua_utf8) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_reload_script: empty source.", "warn");
        return;
    }
    auto* host = ArtCade::EditorAPI::s_luaHost;
    if (!host) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_reload_script: LuaHost not wired yet.", "warn");
        return;
    }

    if (host->loadLuaSource(lua_utf8)) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] Logic Board hot-reloaded ✓", "info");
    } else {
        std::string msg =
            "[EditorAPI] Hot-reload failed: " + host->lastError();
        ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "error");
    }
}

} // extern "C"

#endif // __EMSCRIPTEN__

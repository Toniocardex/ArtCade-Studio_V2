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
bool     EditorAPI::s_tilePaintMode    = false;
int      EditorAPI::s_selectedTileId   = 1;
int      EditorAPI::s_editorTool       = 0;
bool     EditorAPI::s_editorGuidesEnabled = true;
Modules::RuntimeEntityGateway* EditorAPI::s_entityGateway = nullptr;
Modules::LuaHost*              EditorAPI::s_luaHost       = nullptr;
Modules::Renderer*             EditorAPI::s_renderer      = nullptr;
} // namespace ArtCade

#else // __EMSCRIPTEN__ ─────────────────────────────────────────────────────────

// =============================================================================
// WASM implementation
// =============================================================================

#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/lua-runtime/include/lua-host.h"
#include "../../../modules/renderer/include/renderer.h"
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

enum EditorToolId {
    ToolSelect = 0,
    ToolPan    = 1,
    ToolPaint  = 2,
    ToolErase  = 3,
};

static bool isPaintTool(int tool) {
    return tool == ToolPaint || tool == ToolErase;
}

// ── Static state ──────────────────────────────────────────────────────────────
int      EditorAPI::s_mode             = 0;
uint32_t EditorAPI::s_selectedEntityId = 0u;
bool     EditorAPI::s_isDragging       = false;
float    EditorAPI::s_dragStartX       = 0.f;
float    EditorAPI::s_dragStartY       = 0.f;
bool     EditorAPI::s_tilePaintMode    = false;
int      EditorAPI::s_selectedTileId   = 1;
int      EditorAPI::s_editorTool       = 0;
bool     EditorAPI::s_editorGuidesEnabled = true;

Modules::RuntimeEntityGateway* EditorAPI::s_entityGateway = nullptr;
Modules::LuaHost*              EditorAPI::s_luaHost       = nullptr;
Modules::Renderer*             EditorAPI::s_renderer      = nullptr;
std::vector<std::pair<std::string, std::string>> EditorAPI::s_consoleQueue;

// Canvas selector captured in init(); used to map CSS mouse coords → world px.
static std::string s_canvasSel = "#canvas";
static float s_lastPanScreenX = 0.f;
static float s_lastPanScreenY = 0.f;

// EmscriptenMouseEvent.targetX/Y are in CSS pixels of the (scaled) canvas
// element, but the world/tilemap is in the canvas' internal resolution
// (e.g. 1280x720). Without this scale the painted cell / dragged entity is
// offset proportionally to the CSS downscale factor.
static void toScreen(const EmscriptenMouseEvent* e, float& sxOut, float& syOut) {
    double cssW = 0.0, cssH = 0.0;
    int    iw   = 0,   ih   = 0;
    emscripten_get_element_css_size (s_canvasSel.c_str(), &cssW, &cssH);
    emscripten_get_canvas_element_size(s_canvasSel.c_str(), &iw,  &ih);
    const float sx = (cssW > 0.0) ? static_cast<float>(iw / cssW) : 1.f;
    const float sy = (cssH > 0.0) ? static_cast<float>(ih / cssH) : 1.f;
    sxOut = static_cast<float>(e->targetX) * sx;
    syOut = static_cast<float>(e->targetY) * sy;
}

static void toWorld(const EmscriptenMouseEvent* e, float& wx, float& wy) {
    float screenX = 0.f, screenY = 0.f;
    toScreen(e, screenX, screenY);
    if (EditorAPI::s_renderer) {
        const ArtCade::Vec2 world = EditorAPI::s_renderer->screenToWorld(screenX, screenY);
        wx = world.x;
        wy = world.y;
    } else {
        wx = screenX;
        wy = screenY;
    }
}

// ── Engine wiring ─────────────────────────────────────────────────────────────
void EditorAPI::wireEngine(Modules::RuntimeEntityGateway* gateway) {
    s_entityGateway = gateway;
    if (gateway) {
        gateway->setSpawnLogCallback([](const std::string& msg) {
            EditorAPI::queueConsoleLine(msg.c_str(), "info");
        });
    }
    notifyConsoleLine("[EditorAPI] Engine wired to RuntimeEntityGateway.", "info");
}

void EditorAPI::wireLua(Modules::LuaHost* luaHost) {
    s_luaHost = luaHost;
    notifyConsoleLine("[EditorAPI] Engine wired to LuaHost (hot-reload ready).", "info");
}

void EditorAPI::wireRenderer(Modules::Renderer* renderer) {
    s_renderer = renderer;
    notifyConsoleLine("[EditorAPI] Engine wired to Renderer (image upload ready).", "info");
}

// ── Init / Shutdown ───────────────────────────────────────────────────────────
void EditorAPI::init(const char* canvasSelector) {
    if (canvasSelector && *canvasSelector) s_canvasSel = canvasSelector;
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

// Phase F2: paint the brush tile into the active scene's tilemap cell
// under (x,y). Assumes canvas==world 1:1 (no pan/zoom — like entity drag).
static void paintTileAt(float x, float y) {
    auto* gw = EditorAPI::s_entityGateway;
    if (!gw) return;
    ArtCade::SceneDef* sc = gw->activeSceneMutable();
    if (!sc) return;
    ArtCade::TilemapData& tm = sc->tilemap;
    if (tm.cols <= 0 || tm.rows <= 0 || tm.tileSize <= 0.f) return;
    const int col = static_cast<int>(x / tm.tileSize);
    const int row = static_cast<int>(y / tm.tileSize);
    if (col < 0 || col >= tm.cols || row < 0 || row >= tm.rows) return;
    const int idx = row * tm.cols + col;
    if (idx < 0 || idx >= static_cast<int>(tm.data.size())) return;
    const int tid = EditorAPI::s_selectedTileId;
    if (tm.data[idx] == tid) return;          // no-op: already that tile
    tm.data[idx] = tid;
    EditorAPI::notifyTilemapPainted(col, row, tid);
}

// Pick the top-most entity whose clickable box contains the world point.
// Entities are drawn centred on transform.position; we use a generous
// 64px (×scale) hit box so they're easy to grab in the editor viewport.
static uint32_t pickEntityAt(float x, float y) {
    auto* gw = EditorAPI::s_entityGateway;
    if (!gw) return 0u;
    uint32_t hit = 0u;
    for (ArtCade::EntityId id : gw->activeSceneIds()) {
        const ArtCade::EntityDef* e = gw->get(id);
        if (!e) continue;
        float sx = e->transform.scale.x; if (sx < 0.f) sx = -sx;
        float sy = e->transform.scale.y; if (sy < 0.f) sy = -sy;
        const float hw = 32.f * (sx > 0.f ? sx : 1.f);
        const float hh = 32.f * (sy > 0.f ? sy : 1.f);
        const float cx = e->transform.position.x;
        const float cy = e->transform.position.y;
        if (x >= cx - hw && x <= cx + hw && y >= cy - hh && y <= cy + hh)
            hit = id;   // later in the list = drawn on top → wins
    }
    return hit;
}

EM_BOOL EditorAPI::onMouseMove(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    if (s_editorTool == ToolPan && s_isDragging) {
        float sx = 0.f, sy = 0.f;
        toScreen(e, sx, sy);
        if (s_renderer)
            s_renderer->panCameraByScreenDelta(sx - s_lastPanScreenX, sy - s_lastPanScreenY);
        s_lastPanScreenX = sx;
        s_lastPanScreenY = sy;
        return EM_TRUE;
    }
    float wx, wy;
    toWorld(e, wx, wy);
    if (s_tilePaintMode) {
        if (s_isDragging)
            paintTileAt(wx, wy);
        return EM_TRUE;
    }
    if (s_isDragging && s_selectedEntityId != 0u) {
        // Live drag -- update entity position in EntityManager
        if (s_entityGateway) {
            EntityDef* ent = s_entityGateway->get(s_selectedEntityId);
            if (ent) {
                ent->transform.position.x = wx;
                ent->transform.position.y = wy;
            }
        }
    }
    return EM_TRUE;
}

EM_BOOL EditorAPI::onMouseDown(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    s_isDragging = true;
    toScreen(e, s_lastPanScreenX, s_lastPanScreenY);
    if (s_editorTool == ToolPan)
        return EM_TRUE;
    float wx, wy;
    toWorld(e, wx, wy);
    s_dragStartX = wx;
    s_dragStartY = wy;
    if (s_tilePaintMode) {
        paintTileAt(s_dragStartX, s_dragStartY);   // single click paints too
        return EM_TRUE;
    }
    // Click-to-select: pick the entity under the cursor on the canvas so the
    // user doesn't have to go through the Hierarchy panel. A hit also makes
    // it the live-drag target (onMouseMove drags s_selectedEntityId).
    const uint32_t picked = pickEntityAt(wx, wy);
    if (picked != 0u) {
        s_selectedEntityId = picked;
        notifyEntitySelected(picked);
    }
    return EM_TRUE;
}

// Smoke Test 3: notify React with FINAL coordinates only on mouse-up.
EM_BOOL EditorAPI::onMouseUp(int, const EmscriptenMouseEvent* e, void*) {
    if (s_mode != 0) return EM_FALSE;
    s_isDragging = false;
    if (s_editorTool == ToolPan) return EM_TRUE;   // panning: no transform notify
    if (s_tilePaintMode) return EM_TRUE;   // painting: no transform notify

    if (s_selectedEntityId != 0u) {
        float finalX, finalY;
        toWorld(e, finalX, finalY);
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

void EditorAPI::notifyTilemapPainted(int col, int row, int tileId) {
    EM_ASM({
        if (typeof window.onTilemapPainted === 'function')
            window.onTilemapPainted($0, $1, $2);
    }, col, row, tileId);
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
        pc.groundClass   = p.value("groundClass", std::string("Ground"));
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

static ArtCade::TilesetAsset parseTilesetAsset(const json& j) {
    ArtCade::TilesetAsset t;
    t.assetId         = j.value("assetId",         j.value("asset_id", std::string{}));
    t.spriteImagePath = j.value("spriteImagePath", j.value("sprite_image_path", std::string{}));
    t.tileSize        = j.value("tileSize", j.value("tile_size", 32.f));
    t.margin          = j.value("margin", 0);
    t.cols            = j.value("cols", 1);
    t.rows            = j.value("rows", 1);
    return t;
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

EMSCRIPTEN_KEEPALIVE void editor_set_tile_paint_mode(int enabled) {
    ArtCade::EditorAPI::s_tilePaintMode = (enabled != 0);
}

EMSCRIPTEN_KEEPALIVE void editor_set_selected_tile(int tileId) {
    ArtCade::EditorAPI::s_selectedTileId = tileId;
}

EMSCRIPTEN_KEEPALIVE void editor_set_tool(int toolId) {
    if (toolId < ArtCade::ToolSelect || toolId > ArtCade::ToolErase)
        toolId = ArtCade::ToolSelect;
    ArtCade::EditorAPI::s_editorTool = toolId;
    ArtCade::EditorAPI::s_tilePaintMode = ArtCade::isPaintTool(toolId);
}

EMSCRIPTEN_KEEPALIVE void editor_set_guides_enabled(int enabled) {
    ArtCade::EditorAPI::s_editorGuidesEnabled = (enabled != 0);
}

EMSCRIPTEN_KEEPALIVE void editor_register_image(
    const char* path, const uint8_t* bytes, int len, const char* ext) {
    if (!path || !*path || !bytes || len <= 0) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_register_image: invalid arguments.", "warn");
        return;
    }
    auto* r = ArtCade::EditorAPI::s_renderer;
    if (!r) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_register_image: Renderer not wired yet.", "warn");
        return;
    }
    const std::string fileExt = (ext && *ext) ? ext : ".png";
    const bool ok = r->registerImageFromMemory(
        path, reinterpret_cast<const unsigned char*>(bytes), len, fileExt);
    if (ok) {
        std::string msg = "[EditorAPI] Tileset image uploaded: ";
        msg += path;
        ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "info");
    } else {
        std::string msg = "[EditorAPI] Failed to decode image: ";
        msg += path;
        ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "error");
    }
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
        ArtCade::Vec2 gameResolution{1280.f, 720.f};
        if (doc.contains("gameResolution"))      gameResolution = parseVec2(doc["gameResolution"]);
        if (doc.contains("game_resolution"))     gameResolution = parseVec2(doc["game_resolution"]);

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

        // ── Parse tilesets (Phase F3) ─────────────────────────────────────────
        std::vector<ArtCade::TilesetAsset> tilesets;
        if (doc.contains("tilesets")) {
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
        }

        // ── Push into engine ──────────────────────────────────────────────────
        // Activate the first (or specified) scene
        std::string activeId = doc.value("activeSceneId",
                               doc.value("active_scene_id", std::string{}));
        if (activeId.empty() && !sceneDefs.empty())
            activeId = sceneDefs.begin()->first;
        gateway->replaceProject(sceneDefs, entityDefs, activeId);
        gateway->setTilesets(std::move(tilesets));
        if (auto* renderer = ArtCade::EditorAPI::s_renderer) {
            if (gameResolution.x > 0.f && gameResolution.y > 0.f) {
                renderer->setWindowSize(
                    static_cast<uint32_t>(gameResolution.x),
                    static_cast<uint32_t>(gameResolution.y),
                    "ArtCade V2");
            }
            if (const ArtCade::SceneDef* sc = gateway->activeScene()) {
                renderer->setSceneViewport(sc->worldSize, sc->viewportSize);
            }
        }

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

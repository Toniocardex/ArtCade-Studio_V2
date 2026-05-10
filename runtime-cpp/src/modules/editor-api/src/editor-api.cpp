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
} // namespace ArtCade

#else // __EMSCRIPTEN__ ─────────────────────────────────────────────────────────

// =============================================================================
// WASM implementation
// =============================================================================

#include "../../../modules/entity-system/include/entity-manager.h"
#include "../../../modules/scene-system/include/scene-manager.h"
#include "../../../core/types.h"

// nlohmann/json is available via artcade-core's include path
#include <nlohmann/json.hpp>

#include <cstring>
#include <cstdio>

using json = nlohmann::json;

namespace ArtCade {

// ── Static state ──────────────────────────────────────────────────────────────
int      EditorAPI::s_mode             = 0;
uint32_t EditorAPI::s_selectedEntityId = 0u;
bool     EditorAPI::s_isDragging       = false;
float    EditorAPI::s_dragStartX       = 0.f;
float    EditorAPI::s_dragStartY       = 0.f;

Modules::EntityManager* EditorAPI::s_entityManager = nullptr;
Modules::SceneManager*  EditorAPI::s_sceneManager  = nullptr;

// ── Engine wiring ─────────────────────────────────────────────────────────────
void EditorAPI::wireEngine(Modules::EntityManager* em, Modules::SceneManager* sm) {
    s_entityManager = em;
    s_sceneManager  = sm;
    notifyConsoleLine("[EditorAPI] Engine wired to EntityManager + SceneManager.", "info");
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
        if (s_entityManager) {
            EntityDef* ent = s_entityManager->get(s_selectedEntityId);
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
    auto* em = ArtCade::EditorAPI::s_entityManager;
    auto* sm = ArtCade::EditorAPI::s_sceneManager;
    if (!em || !sm) {
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
        sm->registerScenes(sceneDefs, entityDefs);

        // Activate the first (or specified) scene
        std::string activeId = doc.value("activeSceneId",
                               doc.value("active_scene_id", std::string{}));
        if (activeId.empty() && !sceneDefs.empty())
            activeId = sceneDefs.begin()->first;
        if (!activeId.empty()) sm->loadScene(activeId);

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
    auto* em = ArtCade::EditorAPI::s_entityManager;
    if (!em) return;
    ArtCade::EntityDef* ent = em->get(entityId);
    if (!ent) return;
    ent->transform.position.x = x;
    ent->transform.position.y = y;
    ent->transform.rotation   = rotation;
    ent->transform.scale.x    = scaleX;
    ent->transform.scale.y    = scaleY;
    // Notify React so Inspector stays in sync
    ArtCade::EditorAPI::notifyTransformChanged(entityId, x, y, rotation, scaleX, scaleY);
}

} // extern "C"

#endif // __EMSCRIPTEN__

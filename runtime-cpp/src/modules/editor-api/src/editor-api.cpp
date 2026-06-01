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
float    EditorAPI::s_editorGridSize   = 32.f;
bool     EditorAPI::s_editorSnapEnabled = false;
bool     EditorAPI::s_physicsDebugDraw  = false;
Modules::RuntimeEntityGateway* EditorAPI::s_entityGateway = nullptr;
Modules::LuaHost*              EditorAPI::s_luaHost       = nullptr;
Modules::Renderer*             EditorAPI::s_renderer      = nullptr;
Modules::DialogManager*        EditorAPI::s_dialogManager = nullptr;
Modules::SpriteAnimator*       EditorAPI::s_spriteAnimator = nullptr;
Modules::Audio*                EditorAPI::s_audio = nullptr;
EditorProjectLoadedHandler     EditorAPI::s_onProjectLoaded{};
EditorPreviewRestoreHandler    EditorAPI::s_onPreviewRestore{};
EditorEnterPlayHandler         EditorAPI::s_onEnterPlay{};
EditorExitPlayHandler          EditorAPI::s_onExitPlay{};
std::vector<std::pair<std::string, std::string>> EditorAPI::s_consoleQueue;

} // namespace ArtCade

#else // __EMSCRIPTEN__ ─────────────────────────────────────────────────────────

// =============================================================================
// WASM implementation
//
// Phase 5 split (docs/TECHNICAL_DEBT_REVIEW.md): this translation unit now
// only owns the static state, wiring, notifications and the
// EMSCRIPTEN_KEEPALIVE exports.
//
//  • editor-input-controller.cpp owns the native mouse + tile painting code
//    (paintTileAt / pickEntityAt / on{Mouse,Key}* callbacks).
//  • project-doc-parser.cpp turns the JSON blob from editor_load_project()
//    into EntityDef / SceneDef / TilesetAsset.
// =============================================================================

// editor-api intentionally does NOT include app.h. Project-loaded behaviour
// is delivered through a callback registered by Application via
// setProjectLoadedHandler(). Keeping this TU free of app.h removes a major
// circular dependency hazard and unblocks future module splits.
#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/lua-runtime/include/lua-host.h"
#include "../../../modules/renderer/include/renderer.h"
#include "../../../modules/dialog/include/dialog-manager.h"
#include "../../../modules/dialog/include/dialog-parser.h"
#include "../../../modules/sprite-animator/include/sprite-animator.h"
#include "../../../modules/sprite-animator/include/animation-clips-registry.h"
#include "../../../modules/audio/include/audio.h"
#include "../../../modules/asset-system/include/asset-manifest-index.h"
#include "../../../core/types.h"

#include "editor-input-controller.h"
#include "editor-spritesheet-preview.h"
#include "project-doc-parser.h"

#include <nlohmann/json.hpp>

#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

using json = nlohmann::json;

namespace {

ArtCade::Modules::AssetManifestIndex s_editorAssetManifest;

std::string resolveImageLoadKeyFromDoc(const json& doc, const std::string& raw) {
    if (raw.empty()) return {};
    if (doc.contains("assets") && doc["assets"].is_object()) {
        if (doc["assets"].contains(raw)) {
            const auto& av = doc["assets"][raw];
            if (av.is_object()) {
                const std::string p = av.value("path", std::string{});
                if (!p.empty()) return p;
            }
        }
        for (auto& [key, av] : doc["assets"].items()) {
            if (!av.is_object()) continue;
            if (av.value("id", key) == raw) {
                const std::string p = av.value("path", std::string{});
                if (!p.empty()) return p;
            }
        }
    }
    return raw;
}

void rebuildEditorAssetManifest(const json& doc) {
    s_editorAssetManifest.clear();
    if (doc.contains("assets") && doc["assets"].is_object()) {
        for (auto& [key, av] : doc["assets"].items()) {
            if (!av.is_object()) continue;
            const std::string id   = av.value("id", key);
            const std::string path = av.value("path", std::string{});
            if (!path.empty()) s_editorAssetManifest.addImageEntry(id, path);
        }
    }
    if (doc.contains("tilesets") && doc["tilesets"].is_object()) {
        for (auto& [key, tv] : doc["tilesets"].items()) {
            if (!tv.is_object()) continue;
            const std::string id  = tv.value("id", key);
            const std::string raw = tv.value("spriteImagePath", std::string{});
            const std::string path = resolveImageLoadKeyFromDoc(doc, raw);
            if (!path.empty()) s_editorAssetManifest.addImageEntry(id, path);
        }
    }
    if (doc.contains("audioAssets") && doc["audioAssets"].is_object()) {
        for (auto& [key, av] : doc["audioAssets"].items()) {
            if (!av.is_object()) continue;
            const std::string id   = av.value("id", key);
            const std::string path = av.value("path", std::string{});
            if (!path.empty()) s_editorAssetManifest.addAudioEntry(id, path);
        }
    }
    if (doc.contains("fontAssets") && doc["fontAssets"].is_object()) {
        for (auto& [key, av] : doc["fontAssets"].items()) {
            if (!av.is_object()) continue;
            const std::string id   = av.value("id", key);
            const std::string path = av.value("path", std::string{});
            if (!path.empty()) s_editorAssetManifest.addFontEntry(id, path);
        }
    }
}

} // namespace

namespace ArtCade {

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
float    EditorAPI::s_editorGridSize   = 32.f;
bool     EditorAPI::s_editorSnapEnabled = false;
bool     EditorAPI::s_physicsDebugDraw  = false;

Modules::RuntimeEntityGateway* EditorAPI::s_entityGateway = nullptr;
Modules::LuaHost*              EditorAPI::s_luaHost       = nullptr;
Modules::Renderer*             EditorAPI::s_renderer      = nullptr;
Modules::DialogManager*        EditorAPI::s_dialogManager = nullptr;
Modules::SpriteAnimator*       EditorAPI::s_spriteAnimator = nullptr;
Modules::Audio*                EditorAPI::s_audio = nullptr;
EditorProjectLoadedHandler     EditorAPI::s_onProjectLoaded{};
EditorPreviewRestoreHandler    EditorAPI::s_onPreviewRestore{};
EditorEnterPlayHandler         EditorAPI::s_onEnterPlay{};
EditorExitPlayHandler          EditorAPI::s_onExitPlay{};
std::vector<std::pair<std::string, std::string>> EditorAPI::s_consoleQueue;

namespace {
float s_runtimeProfile[6] = {};
} // namespace

void EditorAPI::publishRuntimeProfile(const float fps,
                                      const float luaMs,
                                      const float physicsMs,
                                      const float renderMs,
                                      const uint32_t entityCount,
                                      const uint32_t physicsBodies) {
    s_runtimeProfile[0] = fps;
    s_runtimeProfile[1] = luaMs;
    s_runtimeProfile[2] = physicsMs;
    s_runtimeProfile[3] = renderMs;
    s_runtimeProfile[4] = static_cast<float>(entityCount);
    s_runtimeProfile[5] = static_cast<float>(physicsBodies);
}

const float* EditorAPI::runtimeProfileBuffer() {
    return s_runtimeProfile;
}

namespace {

// Tool ids accepted by editor_set_tool(); kept in this TU to validate
// incoming values without exposing the enum from the input controller.
constexpr int kToolSelect = 0;
constexpr int kToolErase  = 3;

bool isPaintTool(int tool) { return tool == 2 /*paint*/ || tool == 3 /*erase*/; }

} // namespace

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
    if (renderer) {
        renderer->setTextureKeyResolver([](const std::string& ref) {
            return s_editorAssetManifest.resolveImageKey(ref);
        });
    }
    notifyConsoleLine("[EditorAPI] Engine wired to Renderer (image upload ready).", "info");
}

void EditorAPI::wireSpriteAnimator(Modules::SpriteAnimator* spriteAnimator) {
    s_spriteAnimator = spriteAnimator;
}

void EditorAPI::wireAudio(Modules::Audio* audio) {
    s_audio = audio;
}

void EditorAPI::wireDialog(Modules::DialogManager* dialogManager) {
    s_dialogManager = dialogManager;
    notifyConsoleLine("[EditorAPI] Engine wired to DialogManager.", "info");
}

void EditorAPI::setProjectLoadedHandler(EditorProjectLoadedHandler handler) {
    s_onProjectLoaded = std::move(handler);
}

void EditorAPI::setPreviewRestoreHandler(EditorPreviewRestoreHandler handler) {
    s_onPreviewRestore = std::move(handler);
}

void EditorAPI::setEnterPlayHandler(EditorEnterPlayHandler handler) {
    s_onEnterPlay = std::move(handler);
}

void EditorAPI::setExitPlayHandler(EditorExitPlayHandler handler) {
    s_onExitPlay = std::move(handler);
}

// ── Init / Shutdown ───────────────────────────────────────────────────────────
void EditorAPI::init(const char* canvasSelector) {
    EditorInputController::initCanvas(canvasSelector);
    notifyConsoleLine("[EditorAPI] Bridge initialised -- native input active.", "info");
}

void EditorAPI::shutdown() {
    EditorInputController::shutdownCanvas();
}

// ── C++ -> React notifications ────────────────────────────────────────────────
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

void EditorAPI::notifyRuntimeProfile(const float fps,
                                    const float luaMs,
                                    const float physicsMs,
                                    const float renderMs,
                                    const uint32_t entityCount,
                                    const uint32_t physicsBodies) {
    EM_ASM({
        if (typeof window.onRuntimeProfile === 'function')
            window.onRuntimeProfile($0, $1, $2, $3, $4, $5);
    }, fps, luaMs, physicsMs, renderMs,
       static_cast<int>(entityCount), static_cast<int>(physicsBodies));
}

void EditorAPI::notifyTilemapPainted(int col, int row, int tileId) {
    EM_ASM({
        if (typeof window.onTilemapPainted === 'function')
            window.onTilemapPainted($0, $1, $2);
    }, col, row, tileId);
}

void EditorAPI::notifySpriteFillColor(uint32_t entityId, float r, float g, float b) {
    EM_ASM({
        if (typeof window.onSpriteFillColor === 'function')
            window.onSpriteFillColor($0, $1, $2, $3);
    }, static_cast<int>(entityId), r, g, b);
}

void EditorAPI::notifyCursorWorld(float x, float y) {
    static int lastX = 0x7fffffff;
    static int lastY = 0x7fffffff;
    const int ix = static_cast<int>(std::lround(x));
    const int iy = static_cast<int>(std::lround(y));
    if (ix == lastX && iy == lastY) return;
    lastX = ix;
    lastY = iy;
    EM_ASM({
        if (typeof window.onEditorCursorWorld === 'function')
            window.onEditorCursorWorld($0, $1);
    }, ix, iy);
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
// React -> C++ exported commands
// =============================================================================

extern "C" {

EMSCRIPTEN_KEEPALIVE void editor_set_mode(int mode) {
    ArtCade::EditorAPI::s_mode = mode;
    if (auto* gw = ArtCade::EditorAPI::s_entityGateway) {
        if (mode == 1) gw->applyDesignVisibilityForPlay();
        else           gw->restoreDesignVisibilityForEdit();
    }
    ArtCade::EditorAPI::notifyConsoleLine(
        mode == 0 ? "[EditorAPI] Mode: EDIT" : "[EditorAPI] Mode: PLAY", "info");
}

EMSCRIPTEN_KEEPALIVE void editor_select_entity(uint32_t entityId) {
    ArtCade::EditorAPI::s_selectedEntityId = entityId;
}

EMSCRIPTEN_KEEPALIVE void editor_set_tile_paint_mode(int enabled) {
    ArtCade::EditorAPI::s_tilePaintMode = (enabled != 0);
}

EMSCRIPTEN_KEEPALIVE void editor_set_selected_tile(int tileId) {
    ArtCade::EditorAPI::s_selectedTileId = tileId;
}

EMSCRIPTEN_KEEPALIVE void editor_set_tool(int toolId) {
    if (toolId < ArtCade::kToolSelect || toolId > ArtCade::kToolErase)
        toolId = ArtCade::kToolSelect;
    ArtCade::EditorAPI::s_editorTool = toolId;
    ArtCade::EditorAPI::s_tilePaintMode = ArtCade::isPaintTool(toolId);
}

EMSCRIPTEN_KEEPALIVE void editor_set_guides_enabled(int enabled) {
    ArtCade::EditorAPI::s_editorGuidesEnabled = (enabled != 0);
}

EMSCRIPTEN_KEEPALIVE void editor_set_grid_size(float tileSize) {
    ArtCade::EditorAPI::s_editorGridSize = tileSize >= 4.f ? tileSize : 32.f;
}

EMSCRIPTEN_KEEPALIVE void editor_set_snap_to_grid(int enabled) {
    ArtCade::EditorAPI::s_editorSnapEnabled = (enabled != 0);
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

EMSCRIPTEN_KEEPALIVE void editor_register_audio(
    const char* path, const uint8_t* bytes, int len, const char* ext) {
    if (!path || !*path || !bytes || len <= 0) return;
    auto* a = ArtCade::EditorAPI::s_audio;
    if (!a) return;
    const std::string fileExt = (ext && *ext) ? ext : ".ogg";
    (void)a->registerSoundFromMemory(
        path, reinterpret_cast<const unsigned char*>(bytes), len, fileExt);
}

EMSCRIPTEN_KEEPALIVE void editor_invalidate_asset(
    const char* assetKey, const char* type) {
    if (!assetKey || !*assetKey || !type || !*type) return;
    const std::string key(assetKey);
    const std::string kind(type);
    if (kind == "image") {
        if (auto* r = ArtCade::EditorAPI::s_renderer)
            r->invalidateImageAsset(key);
    } else if (kind == "audio") {
        if (auto* a = ArtCade::EditorAPI::s_audio)
            a->invalidateSound(key);
    } else if (kind == "font") {
        if (auto* r = ArtCade::EditorAPI::s_renderer)
            r->invalidateFontAsset(key);
    }
}

EMSCRIPTEN_KEEPALIVE void editor_register_font(
    const char* path, const uint8_t* bytes, int len, const char* ext, int baseSize) {
    if (!path || !*path || !bytes || len <= 0) return;
    auto* r = ArtCade::EditorAPI::s_renderer;
    if (!r) return;
    const std::string fileExt = (ext && *ext) ? ext : ".ttf";
    const int size = baseSize > 0 ? baseSize : 32;
    (void)r->registerFontFromMemory(
        path, reinterpret_cast<const unsigned char*>(bytes), len, fileExt, size);
}

EMSCRIPTEN_KEEPALIVE void editor_deselect() {
    ArtCade::EditorAPI::s_selectedEntityId = 0u;
}

EMSCRIPTEN_KEEPALIVE int editor_reregister_animation_clips(const char* json_utf8) {
    auto* anim = ArtCade::EditorAPI::s_spriteAnimator;
    if (!anim) return -1;
    if (!json_utf8 || !*json_utf8) {
        anim->clearClips();
        return 0;
    }
    try {
        const json doc = json::parse(json_utf8);
        auto imageAssets = ArtCade::ProjectDocParser::parseImageAssets(doc);
        replaceAnimationClipsFromAssets(*anim, imageAssets);
        return 0;
    } catch (const std::exception&) {
        return -2;
    }
}

EMSCRIPTEN_KEEPALIVE void editor_preview_spritesheet_reset() {
    ArtCade::EditorAPI::resetSpritesheetPreview();
}

EMSCRIPTEN_KEEPALIVE int editor_preview_spritesheet_submit(
    const char* texturePath,
    const char* clipName,
    float dtSeconds,
    int canvasW,
    int canvasH) {
    if (!texturePath || !*texturePath || !clipName || !*clipName) return -2;
    ArtCade::EditorAPI::queueSpritesheetPreview(texturePath, clipName, dtSeconds, canvasW, canvasH);
    return 0;
}

namespace {

enum class ProjectLoadKind { HotSync, PreviewRestore, EnterPlay, ExitPlay };

/** Load dialog JSON; returns false if DialogManager missing. */
bool loadDialogsFromJson(const char* json_utf8) {
    auto* dm = ArtCade::EditorAPI::s_dialogManager;
    if (!dm) return false;
    if (!json_utf8) {
        (void)dm->loadDialogGraphsJson("[]");
        return true;
    }
    return dm->loadDialogGraphsJson(json_utf8);
}

int loadLuaFromUtf8(const char* lua_utf8) {
    if (!lua_utf8 || !*lua_utf8) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] empty Lua source.", "warn");
        return ArtCade::kEditorApiLuaError;
    }
    auto* host = ArtCade::EditorAPI::s_luaHost;
    if (!host) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] LuaHost not wired yet.", "warn");
        return ArtCade::kEditorApiNotWired;
    }
    if (host->loadLuaSource(lua_utf8)) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] Logic Board hot-reloaded.", "info");
        return ArtCade::kEditorApiOk;
    }
    std::string msg =
        "[EditorAPI] Hot-reload failed: " + host->lastError();
    ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "error");
    return ArtCade::kEditorApiLuaError;
}

/** @return true on success, false on parse/wire failure (sets console message). */
bool loadProjectFromJson(const char* json_utf8, ProjectLoadKind kind,
                         const std::string* exitPlayLua = nullptr) {
    const char* apiName = "editor_load_project";
    switch (kind) {
    case ProjectLoadKind::HotSync:       apiName = "editor_load_project"; break;
    case ProjectLoadKind::PreviewRestore: apiName = "editor_restore_from_project"; break;
    case ProjectLoadKind::EnterPlay:     apiName = "editor_enter_play_mode"; break;
    case ProjectLoadKind::ExitPlay:      apiName = "editor_exit_play_mode"; break;
    }

    if (!json_utf8 || !*json_utf8) {
        std::string msg = std::string("[EditorAPI] ") + apiName + ": empty JSON.";
        ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "warn");
        return false;
    }
    auto* gateway = ArtCade::EditorAPI::s_entityGateway;
    if (!gateway) {
        std::string msg = std::string("[EditorAPI] ") + apiName + ": engine not wired yet.";
        ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "warn");
        return false;
    }

    namespace Parser = ArtCade::ProjectDocParser;

    try {
        const json doc = json::parse(json_utf8);
        rebuildEditorAssetManifest(doc);

        auto objectTypes = Parser::parseObjectTypes(doc);
        auto entityDefs  = Parser::parseEntities(doc);
        auto sceneDefs   = Parser::parseScenes(doc);
        auto tilesets    = Parser::parseTilesets(doc);
        auto tilePalette = Parser::parseTilePalette(doc);
        auto imageAssets = Parser::parseImageAssets(doc);

        Parser::materializeV2Project(entityDefs, sceneDefs, objectTypes);

        if (ArtCade::EditorAPI::s_spriteAnimator)
            registerAnimationClipsFromAssets(
                *ArtCade::EditorAPI::s_spriteAnimator, imageAssets);

        std::string activeId = doc.value("activeSceneId",
                               doc.value("active_scene_id", std::string{}));
        if (activeId.empty() && !sceneDefs.empty())
            activeId = sceneDefs.begin()->first;

        const std::unordered_map<std::string, ArtCade::EntityDef>* typesPtr =
            objectTypes.empty() ? nullptr : &objectTypes;
        gateway->replaceProject(sceneDefs, entityDefs, activeId, typesPtr);
        gateway->setTilesets(tilesets);

        const ArtCade::ProjectRuntimeSettings runtimeSettings =
            Parser::parseRuntimeSettings(doc);

        ArtCade::EditorAPI::s_physicsDebugDraw = false;
        if (doc.contains("world") && doc["world"].is_object()) {
            const auto& wo = doc["world"];
            if (wo.contains("physicsDebugDraw"))
                ArtCade::EditorAPI::s_physicsDebugDraw =
                    wo["physicsDebugDraw"].get<bool>();
        }

        if (kind == ProjectLoadKind::HotSync) {
            if (ArtCade::EditorAPI::s_onProjectLoaded)
                ArtCade::EditorAPI::s_onProjectLoaded(
                    tilePalette, tilesets, runtimeSettings);
        } else if (kind == ProjectLoadKind::PreviewRestore) {
            if (ArtCade::EditorAPI::s_onPreviewRestore)
                ArtCade::EditorAPI::s_onPreviewRestore(
                    tilePalette, tilesets, runtimeSettings);
        } else if (kind == ProjectLoadKind::EnterPlay) {
            if (ArtCade::EditorAPI::s_onEnterPlay)
                ArtCade::EditorAPI::s_onEnterPlay(
                    tilePalette, tilesets, runtimeSettings);
        } else if (kind == ProjectLoadKind::ExitPlay) {
            const std::string lua = exitPlayLua ? *exitPlayLua : std::string{};
            if (ArtCade::EditorAPI::s_onExitPlay)
                ArtCade::EditorAPI::s_onExitPlay(
                    tilePalette, tilesets, runtimeSettings, lua);
        }

        char buf[128];
        if (kind == ProjectLoadKind::HotSync) {
            std::snprintf(buf, sizeof(buf),
                "[EditorAPI] Project loaded: %zu entities, %zu scenes.",
                entityDefs.size(), sceneDefs.size());
        } else if (kind == ProjectLoadKind::EnterPlay) {
            std::snprintf(buf, sizeof(buf),
                "[EditorAPI] Enter play: %zu entities, %zu scenes.",
                entityDefs.size(), sceneDefs.size());
        } else if (kind == ProjectLoadKind::ExitPlay) {
            std::snprintf(buf, sizeof(buf),
                "[EditorAPI] Exit play: %zu entities, %zu scenes.",
                entityDefs.size(), sceneDefs.size());
        } else {
            std::snprintf(buf, sizeof(buf),
                "[EditorAPI] Preview restored: %zu entities, %zu scenes.",
                entityDefs.size(), sceneDefs.size());
        }
        ArtCade::EditorAPI::notifyConsoleLine(buf, "info");
        return true;

    } catch (const std::exception& ex) {
        char buf[256];
        std::snprintf(buf, sizeof(buf), "[EditorAPI] JSON parse error: %s", ex.what());
        ArtCade::EditorAPI::notifyConsoleLine(buf, "error");
        return false;
    }
}

} // namespace

EMSCRIPTEN_KEEPALIVE void editor_load_project(const char* json_utf8) {
    (void)loadProjectFromJson(json_utf8, ProjectLoadKind::HotSync);
}

EMSCRIPTEN_KEEPALIVE void editor_restore_from_project(const char* json_utf8) {
    (void)loadProjectFromJson(json_utf8, ProjectLoadKind::PreviewRestore);
}

EMSCRIPTEN_KEEPALIVE int editor_enter_play_mode(
    const char* project_json,
    const char* lua_utf8,
    const char* dialogs_json)
{
    if (!ArtCade::EditorAPI::s_entityGateway || !ArtCade::EditorAPI::s_luaHost)
        return ArtCade::kEditorApiNotWired;

    if (!loadProjectFromJson(project_json, ProjectLoadKind::EnterPlay))
        return ArtCade::kEditorApiJsonError;

    if (!loadDialogsFromJson(dialogs_json))
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_enter_play_mode: DialogManager not wired.", "warn");

    const int luaResult = loadLuaFromUtf8(lua_utf8);
    if (luaResult != ArtCade::kEditorApiOk)
        return luaResult;

    ArtCade::EditorAPI::s_mode = 1;
    if (auto* gw = ArtCade::EditorAPI::s_entityGateway)
        gw->applyDesignVisibilityForPlay();
    ArtCade::EditorAPI::notifyConsoleLine("[EditorAPI] Mode: PLAY", "info");
    return ArtCade::kEditorApiOk;
}

EMSCRIPTEN_KEEPALIVE int editor_exit_play_mode(
    const char* project_json,
    const char* lua_utf8)
{
    if (!ArtCade::EditorAPI::s_entityGateway)
        return ArtCade::kEditorApiNotWired;

    const std::string luaCopy = lua_utf8 ? lua_utf8 : std::string{};
    if (!loadProjectFromJson(project_json, ProjectLoadKind::ExitPlay, &luaCopy))
        return ArtCade::kEditorApiJsonError;

    ArtCade::EditorAPI::s_mode = 0;
    if (auto* gw = ArtCade::EditorAPI::s_entityGateway)
        gw->restoreDesignVisibilityForEdit();

    ArtCade::EditorAPI::notifyConsoleLine("[EditorAPI] Mode: EDIT", "info");
    return ArtCade::kEditorApiOk;
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
    ArtCade::EditorAPI::notifyTransformChanged(entityId, x, y, rotation, scaleX, scaleY);
}

EMSCRIPTEN_KEEPALIVE void editor_update_entity(
    uint32_t entityId, const char* json_utf8)
{
    if (!json_utf8 || !*json_utf8) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_update_entity: empty JSON.", "warn");
        return;
    }
    auto* gateway = ArtCade::EditorAPI::s_entityGateway;
    if (!gateway) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_update_entity: engine not wired yet.", "warn");
        return;
    }

    try {
        const json doc = json::parse(json_utf8);
        namespace Parser = ArtCade::ProjectDocParser;
        auto def = Parser::parseEntityDef(doc, entityId);
        def.id = entityId;

        if (!gateway->updateEntity(entityId, def)) {
            char buf[96];
            std::snprintf(buf, sizeof(buf),
                "[EditorAPI] editor_update_entity: unknown entity #%u.", entityId);
            ArtCade::EditorAPI::notifyConsoleLine(buf, "warn");
            return;
        }
    } catch (const std::exception& ex) {
        char buf[256];
        std::snprintf(buf, sizeof(buf),
            "[EditorAPI] editor_update_entity parse error: %s", ex.what());
        ArtCade::EditorAPI::notifyConsoleLine(buf, "error");
    }
}

EMSCRIPTEN_KEEPALIVE void editor_set_scene_settings(
    const char* sceneId, const char* json_utf8)
{
    if (!sceneId || !*sceneId || !json_utf8 || !*json_utf8) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_set_scene_settings: invalid arguments.", "warn");
        return;
    }
    auto* gateway = ArtCade::EditorAPI::s_entityGateway;
    if (!gateway) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_set_scene_settings: engine not wired yet.", "warn");
        return;
    }

    try {
        const json doc = json::parse(json_utf8);
        namespace Parser = ArtCade::ProjectDocParser;
        auto patch = Parser::parseSceneDef(doc, sceneId);

        if (!gateway->updateSceneSettings(sceneId, patch)) {
            std::string msg = "[EditorAPI] editor_set_scene_settings: unknown scene ";
            msg += sceneId;
            ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "warn");
            return;
        }

        if (gateway->activeSceneId() == sceneId) {
            if (auto* r = ArtCade::EditorAPI::s_renderer) {
                if (const ArtCade::SceneDef* sc = gateway->activeScene()) {
                    if (sc->worldSize.x > 0.f && sc->worldSize.y > 0.f) {
                        r->setWindowSize(
                            static_cast<uint32_t>(sc->worldSize.x),
                            static_cast<uint32_t>(sc->worldSize.y),
                            "ArtCade V2");
                    }
                    r->setSceneViewport(sc->worldSize, sc->worldSize);
                }
            }
        }

        std::string msg = "[EditorAPI] Scene settings patched: ";
        msg += sceneId;
        ArtCade::EditorAPI::notifyConsoleLine(msg.c_str(), "info");
    } catch (const std::exception& ex) {
        char buf[256];
        std::snprintf(buf, sizeof(buf),
            "[EditorAPI] editor_set_scene_settings parse error: %s", ex.what());
        ArtCade::EditorAPI::notifyConsoleLine(buf, "error");
    }
}

EMSCRIPTEN_KEEPALIVE int editor_reload_script(const char* lua_utf8) {
    return loadLuaFromUtf8(lua_utf8);
}

EMSCRIPTEN_KEEPALIVE const float* editor_get_runtime_profile() {
    return ArtCade::EditorAPI::runtimeProfileBuffer();
}

EMSCRIPTEN_KEEPALIVE void editor_load_dialogs(const char* json_utf8) {
    auto* dm = ArtCade::EditorAPI::s_dialogManager;
    if (!dm) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] editor_load_dialogs: DialogManager not wired yet.", "warn");
        return;
    }
    if (!json_utf8) {
        (void)dm->loadDialogGraphsJson("[]");
        return;
    }
    if (dm->loadDialogGraphsJson(json_utf8)) {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] Dialog library synced to runtime.", "info");
    } else {
        ArtCade::EditorAPI::notifyConsoleLine(
            "[EditorAPI] Dialog library sync had parse errors — see stderr.", "warn");
    }
}

} // extern "C"

#endif // __EMSCRIPTEN__

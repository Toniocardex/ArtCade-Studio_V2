#pragma once
// =============================================================================
// editor-api.h -- bidirectional bridge between the C++ WASM runtime and the
//                 React editor shell.
//
// Architectural rules (Guida_Architettura_e_SmokeTest_ArtCade):
//
//  INPUT  -- C++ reads mouse/keyboard NATIVELY via emscripten/html5.h.
//            React NEVER listens to canvas mouse events.
//            Zero-latency: mouse moves at 1000 Hz inside C++.
//
//  STATE  -- C++ is the Single Source of Truth.
//            React receives final coordinates only on drop, not per-frame.
//
//  React->C++  EMSCRIPTEN_KEEPALIVE functions called via Module.ccall()
//  C++->React  EM_ASM macros that call window.on* globals
//              (set by wasm-bridge.ts BEFORE game.js loads)
// =============================================================================

#include <cstdint>
#include <functional>
#include <string>
#include <utility>
#include <vector>

// Forward declarations shared by both the WASM build and the native stub.
// Keeping them outside the #ifdef avoids a class of "undeclared identifier"
// errors when the native build of editor-api.h is included from a TU that
// doesn't bring in app.h (TECHNICAL_DEBT_REVIEW §22).
namespace ArtCade {
namespace Modules {
class RuntimeEntityGateway;
class LuaHost;
class Renderer;
}
struct TilePaletteEntry;
struct TilesetAsset;

/**
 * Callback invoked by editor_load_project AFTER the gateway has been
 * populated from the JSON blob. Application registers its
 * applyEditorProjectLoaded() through EditorAPI::setProjectLoadedHandler()
 * so editor-api never has to depend on app.h
 * (TECHNICAL_DEBT_REVIEW §8 — replaced static `s_application` pointer).
 */
using EditorProjectLoadedHandler = std::function<void(
    const std::vector<TilePaletteEntry>&,
    const std::vector<TilesetAsset>&)>;
} // namespace ArtCade

#ifdef __EMSCRIPTEN__

#include <emscripten.h>
#include <emscripten/html5.h>

namespace ArtCade {

class EditorAPI {
public:
    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Call once at startup (from Application::initSubsystems).
     * Registers all native input callbacks on the given canvas CSS selector.
     */
    static void init(const char* canvasSelector = "#artcade-canvas");
    static void shutdown();

    // -------------------------------------------------------------------------
    // Engine wiring
    // Called by Application after all modules are initialised so that the
    // editor commands (editor_load_project, editor_set_transform, ...) can
    // reach the engine's internal state.
    // -------------------------------------------------------------------------
    static void wireEngine(Modules::RuntimeEntityGateway* gateway);

    /**
     * Wire the LuaHost so editor_reload_script() can push freshly compiled
     * Logic Board Lua into the running VM. Called by Application after the
     * LuaHost is initialised.
     */
    static void wireLua(Modules::LuaHost* luaHost);

    /**
     * Wire the Renderer so editor_register_image() can upload editor-loaded
     * images (e.g. tilesets not present in the VFS) into the GPU texture
     * cache. Called by Application after the Renderer is initialised.
     */
    static void wireRenderer(Modules::Renderer* renderer);

    /**
     * Register the callback invoked after editor_load_project finishes
     * populating the gateway. Replaces the previous direct
     * `s_application->applyEditorProjectLoaded(...)` coupling.
     * Pass an empty handler (`{}`) to unregister.
     */
    static void setProjectLoadedHandler(EditorProjectLoadedHandler handler);

    // -------------------------------------------------------------------------
    // C++ -> React notifications (Smoke Test 3)
    // -------------------------------------------------------------------------

    /** User clicked an entity in the viewport -> React updates Hierarchy + Inspector. */
    static void notifyEntitySelected(uint32_t entityId);

    /**
     * Gizmo drag finished -> React updates Inspector fields.
     * Called on mouse-UP, NOT every mouse-move (Single Source of Truth rule).
     */
    static void notifyTransformChanged(uint32_t entityId,
        float x, float y, float rotation,
        float scaleX, float scaleY);

    /** Engine / Lua debug.log() -> React Console panel. */
    static void notifyConsoleLine(const char* message, const char* level = "info");
    static void queueConsoleLine(const char* message, const char* level = "info");
    static void flushConsoleLines();

    /** Phase F2: a tile cell was painted in the scene -> React persists it. */
    static void notifyTilemapPainted(int col, int row, int tileId);

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------
    static int      getMode()           { return s_mode; }
    static uint32_t getSelectedEntity() { return s_selectedEntityId; }
    static bool     isEditorMode()      { return s_mode == 0; }

    // Written by extern "C" exports -- public so they can be set directly
    static int      s_mode;
    static uint32_t s_selectedEntityId;
    static bool     s_isDragging;
    static float    s_dragStartX, s_dragStartY;
    static bool     s_tilePaintMode;   // Phase F2
    static int      s_selectedTileId;  // Phase F2 (0 = eraser)
    static int      s_editorTool;      // 0 select, 1 pan, 2 paint, 3 erase/tile
    static bool     s_editorGuidesEnabled;
    static float    s_editorGridSize;

    // Engine pointers wired in wireEngine() / wireLua()
    static Modules::RuntimeEntityGateway* s_entityGateway;
    static Modules::LuaHost*              s_luaHost;
    static Modules::Renderer*             s_renderer;
    static EditorProjectLoadedHandler     s_onProjectLoaded;
    static std::vector<std::pair<std::string, std::string>> s_consoleQueue;

    // Native input callbacks -- bypass the JS thread entirely (Smoke Test 2)
    // Public because editor-input-controller.cpp registers them with the
    // emscripten event API; nobody else should be calling them directly.
    static EM_BOOL onMouseMove (int, const EmscriptenMouseEvent*,    void*);
    static EM_BOOL onMouseDown (int, const EmscriptenMouseEvent*,    void*);
    static EM_BOOL onMouseUp   (int, const EmscriptenMouseEvent*,    void*);
    static EM_BOOL onKeyDown   (int, const EmscriptenKeyboardEvent*, void*);
    static EM_BOOL onKeyUp     (int, const EmscriptenKeyboardEvent*, void*);
};

} // namespace ArtCade

// =============================================================================
// React -> C++ exported commands  (called via Module.ccall() from TypeScript)
// =============================================================================
extern "C" {

/** 0 = editor mode (gizmos, grid)  |  1 = play / game mode */
EMSCRIPTEN_KEEPALIVE void editor_set_mode(int mode);

/** Programmatically select an entity from the Hierarchy panel. */
EMSCRIPTEN_KEEPALIVE void editor_select_entity(uint32_t entityId);

/** Clear the viewport selection. */
EMSCRIPTEN_KEEPALIVE void editor_deselect();

/**
 * Hot-reload project data from React.
 * json_utf8: null-terminated UTF-8 JSON string (marshalled by wasm-bridge.ts).
 * Parses with nlohmann/json and calls SceneManager::registerScenes().
 */
EMSCRIPTEN_KEEPALIVE void editor_load_project(const char* json_utf8);

/**
 * Push a transform change from the React Inspector into the C++ scene.
 * Routes the update through RuntimeEntityGateway::setTransform().
 */
EMSCRIPTEN_KEEPALIVE void editor_set_transform(
    uint32_t entityId,
    float x,      float y,
    float rotation,
    float scaleX, float scaleY);

/**
 * Incrementally update one entity from a JSON EntityDef blob (Inspector edits).
 * Does not clear the registry, unload textures, or reset Lua.
 */
EMSCRIPTEN_KEEPALIVE void editor_update_entity(
    uint32_t entityId, const char* json_utf8);

/**
 * Patch scene viewport/world/background for one scene without a full reload.
 * json_utf8: SceneDef subset (id, worldSize, viewportSize, backgroundColor).
 */
EMSCRIPTEN_KEEPALIVE void editor_set_scene_settings(
    const char* sceneId, const char* json_utf8);

/**
 * Hot-reload game logic from the Logic Board editor.
 * lua_utf8: null-terminated UTF-8 Lua SOURCE (compiled by the editor's
 * compileLogicBoard()). Executed via LuaHost::loadLuaSource(), which
 * redefines the global tick(). On error the previous script stays active
 * and the message is pushed to the React console.
 */
EMSCRIPTEN_KEEPALIVE void editor_reload_script(const char* lua_utf8);

/** Phase F2: toggle in-scene tile painting (1 = on). */
EMSCRIPTEN_KEEPALIVE void editor_set_tile_paint_mode(int enabled);

/** Phase F2: set the brush tile id (0 = eraser). */
EMSCRIPTEN_KEEPALIVE void editor_set_selected_tile(int tileId);

/** Editor viewport tool: 0 select, 1 pan, 2 paint, 3 erase/tile. */
EMSCRIPTEN_KEEPALIVE void editor_set_tool(int toolId);

/** Toggle runtime-side editor guides (world bounds / viewport / grid). */
EMSCRIPTEN_KEEPALIVE void editor_set_guides_enabled(int enabled);

/** Editor-only guide/snap grid size in world pixels. Does not affect tilemap. */
EMSCRIPTEN_KEEPALIVE void editor_set_grid_size(float tileSize);

/**
 * Phase F3: upload an editor-loaded image (e.g. a tileset spritesheet not
 * present in the WASM VFS) into the renderer's texture cache under `path`
 * (must match TilesetAsset.spriteImagePath). `bytes` is the raw encoded
 * image file (PNG/JPG/...); `ext` is the file-type hint, e.g. ".png".
 */
EMSCRIPTEN_KEEPALIVE void editor_register_image(
    const char* path, const uint8_t* bytes, int len, const char* ext);

} // extern "C"

// =============================================================================
// Native-build stubs (non-WASM platforms -- compiles but does nothing)
// =============================================================================
#else // !__EMSCRIPTEN__

namespace ArtCade {

struct EditorAPI {
    static void init(const char* = nullptr) {}
    static void shutdown() {}
    static void wireEngine(Modules::RuntimeEntityGateway*) {}
    static void wireLua(Modules::LuaHost*) {}
    static void wireRenderer(Modules::Renderer*) {}
    static void setProjectLoadedHandler(EditorProjectLoadedHandler) {}
    static void notifyEntitySelected(uint32_t) {}
    static void notifyTransformChanged(uint32_t, float, float, float, float, float) {}
    static void notifyConsoleLine(const char*, const char* = nullptr) {}
    static void queueConsoleLine(const char*, const char* = nullptr) {}
    static void flushConsoleLines() {}
    static void notifyTilemapPainted(int, int, int) {}
    static int      getMode()           { return 0; }
    static uint32_t getSelectedEntity() { return 0u; }
    static bool     isEditorMode()      { return true; }
    static int      s_mode;
    static uint32_t s_selectedEntityId;
    static bool     s_isDragging;
    static float    s_dragStartX, s_dragStartY;
    static bool     s_tilePaintMode;
    static int      s_selectedTileId;
    static int      s_editorTool;
    static bool     s_editorGuidesEnabled;
    static float    s_editorGridSize;
    static Modules::RuntimeEntityGateway* s_entityGateway;
    static Modules::LuaHost*              s_luaHost;
    static Modules::Renderer*             s_renderer;
    static EditorProjectLoadedHandler     s_onProjectLoaded;
    static std::vector<std::pair<std::string, std::string>> s_consoleQueue;
};
} // namespace ArtCade

#endif // __EMSCRIPTEN__

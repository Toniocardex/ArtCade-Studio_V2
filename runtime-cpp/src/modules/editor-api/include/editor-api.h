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

#ifdef __EMSCRIPTEN__

#include <emscripten.h>
#include <emscripten/html5.h>
#include <cstdint>
#include <functional>

// Forward declarations -- defined in the engine modules
namespace ArtCade::Modules {
class EntityManager;
class SceneManager;
}

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
    static void wireEngine(Modules::EntityManager* em, Modules::SceneManager* sm);

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

    // Engine pointers wired in wireEngine()
    static Modules::EntityManager* s_entityManager;
    static Modules::SceneManager*  s_sceneManager;

private:
    // Native input callbacks -- bypass the JS thread entirely (Smoke Test 2)
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
 * Updates the EntityDef in EntityManager directly.
 */
EMSCRIPTEN_KEEPALIVE void editor_set_transform(
    uint32_t entityId,
    float x,      float y,
    float rotation,
    float scaleX, float scaleY);

} // extern "C"

// =============================================================================
// Native-build stubs (non-WASM platforms -- compiles but does nothing)
// =============================================================================
#else // !__EMSCRIPTEN__

#include <cstdint>

namespace ArtCade {
namespace Modules { class EntityManager; class SceneManager; }

struct EditorAPI {
    static void init(const char* = nullptr) {}
    static void shutdown() {}
    static void wireEngine(Modules::EntityManager*, Modules::SceneManager*) {}
    static void notifyEntitySelected(uint32_t) {}
    static void notifyTransformChanged(uint32_t, float, float, float, float, float) {}
    static void notifyConsoleLine(const char*, const char* = nullptr) {}
    static int      getMode()           { return 0; }
    static uint32_t getSelectedEntity() { return 0u; }
    static bool     isEditorMode()      { return true; }
    static int      s_mode;
    static uint32_t s_selectedEntityId;
    static bool     s_isDragging;
    static float    s_dragStartX, s_dragStartY;
};
} // namespace ArtCade

#endif // __EMSCRIPTEN__

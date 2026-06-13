#pragma once

#include "../../core/engine-context.h"
#include "../../core/runtime-profiler.h"
#include "../../core/types.h"
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade {

namespace Modules { class SplashState; }

/** How the renderer maps world vs viewport for the active scene. */
enum class ViewportPolicy {
    EditorPreview, /**< worldSize window; viewport = world (1:1 edit canvas) */
    NativePlay,    /**< viewportSize window; camera lens = viewport */
};


/**
 * Application - top-level orchestrator (Layer 4).
 *
 * Owns all modules, wires the EngineContext, and drives the main loop.
 * main.cpp contains only:  return Application{}.run(argc, argv);
 * Implementations are split by domain across app_bootstrap, app_loop,
 * app_project_lifecycle, and app_scene_render.
 *
 * Responsibilities:
 *   - Module lifetime management (init order, shutdown reverse order)
 *   - Main loop (fixed-timestep accumulator)
 *   - Lua tick -> Physics step -> Render
 */
class Application {
public:
    Application();
    ~Application();

    int run(int argc, char* argv[]);

    /** Apply targetFPS, physicsMode, and viewport/window from project settings. */
    void applyRuntimeSettings(const ProjectRuntimeSettings& settings,
                              ViewportPolicy              policy);

#ifdef ARTCADE_WASM
    /** Shared tile setup after editor project JSON is applied (no viewport). */
    void applyEditorProjectCommon(const std::vector<TilePaletteEntry>& tilePalette,
                                  const std::vector<TilesetAsset>&     tilesets);
    /** Called from editor_load_project after the gateway swap. */
    void applyEditorProjectLoaded(const std::vector<TilePaletteEntry>& tilePalette,
                                  const std::vector<TilesetAsset>&     tilesets,
                                  const std::vector<GameVariableDefinition>& variables,
                                  const ProjectRuntimeSettings&        settings);
    /** Called from editor_restore_from_project: reset runtime, restore design. */
    void applyEditorPreviewRestore(const std::vector<TilePaletteEntry>& tilePalette,
                                   const std::vector<TilesetAsset>&     tilesets,
                                   const std::vector<GameVariableDefinition>& variables,
                                   const ProjectRuntimeSettings&        settings);
    /** Atomic PLAY: world sync + gameplay module reset (Lua set by editor-api). */
    void applyEditorEnterPlay(const std::vector<TilePaletteEntry>& tilePalette,
                              const std::vector<TilesetAsset>&     tilesets,
                              const std::vector<GameVariableDefinition>& variables,
                              const ProjectRuntimeSettings&        settings);
    /** Atomic STOP: design restore + gameplay Lua (no empty stub). */
    void applyEditorExitPlay(const std::vector<TilePaletteEntry>& tilePalette,
                             const std::vector<TilesetAsset>&     tilesets,
                             const std::vector<GameVariableDefinition>& variables,
                             const ProjectRuntimeSettings&        settings,
                             const std::string&                   luaSource);
    /** Shared reset for tween/audio/animator/event/layer/save/time/state/camera. */
    void resetGameplayRuntimeModules();
#endif

private:
    struct Modules;
    std::unique_ptr<Modules> mod_;

    EngineContext ctx_;
    RuntimeProfiler profiler_;

    // Top-level initialization delegates to dependency-ordered domain steps.
    bool initModules(const std::string& projectPath);

    // Layer 0: stateless modules + GameStateManager.
    bool initUtilities();
    // Layer 1-4: renderer, physics, input, audio, world, GameAPI, LuaHost
    bool initSubsystems();
    // Layer 5: load project data, initialize the world, and load Lua bytecode.
    bool loadProject(const std::string& projectPath);

    void shutdownModules();
    void mainLoop();
    void loopIteration();      // One frame, shared by native and WASM loops.
    /** One fixed-timestep simulation tick (gameplay, physics, lifecycle). */
    void tickFixedStep(float dt);
    /** Per-render-frame tail: profiler counts, draw, console flush, input reset. */
    void tickFrameEnd();
    void renderActiveScene();

    float targetDt_        = 1.f / 60.f;
    float accumulator_      = 0.f;          // Persistent across frames for WASM.
    bool  running_          = false;
    PhysicsMode physicsMode_ = PhysicsMode::Auto;
    std::string licenseTier_ = "free";      // from ProjectDoc, used by SplashState
    std::unique_ptr<::ArtCade::Modules::SplashState> splash_;  // FREE-tier watermark overlay
    std::unordered_map<int, ::ArtCade::Vec4> tileColors_;  // Phase D2: id → render colour
    std::unordered_map<std::string, ::ArtCade::TilesetAsset> tilesets_;  // Phase F3

#ifdef ARTCADE_WASM
    // Emscripten requires a static callback that forwards to the active instance.
    static Application* webInstance_;
    static void         webLoopCallback();
#endif
};

} // namespace ArtCade

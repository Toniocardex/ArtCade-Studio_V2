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


/**
 * Application — top-level orchestrator (Layer 4).
 *
 * Owns all modules, wires the EngineContext, and drives the main loop.
 * main.cpp contains only:  return Application{}.run(argc, argv);
 *
 * Responsibilities:
 *   - Module lifetime management (init order, shutdown reverse order)
 *   - Main loop (fixed-timestep accumulator)
 *   - Lua tick → Physics step → Render
 */
class Application {
public:
    Application();
    ~Application();

    int run(int argc, char* argv[]);

#ifdef ARTCADE_WASM
    /** Shared tile/viewport setup after editor project JSON is applied. */
    void applyEditorProjectCommon(const std::vector<TilePaletteEntry>& tilePalette,
                                  const std::vector<TilesetAsset>&     tilesets);
    /** Called from editor_load_project after the gateway swap. */
    void applyEditorProjectLoaded(const std::vector<TilePaletteEntry>& tilePalette,
                                  const std::vector<TilesetAsset>&     tilesets);
    /** Called from editor_restore_from_project — reset runtime, keep Lua. */
    void applyEditorPreviewRestore(const std::vector<TilePaletteEntry>& tilePalette,
                                   const std::vector<TilesetAsset>&     tilesets);
    /** Shared reset for tween/audio/animator/event/layer/save/time/state/camera. */
    void resetGameplayRuntimeModules();
#endif

private:
    struct Modules;
    std::unique_ptr<Modules> mod_;

    EngineContext ctx_;
    RuntimeProfiler profiler_;

    // Top-level init — chiama i tre helper in ordine
    bool initModules(const std::string& projectPath);

    // Layer 0: moduli stateless + GameStateManager
    bool initUtilities();
    // Layer 1-4: renderer, physics, input, audio, world, GameAPI, LuaHost
    bool initSubsystems();
    // Layer 5: carica project.json/.artcade, inizializza world, carica script Lua
    bool loadProject(const std::string& projectPath);

    void shutdownModules();
    void mainLoop();
    void loopIteration();      // singolo frame — usato sia dal while che dal callback WASM
    /** One fixed-timestep simulation tick (gameplay, physics, lifecycle). */
    void tickFixedStep(float dt);
    /** Per-render-frame tail: profiler counts, draw, console flush, input reset. */
    void tickFrameEnd();
    void renderActiveScene();

    float targetDt_        = 1.f / 60.f;
    float accumulator_      = 0.f;          // persistent tra frame (necessario su WASM)
    bool  running_          = false;
    PhysicsMode physicsMode_ = PhysicsMode::Auto;
    std::string licenseTier_ = "free";      // from ProjectDoc, used by SplashState
    std::unique_ptr<::ArtCade::Modules::SplashState> splash_;  // FREE-tier watermark overlay
    std::unordered_map<int, ::ArtCade::Vec4> tileColors_;  // Phase D2: id → render colour
    std::unordered_map<std::string, ::ArtCade::TilesetAsset> tilesets_;  // Phase F3

#ifdef ARTCADE_WASM
    // Emscripten richiede una callback statica — punta all'istanza corrente
    static Application* webInstance_;
    static void         webLoopCallback();
#endif
};

} // namespace ArtCade

#pragma once

#include "../../core/engine-context.h"
#include <memory>
#include <string>

namespace ArtCade {

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

private:
    struct Modules;
    std::unique_ptr<Modules> mod_;

    EngineContext ctx_;

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
    void renderActiveScene();

    float targetDt_    = 1.f / 60.f;
    float accumulator_ = 0.f;          // persistent tra frame (necessario su WASM)
    bool  running_     = false;

#ifdef ARTCADE_WASM
    // Emscripten richiede una callback statica — punta all'istanza corrente
    static Application* webInstance_;
    static void         webLoopCallback();
#endif
};

} // namespace ArtCade

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
    // Owned modules (unique_ptr = clear ownership, no leaks)
    struct Modules;
    std::unique_ptr<Modules> mod_;

    EngineContext ctx_;

    bool initModules(const std::string& projectPath);
    void shutdownModules();
    void mainLoop();
    void renderActiveScene();

    float targetDt_ = 1.f / 60.f;
    bool  running_  = false;
};

} // namespace ArtCade

#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/game-state/include/splash-state.h"

#include <iostream>
#include <memory>
#include <string>

namespace ArtCade {

Application::Application() : mod_(std::make_unique<Modules>()) {}
Application::~Application() { shutdownModules(); }

#ifdef ARTCADE_WASM
Application* Application::webInstance_ = nullptr;

void Application::webLoopCallback() {
    if (webInstance_) webInstance_->loopIteration();
}
#endif

int Application::run(int argc, char* argv[]) {
#ifdef ARTCADE_WASM
    (void)argc;
    (void)argv;
    if (!initUtilities() || !initSubsystems()) {
        std::cerr << "[App] Initialization failed.\n";
        return 1;
    }
    targetDt_ = 1.f / 60.f;
#else
    const std::string projectPath = (argc > 1) ? argv[1] : "game.artcade";
    if (!initModules(projectPath)) {
        std::cerr << "[App] Initialization failed.\n";
        return 1;
    }
#endif

    running_ = true;
    mainLoop();
    shutdownModules();
    return 0;
}

} // namespace ArtCade

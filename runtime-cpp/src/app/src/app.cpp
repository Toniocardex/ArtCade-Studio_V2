#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"

#include <iostream>
#include <memory>
#include <string>

namespace ArtCade {

Application::Application() : mod_(std::make_unique<Modules>()) {}
Application::~Application() {
#ifndef ARTCADE_WASM
    shutdownModules();
#endif
}

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
        if (!EditorAPI::bootFailureStep()[0])
            EditorAPI::recordBootFailure("utilities");
        EditorAPI::clearEngineWiring();
        EditorAPI::flushConsoleLines();
        shutdownModules();
        EditorAPI::recordWasmMainExitCode(1);
        return 1;
    }
    EditorAPI::flushConsoleLines();
    targetDt_ = 1.f / 60.f;
    // Signal JS boot latch as soon as init + wireEngine succeed — do not wait for
    // emscripten_set_main_loop to return (WebView2 can defer main() return).
    EditorAPI::recordWasmMainExitCode(0);
#else
    const std::string projectPath = (argc > 1) ? argv[1] : "game.artcade";
    if (!initModules(projectPath)) {
        std::cerr << "[App] Initialization failed.\n";
        return 1;
    }
#endif

    running_ = true;
    mainLoop();
#ifdef ARTCADE_WASM
    return 0;
#else
    shutdownModules();
    return 0;
#endif
}

} // namespace ArtCade

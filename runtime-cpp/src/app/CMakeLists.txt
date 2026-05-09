add_executable(game
    src/main.cpp
    src/app.cpp
)
target_include_directories(game PRIVATE include)
target_link_libraries(game PRIVATE
    artcade-world
    artcade-game-api
    artcade-lua-runtime
    artcade-asset-system
    artcade-renderer
    artcade-physics
    artcade-input
    artcade-audio
    artcade-entity-system
    artcade-scene-system
    # New modules
    artcade-time
    artcade-event-bus
    artcade-variable-manager
    artcade-game-state
    artcade-texture-manager
    artcade-sprite-animator
    artcade-layer-manager
    artcade-camera-manager
    artcade-tween-manager
    artcade-save-load
)

# ============================================================================
# Emscripten WASM — Fase 14
# ============================================================================
if(EMSCRIPTEN)
    # Definisce ARTCADE_WASM → app.cpp usa emscripten_set_main_loop
    target_compile_definitions(game PRIVATE ARTCADE_WASM)

    # Eccezioni C++ necessarie per Sol2
    target_compile_options(game PRIVATE -fexceptions -O2)

    # Output: game.html + game.js + game.wasm
    set_target_properties(game PROPERTIES SUFFIX ".html")

    # Preload test-project nel filesystem virtuale WASM
    set(PRELOAD_PATH "${CMAKE_SOURCE_DIR}/test-project")

    target_link_options(game PRIVATE
        -fexceptions
        -sWASM=1
        -sUSE_GLFW=3
        -sALLOW_MEMORY_GROWTH=1
        -sFORCE_FILESYSTEM=1
        -sEXPORTED_RUNTIME_METHODS=["ccall","cwrap"]
        -sASYNCIFY=0
        "--preload-file=${PRELOAD_PATH}@test-project"
        -O2
    )
else()
    # Native compiler warnings
    if(MSVC)
        target_compile_options(game PRIVATE /W4 /permissive-)
    else()
        target_compile_options(game PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endif()

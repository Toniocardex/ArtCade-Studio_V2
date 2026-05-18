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
    artcade-runtime-entity-gateway
    artcade-editor-api          # WASM bridge (no-op stubs on native)
    # Stateless modules
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
# Emscripten WASM
# ============================================================================
if(EMSCRIPTEN)
    # ARTCADE_WASM -> app.cpp uses emscripten_set_main_loop
    target_compile_definitions(game PRIVATE ARTCADE_WASM)

    # C++ exceptions required by Sol2
    target_compile_options(game PRIVATE -fexceptions -O2)

    # Output: game.html + game.js + game.wasm
    set_target_properties(game PROPERTIES SUFFIX ".html")

    # Preload test-project into the WASM virtual filesystem
    set(PRELOAD_PATH "${CMAKE_SOURCE_DIR}/test-project")

    # EXPORTED_FUNCTIONS: main + all editor-api commands callable from ccall()
    set(GAME_EXPORTED_FUNCTIONS
        "_main"
        "_editor_set_mode"
        "_editor_select_entity"
        "_editor_deselect"
        "_editor_load_project"
        "_editor_set_transform"
        "_editor_reload_script"
        "_editor_set_tile_paint_mode"
        "_editor_set_selected_tile"
        "_malloc"
        "_free"
    )
    string(JOIN "," _FUNS_STR ${GAME_EXPORTED_FUNCTIONS})

    target_link_options(game PRIVATE
        -fexceptions
        -sWASM=1
        -sUSE_GLFW=3
        -sALLOW_MEMORY_GROWTH=1
        -sFORCE_FILESYSTEM=1
        "-sEXPORTED_RUNTIME_METHODS=[\"ccall\",\"cwrap\",\"UTF8ToString\",\"lengthBytesUTF8\",\"stringToUTF8\"]"
        "-sEXPORTED_FUNCTIONS=[${_FUNS_STR}]"
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

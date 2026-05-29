add_executable(game
    src/main.cpp
    src/app.cpp
    render/editor-overlay-renderer.cpp
    render/tilemap-renderer.cpp
    render/ray-tint-widget.cpp
)
target_include_directories(game PRIVATE include render)
target_link_libraries(game PRIVATE
    artcade-world
    artcade-game-api
    artcade-lua-runtime
    artcade-asset-system
    artcade-renderer
    artcade-physics
    artcade-input
    artcade-audio
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
    artcade-dialog
)

# ============================================================================
# Emscripten WASM
# ============================================================================
if(EMSCRIPTEN)
    # ARTCADE_WASM -> app.cpp uses emscripten_set_main_loop
    target_compile_definitions(game PRIVATE ARTCADE_WASM)

    # C++ exceptions required by Sol2
    target_compile_options(game PRIVATE -fexceptions -O2)

    # Output: game.js + game.wasm only (no .html — html-minifier-terser unreliable)
    set_target_properties(game PROPERTIES SUFFIX ".js")

    # Editor WASM preview: no test-project preload — projects come from the
    # React shell via editor_load_project. (runtime-cpp/test-project remains
    # for native runs and smoke tests.)

    # EXPORTED_FUNCTIONS: main + all editor-api commands callable from ccall()
    set(GAME_EXPORTED_FUNCTIONS
        "_main"
        "_editor_set_mode"
        "_editor_select_entity"
        "_editor_deselect"
        "_editor_load_project"
        "_editor_restore_from_project"
        "_editor_enter_play_mode"
        "_editor_exit_play_mode"
        "_editor_set_transform"
        "_editor_update_entity"
        "_editor_set_scene_settings"
        "_editor_reload_script"
        "_editor_load_dialogs"
        "_editor_set_tile_paint_mode"
        "_editor_set_selected_tile"
        "_editor_set_tool"
        "_editor_set_guides_enabled"
        "_editor_set_grid_size"
        "_editor_set_snap_to_grid"
        "_editor_register_image"
        "_editor_register_audio"
        "_editor_invalidate_asset"
        "_editor_open_raytint"
        "_editor_close_raytint"
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
        "-sEXPORTED_RUNTIME_METHODS=[\"ccall\",\"cwrap\",\"UTF8ToString\",\"lengthBytesUTF8\",\"stringToUTF8\",\"HEAPU8\"]"
        "-sEXPORTED_FUNCTIONS=[${_FUNS_STR}]"
        -sASYNCIFY=0
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

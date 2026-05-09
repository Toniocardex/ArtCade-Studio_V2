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
# Emscripten WASM flags
# ============================================================================
if(EMSCRIPTEN)
    target_compile_options(game PRIVATE -fexceptions)
    target_link_options(game PRIVATE
        -fexceptions
        -s WASM=1
        -s ALLOW_MEMORY_GROWTH=1
        -s USE_WEBGL2=1
        -s EXPORTED_RUNTIME_METHODS=["ccall","cwrap"]
        --preload-file ${CMAKE_SOURCE_DIR}/../assets@/assets
    )
    set_target_properties(game PROPERTIES SUFFIX ".js")
else()
    # Native compiler warnings
    if(MSVC)
        target_compile_options(game PRIVATE /W4 /permissive-)
    else()
        target_compile_options(game PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endif()

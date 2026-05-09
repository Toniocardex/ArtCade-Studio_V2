cmake_minimum_required(VERSION 3.20)

project(ArtCade-Runtime CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# Third-Party Libraries Setup
# ============================================================================

# Raylib
set(BUILD_SHARED_LIBS OFF)
set(BUILD_EXAMPLES OFF)
set(BUILD_GAMES OFF)
add_subdirectory(libs/raylib EXCLUDE_FROM_ALL)

# Lua
set(LUA_BUILD_SHARED OFF)
add_subdirectory(libs/lua EXCLUDE_FROM_ALL)

# Sol2 (header-only)
set(SOL2_INCLUDE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/libs/sol2/include)

# Rapier2D C bindings (TODO: configure based on platform)
# For now, assume pre-built or header-only shim
set(RAPIER2D_C_INCLUDE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/libs/rapier2d-c/include)

# JSON (nlohmann/json - header only, or configure as needed)
find_package(nlohmann_json 3.2.0 QUIET)
if(NOT nlohmann_json_FOUND)
    message(STATUS "nlohmann_json not found, will use bundled version")
    set(NLOHMANN_JSON_INCLUDE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/libs/nlohmann-json/include)
endif()

# ============================================================================
# Main Engine Target
# ============================================================================

set(ARTCADE_SOURCES
    src/main.cpp

    # Engine Layer
    src/engine/renderer.cpp
    src/engine/physics.cpp
    src/engine/input.cpp
    src/engine/audio.cpp
    src/engine/lua-host.cpp
    src/engine/game-api.cpp

    # Game Layer
    src/game/entity-manager.cpp
    src/game/scene-manager.cpp
    src/game/asset-loader.cpp
    src/game/world.cpp

    # Utils
    src/utils/logger.cpp
    src/utils/zip.cpp
    src/utils/json.cpp
)

set(ARTCADE_HEADERS
    src/engine/renderer.h
    src/engine/physics.h
    src/engine/input.h
    src/engine/audio.h
    src/engine/lua-host.h
    src/engine/game-api.h
    src/engine/types.h

    src/game/entity-manager.h
    src/game/scene-manager.h
    src/game/asset-loader.h
    src/game/world.h

    src/utils/logger.h
    src/utils/zip.h
    src/utils/json.h
    src/utils/math.h
)

add_executable(game ${ARTCADE_SOURCES} ${ARTCADE_HEADERS})

# ============================================================================
# Link Libraries
# ============================================================================

target_link_libraries(game PRIVATE
    raylib
    lua
)

# ============================================================================
# Include Directories
# ============================================================================

target_include_directories(game PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${SOL2_INCLUDE_DIR}
    ${RAPIER2D_C_INCLUDE_DIR}
    ${NLOHMANN_JSON_INCLUDE_DIR}
)

# ============================================================================
# Compiler Flags
# ============================================================================

if(EMSCRIPTEN)
    # Emscripten-specific flags
    target_compile_options(game PRIVATE
        -std=c++17
        -fexceptions
    )

    target_link_options(game PRIVATE
        -fexceptions
        --preload-file ${CMAKE_CURRENT_SOURCE_DIR}/../assets@/assets
        -s WASM=1
        -s ALLOW_MEMORY_GROWTH=1
        -s USE_WEBGL2=1
        -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']
    )

    # Output .wasm + .js
    set_target_properties(game PROPERTIES SUFFIX ".js")

else()
    # Native platform flags
    if(MSVC)
        target_compile_options(game PRIVATE /W4 /permissive-)
    else()
        target_compile_options(game PRIVATE -Wall -Wextra -Wpedantic)
    endif()
endif()

# ============================================================================
# Optional Features
# ============================================================================

if(ARTCADE_WITH_STEAM)
    # TODO: Link Steamworks SDK
    # add_subdirectory(libs/steamworks)
    # target_link_libraries(game PRIVATE steamworks)
    target_compile_definitions(game PRIVATE ARTCADE_WITH_STEAM=1)
endif()

if(ARTCADE_ENABLE_DEBUG_UI)
    # TODO: ImGui integration
    # add_subdirectory(libs/imgui)
    # target_link_libraries(game PRIVATE imgui)
    target_compile_definitions(game PRIVATE ARTCADE_ENABLE_DEBUG_UI=1)
endif()

# ============================================================================
# Installation
# ============================================================================

install(TARGETS game DESTINATION bin)

# ============================================================================
# Build Summary
# ============================================================================

message("
=============================================================================
  ArtCade Runtime Build Configuration
=============================================================================
  Target:               game
  Output:               ${CMAKE_BINARY_DIR}/game$<IF:$<BOOL:${EMSCRIPTEN}>,.js,.exe>
  Platform:             $<IF:$<BOOL:${EMSCRIPTEN}>,WebAssembly,${CMAKE_SYSTEM_NAME}>
  Build Type:           ${CMAKE_BUILD_TYPE}

  Libraries:
    - Raylib:           ${RAYLIB_VERSION}
    - Lua:              5.4
    - Sol2:             (header-only)
    - nlohmann_json:    (header-only)

  Build Command:
    cmake --build . --config ${CMAKE_BUILD_TYPE}

=============================================================================
")

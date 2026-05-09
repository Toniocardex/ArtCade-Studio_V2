cmake_minimum_required(VERSION 3.20)
project(ArtCade-Runtime CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ============================================================================
# Platform detection
# ============================================================================
if(EMSCRIPTEN)
    message(STATUS "[ArtCade] Target: WebAssembly (Emscripten)")
    set(ARTCADE_PLATFORM_WASM TRUE)
else()
    message(STATUS "[ArtCade] Target: Native (${CMAKE_SYSTEM_NAME})")
    set(ARTCADE_PLATFORM_WASM FALSE)
endif()

# ============================================================================
# Third-party libraries
# ============================================================================
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(BUILD_EXAMPLES    OFF CACHE BOOL "" FORCE)
set(BUILD_GAMES       OFF CACHE BOOL "" FORCE)
add_subdirectory(libs/raylib EXCLUDE_FROM_ALL)

set(SOL2_INCLUDE_DIR          ${CMAKE_CURRENT_SOURCE_DIR}/libs/sol2/include)
set(NLOHMANN_JSON_INCLUDE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/libs/nlohmann-json/include)
set(RAPIER2D_INCLUDE_DIR      ${CMAKE_CURRENT_SOURCE_DIR}/libs/rapier2d-c/include)
set(LUA_INCLUDE_DIR           ${CMAKE_CURRENT_SOURCE_DIR}/libs/lua)

add_subdirectory(libs/lua EXCLUDE_FROM_ALL)

# ============================================================================
# Shared include interface (core headers available to every module)
# ============================================================================
add_library(artcade-core INTERFACE)
target_include_directories(artcade-core INTERFACE
    ${CMAKE_CURRENT_SOURCE_DIR}/src/core
    ${SOL2_INCLUDE_DIR}
    ${NLOHMANN_JSON_INCLUDE_DIR}
    ${RAPIER2D_INCLUDE_DIR}
)

# ============================================================================
# Modules (each has its own CMakeLists.txt)
# ============================================================================
add_subdirectory(src/modules/renderer)
add_subdirectory(src/modules/physics)
add_subdirectory(src/modules/input)
add_subdirectory(src/modules/audio)
add_subdirectory(src/modules/lua-runtime)
add_subdirectory(src/modules/entity-system)
add_subdirectory(src/modules/scene-system)
add_subdirectory(src/modules/asset-system)
add_subdirectory(src/modules/game-api)

# ============================================================================
# World + Application
# ============================================================================
add_subdirectory(src/world)
add_subdirectory(src/app)

# ============================================================================
# Tests (optional)
# ============================================================================
option(ARTCADE_BUILD_TESTS "Build unit tests" OFF)
if(ARTCADE_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

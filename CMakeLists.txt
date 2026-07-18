cmake_minimum_required(VERSION 3.20)

project(ArtCade VERSION 2.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

if(EMSCRIPTEN)
    message(STATUS "Building for Emscripten (WASM target)")
    set(BUILD_FOR_WASM TRUE)
else()
    message(STATUS "Building for native platform (${CMAKE_SYSTEM_NAME})")
    set(BUILD_FOR_WASM FALSE)
endif()

# Product UI is ArtCade_Editor_RmlUi (sibling). This tree is runtime + headless core.
option(ARTCADE_WITH_STEAM "Include Steam SDK integration" OFF)
option(ARTCADE_ENABLE_DEBUG_UI "Enable ImGui debug visualizer" OFF)
# Forwarded into runtime-cpp (also defined there). Keep at root so
# `cmake -DARTCADE_BUILD_TESTS=ON` is discoverable for the monorepo build.
option(ARTCADE_BUILD_TESTS "Build runtime-cpp unit tests" OFF)

add_subdirectory(runtime-cpp)

if(NOT BUILD_FOR_WASM)
    enable_testing()
    add_subdirectory(src/application)
endif()

message("
=============================================================================
  ArtCade V2 Build Configuration
=============================================================================
  Build Type:           ${CMAKE_BUILD_TYPE}
  Platform:             ${CMAKE_SYSTEM_NAME}
  Compiler:             ${CMAKE_CXX_COMPILER}
  C++ Standard:         ${CMAKE_CXX_STANDARD}
  WASM Build:           ${BUILD_FOR_WASM}
  Steam Integration:    ${ARTCADE_WITH_STEAM}
  Debug UI:             ${ARTCADE_ENABLE_DEBUG_UI}

  Product UI:           ArtCade_Editor_RmlUi (native RmlUi — sibling repo)
  This repo:            runtime-cpp + headless artcade_editor_core
=============================================================================
")

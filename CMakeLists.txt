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

# Qt editor is the product UI (React/Tauri removed). Default ON for native Windows.
if(WIN32 AND NOT BUILD_FOR_WASM)
    option(ARTCADE_BUILD_QT_EDITOR "Build ArtCade Qt editor (requires Qt 6.8 LTS)" ON)
else()
    option(ARTCADE_BUILD_QT_EDITOR "Build ArtCade Qt editor (requires Qt 6.8 LTS)" OFF)
endif()
option(ARTCADE_WITH_STEAM "Include Steam SDK integration" OFF)
option(ARTCADE_ENABLE_DEBUG_UI "Enable ImGui debug visualizer" OFF)

add_subdirectory(runtime-cpp)

if(NOT BUILD_FOR_WASM)
    enable_testing()
    add_subdirectory(src/application)
endif()

if(ARTCADE_BUILD_QT_EDITOR)
    if(BUILD_FOR_WASM)
        message(FATAL_ERROR "ARTCADE_BUILD_QT_EDITOR is not supported for Emscripten/WASM builds")
    endif()
    add_subdirectory(src/qt)
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
  Qt Editor:            ${ARTCADE_BUILD_QT_EDITOR}
  Steam Integration:    ${ARTCADE_WITH_STEAM}
  Debug UI:             ${ARTCADE_ENABLE_DEBUG_UI}

  Editor: artcade-editor-qt (Qt 6.8) — React/Tauri removed
  Run:    scripts/run-artcade-editor-qt.ps1
=============================================================================
")

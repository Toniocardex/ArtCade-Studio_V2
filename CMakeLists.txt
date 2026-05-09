cmake_minimum_required(VERSION 3.20)

project(ArtCade VERSION 2.0.0 LANGUAGES C CXX)

# ============================================================================
# Build Configuration
# ============================================================================

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Detect build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# Detect if building for Emscripten/WASM
if(EMSCRIPTEN)
    message(STATUS "Building for Emscripten (WASM target)")
    set(BUILD_FOR_WASM TRUE)
else()
    message(STATUS "Building for native platform (${CMAKE_SYSTEM_NAME})")
    set(BUILD_FOR_WASM FALSE)
endif()

# ============================================================================
# Project Options
# ============================================================================

option(ARTCADE_BUILD_EDITOR "Build React editor (requires Node.js)" OFF)
option(ARTCADE_WITH_STEAM "Include Steam SDK integration" OFF)
option(ARTCADE_ENABLE_DEBUG_UI "Enable ImGui debug visualizer" OFF)

# ============================================================================
# Add Subdirectories
# ============================================================================

add_subdirectory(runtime-cpp)

# Optional: Editor setup instructions
if(ARTCADE_BUILD_EDITOR)
    message(STATUS "Editor build: npm install && npm run build in editor/")
endif()

# ============================================================================
# Summary
# ============================================================================

message("
=============================================================================
  ArtCade V2 Build Configuration
=============================================================================
  Build Type:           ${CMAKE_BUILD_TYPE}
  Platform:             ${CMAKE_SYSTEM_NAME}
  Compiler:             ${CMAKE_CXX_COMPILER}
  C++ Standard:         ${CMAKE_CXX_STANDARD}

  Target:               ${CMAKE_BUILD_TYPE}
  WASM Build:           ${BUILD_FOR_WASM}
  Steam Integration:    ${ARTCADE_WITH_STEAM}
  Debug UI:             ${ARTCADE_ENABLE_DEBUG_UI}

=============================================================================
  Next Steps:
    cmake --build . --config ${CMAKE_BUILD_TYPE}

  For Emscripten (WASM):
    emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
    cmake --build .
=============================================================================
")

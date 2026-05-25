cmake_minimum_required(VERSION 3.20)

# ============================================================================
# Box2D 2.4 — scaricato automaticamente via FetchContent
# ============================================================================
include(FetchContent)

FetchContent_Declare(
    box2d
    GIT_REPOSITORY https://github.com/erincatto/box2d.git
    GIT_TAG        v2.4.1
    GIT_SHALLOW    TRUE
)

# Disabilita tutto ciò che non serve
set(BOX2D_BUILD_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(BOX2D_BUILD_TESTBED    OFF CACHE BOOL "" FORCE)
set(BOX2D_BUILD_DOCS       OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(box2d)

# ============================================================================
# artcade-physics
# ============================================================================
add_library(artcade-physics
    src/physics.cpp
)

target_include_directories(artcade-physics
    PUBLIC  include
    PRIVATE src
)

target_link_libraries(artcade-physics
    PUBLIC  artcade-core
    PRIVATE box2d
)

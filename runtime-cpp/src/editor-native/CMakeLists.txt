# ============================================================================
# editor-native — parallel native C++ editor spike (RmlUi evaluation).
#
#   artcade-editor-core   authoring logic only — ProjectDocument, commands,
#                         intents, coordinator, invalidation, play session.
#                         No Raylib, no RmlUi. Always built; unit-tested.
#
#   artcade-editor-native the RmlUi host + window + viewport, behind
#                         option(ARTCADE_BUILD_NATIVE_EDITOR). Needs the Raylib
#                         target and a fetched RmlUi (+ FreeType). Default OFF so
#                         the normal runtime build and the web editor are never
#                         affected.
# ============================================================================

add_library(artcade-editor-core STATIC
    model/project_document.cpp
    model/play_session.cpp
    commands/entity_commands.cpp
    commands/scene_commands.cpp
    app/editor_coordinator.cpp
    app/inspector_commit.cpp
)

# `core/...` and `editor-native/...` includes resolve from the src root.
target_include_directories(artcade-editor-core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/..   # runtime-cpp/src
)
target_link_libraries(artcade-editor-core PUBLIC artcade-core)

# ----------------------------------------------------------------------------
# Native RmlUi editor target (opt-in).
# ----------------------------------------------------------------------------
option(ARTCADE_BUILD_NATIVE_EDITOR "Build the RmlUi native editor spike" OFF)

if(ARTCADE_BUILD_NATIVE_EDITOR)
    if(NOT TARGET raylib)
        message(FATAL_ERROR
            "[ArtCade] ARTCADE_BUILD_NATIVE_EDITOR requires Raylib (libs/raylib).")
    endif()

    include(FetchContent)

    # -- FreeType: RmlUi's default font engine. Trim every optional dependency
    #    so it builds standalone (no zlib/png/harfbuzz/brotli/bzip2 on the box).
    set(FT_DISABLE_HARFBUZZ ON  CACHE BOOL "" FORCE)
    set(FT_DISABLE_PNG      ON  CACHE BOOL "" FORCE)
    set(FT_DISABLE_ZLIB     ON  CACHE BOOL "" FORCE)
    set(FT_DISABLE_BZIP2    ON  CACHE BOOL "" FORCE)
    set(FT_DISABLE_BROTLI   ON  CACHE BOOL "" FORCE)
    FetchContent_Declare(freetype
        GIT_REPOSITORY https://github.com/freetype/freetype.git
        GIT_TAG        VER-2-13-3
        GIT_SHALLOW    TRUE)
    FetchContent_MakeAvailable(freetype)
    if(NOT TARGET Freetype::Freetype)
        add_library(Freetype::Freetype ALIAS freetype)
    endif()

    # -- RmlUi (pinned). No samples, static, FreeType font engine.
    # No samples → RmlUi builds only RmlCore + RmlDebugger; no backend library is
    # produced (we supply our own RenderInterface over rlgl), so RMLUI_BACKEND is
    # left at its default and never linked.
    set(BUILD_SHARED_LIBS   OFF CACHE BOOL "" FORCE)
    set(RMLUI_SAMPLES       OFF CACHE BOOL "" FORCE)
    set(RMLUI_BACKEND       "auto" CACHE STRING "" FORCE)  # validated only; not built (samples off)
    set(RMLUI_FONT_ENGINE   "freetype" CACHE STRING "" FORCE)
    FetchContent_Declare(rmlui
        GIT_REPOSITORY https://github.com/mikke89/RmlUi.git
        GIT_TAG        6.1
        GIT_SHALLOW    TRUE)
    FetchContent_MakeAvailable(rmlui)

    add_executable(artcade-editor-native
        app/main.cpp
        app/editor_app.cpp
        app/rml_system.cpp
        app/rml_renderer.cpp
        app/rml_host.cpp
        app/editor_input.cpp
        view/scene_view.cpp
        ui/editor_ui.cpp
        ui/hierarchy_panel.cpp
        ui/inspector_panel.cpp
        ui/console_panel.cpp
        demo/demo_project.cpp
    )
    target_include_directories(artcade-editor-native PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/..   # runtime-cpp/src
    )
    target_link_libraries(artcade-editor-native PRIVATE
        artcade-editor-core
        raylib
        RmlUi::Core
        RmlUi::Debugger
    )

    # Copy the RML/RCSS/fonts next to the executable so it runs from the build dir.
    add_custom_command(TARGET artcade-editor-native POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            ${CMAKE_CURRENT_SOURCE_DIR}/resources
            $<TARGET_FILE_DIR:artcade-editor-native>/resources
        COMMENT "[editor-native] copying RML/RCSS resources")

    message(STATUS "[ArtCade] Native editor : ENABLED (RmlUi 6.1 + FreeType)")
endif()

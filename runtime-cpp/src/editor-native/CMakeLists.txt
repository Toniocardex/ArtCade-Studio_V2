# ============================================================================
# editor-native — parallel native C++ editor spike (RmlUi evaluation).
#
# Two layers, split by what they depend on:
#
#   artcade-editor-core   authoring logic only — ProjectDocument, commands,
#                         intents, coordinator, invalidation, play session.
#                         No Raylib, no RmlUi. Always built; unit-tested.
#
#   artcade-editor-native (future) the RmlUi host + window + viewport, behind
#                         option(ARTCADE_BUILD_NATIVE_EDITOR). Not added until
#                         the pinned RmlUi dependency lands so the default build
#                         and the web editor are never affected.
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

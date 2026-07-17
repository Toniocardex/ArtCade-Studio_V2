# artcade_editor_core — authoring authority without Qt / Raylib / QObject.
# Single ProjectDoc + CommandStack. Linked by Qt adapter and headless tests.

add_library(artcade_editor_core STATIC
    src/project_file_io.cpp
    src/commands.cpp
    src/scene_layer_support.cpp
    src/scene_layer_commands.cpp
    src/scene_layer_coordinator.cpp
    src/scene_layer_assignment.cpp
    src/scene_layer_remove.cpp
    src/scene_layer_duplicate.cpp
    src/logic_board_names.cpp
    src/logic_board_commands.cpp
    src/logic_board_property.cpp
    src/logic_board_section_commands.cpp
    src/object_type_component_commands.cpp
    src/editor_coordinator.cpp
)

add_library(ArtCade::EditorCore ALIAS artcade_editor_core)

target_include_directories(artcade_editor_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(artcade_editor_core
    PUBLIC
        artcade-project-json
        artcade-logic-core
)

target_compile_features(artcade_editor_core PUBLIC cxx_std_17)

# Headless round-trip test (always when not WASM)
if(NOT BUILD_FOR_WASM)
    add_executable(artcade_editor_core_roundtrip_test
        ${CMAKE_SOURCE_DIR}/tests/application/editor_core_roundtrip_test.cpp
    )
    target_link_libraries(artcade_editor_core_roundtrip_test PRIVATE artcade_editor_core)
    add_test(NAME artcade_editor_core_roundtrip_test COMMAND artcade_editor_core_roundtrip_test)

    # Fixture path baked at configure time
    target_compile_definitions(artcade_editor_core_roundtrip_test
        PRIVATE
            ARTCADE_QT_SLICE_FIXTURE_DIR="${CMAKE_SOURCE_DIR}/tests/fixtures/qt-slice"
    )
    target_include_directories(artcade_editor_core_roundtrip_test
        PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}/src
    )
endif()

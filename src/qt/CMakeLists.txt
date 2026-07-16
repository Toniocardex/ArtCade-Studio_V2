# Qt editor (optional) — ArtCade Studio
# Enabled with: cmake -DARTCADE_BUILD_QT_EDITOR=ON ...
# Requires Qt 6.8 LTS (Core Gui Qml Quick QuickControls2 QuickLayouts).
# QtQuick.Effects (MultiEffect) is loaded at runtime via the QML plugin; the
# public Qt6::QuickEffects CMake target is not always shipped by aqt installs.

cmake_minimum_required(VERSION 3.21)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS
    Core
    Gui
    Qml
    Quick
    QuickControls2
    QuickLayouts
)

qt_standard_project_setup(REQUIRES 6.8)

qt_add_executable(artcade-editor-qt
    app/main.cpp
)

set_target_properties(artcade-editor-qt PROPERTIES
    WIN32_EXECUTABLE TRUE
    MACOSX_BUNDLE TRUE
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    OUTPUT_NAME artcade-editor-qt
)

target_include_directories(artcade-editor-qt
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${CMAKE_CURRENT_SOURCE_DIR}/bridge
)

target_link_libraries(artcade-editor-qt
    PRIVATE
        Qt6::Core
        Qt6::Gui
        Qt6::Qml
        Qt6::Quick
        Qt6::QuickControls2
        Qt6::QuickLayouts
        artcade_editor_core
)

# Bake absolute path to W2 fixture for one-click open in the shell.
set(_artcade_qt_slice_fixture "${CMAKE_SOURCE_DIR}/tests/fixtures/qt-slice/project.json")
file(TO_CMAKE_PATH "${_artcade_qt_slice_fixture}" _artcade_qt_slice_fixture)
target_compile_definitions(artcade-editor-qt
    PRIVATE
        "ARTCADE_QT_SLICE_FIXTURE_PATH=\"${_artcade_qt_slice_fixture}\""
)

set(ARTCADE_QML_ROOT "${CMAKE_SOURCE_DIR}/qml/ArtCade")

set(ARTCADE_QML_FILES
    ../../qml/ArtCade/Main.qml
    ../../qml/ArtCade/Theme/Theme.qml
    ../../qml/ArtCade/Theme/Metrics.qml
    ../../qml/ArtCade/Theme/Typography.qml
    ../../qml/ArtCade/Theme/Icons.qml
    ../../qml/ArtCade/Controls/AcToolbar.qml
    ../../qml/ArtCade/Controls/AcTabButton.qml
    ../../qml/ArtCade/Controls/AcSection.qml
    ../../qml/ArtCade/Controls/AcIconButton.qml
    ../../qml/ArtCade/Controls/AcButton.qml
    ../../qml/ArtCade/Controls/AcToolButton.qml
    ../../qml/ArtCade/Controls/AcTextField.qml
    ../../qml/ArtCade/Controls/AcWindowButton.qml
    ../../qml/ArtCade/Controls/AcPanelHeader.qml
    ../../qml/ArtCade/Controls/AcSplitterHandle.qml
    ../../qml/ArtCade/Controls/AcWindowResizeFrame.qml
    ../../qml/ArtCade/Controls/AcTreeDelegate.qml
    ../../qml/ArtCade/Controls/AcLayerRow.qml
    ../../qml/ArtCade/Controls/AcEmptyHint.qml
    ../../qml/ArtCade/Controls/AcLogicColumn.qml
    ../../qml/ArtCade/Controls/AcLogicRuleCard.qml
    ../../qml/ArtCade/Controls/AcLogicPropertyEditor.qml
    ../../qml/ArtCade/Controls/AcLogicKeyCapture.qml
    ../../qml/ArtCade/Controls/AcNumberField.qml
    ../../qml/ArtCade/Controls/AcInspectorRow.qml
    ../../qml/ArtCade/Controls/AcIcon.qml
    ../../qml/ArtCade/Shell/TitleBar.qml
    ../../qml/ArtCade/Shell/ModeBar.qml
    ../../qml/ArtCade/Shell/WorkspaceBar.qml
    ../../qml/ArtCade/Shell/EditorActions.qml
    ../../qml/ArtCade/Shell/LeftSidebar.qml
    ../../qml/ArtCade/Shell/ViewportPlaceholder.qml
    ../../qml/ArtCade/Shell/LogicBoardView.qml
    ../../qml/ArtCade/Shell/InspectorPane.qml
    ../../qml/ArtCade/Shell/ConsolePane.qml
    ../../qml/ArtCade/Shell/StatusBar.qml
)

set_source_files_properties(../../qml/ArtCade/Main.qml PROPERTIES QT_RESOURCE_ALIAS "Main.qml")
set_source_files_properties(../../qml/ArtCade/Theme/Theme.qml PROPERTIES
    QT_RESOURCE_ALIAS "Theme/Theme.qml"
    QT_QML_SINGLETON_TYPE TRUE)
set_source_files_properties(../../qml/ArtCade/Theme/Metrics.qml PROPERTIES
    QT_RESOURCE_ALIAS "Theme/Metrics.qml"
    QT_QML_SINGLETON_TYPE TRUE)
set_source_files_properties(../../qml/ArtCade/Theme/Typography.qml PROPERTIES
    QT_RESOURCE_ALIAS "Theme/Typography.qml"
    QT_QML_SINGLETON_TYPE TRUE)
set_source_files_properties(../../qml/ArtCade/Theme/Icons.qml PROPERTIES
    QT_RESOURCE_ALIAS "Theme/Icons.qml"
    QT_QML_SINGLETON_TYPE TRUE)
set_source_files_properties(../../qml/ArtCade/Controls/AcToolbar.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcToolbar.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcTabButton.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcTabButton.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcSection.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcSection.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcIconButton.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcIconButton.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcButton.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcButton.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcToolButton.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcToolButton.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcTextField.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcTextField.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcWindowButton.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcWindowButton.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcPanelHeader.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcPanelHeader.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcSplitterHandle.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcSplitterHandle.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcWindowResizeFrame.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcWindowResizeFrame.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcTreeDelegate.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcTreeDelegate.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcLayerRow.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcLayerRow.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcEmptyHint.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcEmptyHint.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcLogicColumn.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcLogicColumn.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcLogicRuleCard.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcLogicRuleCard.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcLogicPropertyEditor.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcLogicPropertyEditor.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcLogicKeyCapture.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcLogicKeyCapture.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcNumberField.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcNumberField.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcInspectorRow.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcInspectorRow.qml")
set_source_files_properties(../../qml/ArtCade/Controls/AcIcon.qml PROPERTIES QT_RESOURCE_ALIAS "Controls/AcIcon.qml")
set_source_files_properties(../../qml/ArtCade/Shell/TitleBar.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/TitleBar.qml")
set_source_files_properties(../../qml/ArtCade/Shell/ModeBar.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/ModeBar.qml")
set_source_files_properties(../../qml/ArtCade/Shell/WorkspaceBar.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/WorkspaceBar.qml")
set_source_files_properties(../../qml/ArtCade/Shell/EditorActions.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/EditorActions.qml")
set_source_files_properties(../../qml/ArtCade/Shell/LeftSidebar.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/LeftSidebar.qml")
set_source_files_properties(../../qml/ArtCade/Shell/ViewportPlaceholder.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/ViewportPlaceholder.qml")
set_source_files_properties(../../qml/ArtCade/Shell/LogicBoardView.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/LogicBoardView.qml")
set_source_files_properties(../../qml/ArtCade/Shell/InspectorPane.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/InspectorPane.qml")
set_source_files_properties(../../qml/ArtCade/Shell/ConsolePane.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/ConsolePane.qml")
set_source_files_properties(../../qml/ArtCade/Shell/StatusBar.qml PROPERTIES QT_RESOURCE_ALIAS "Shell/StatusBar.qml")

# Monochrome SVGs — aliased under icons/ for Icons.qml qrc URLs.
set(ARTCADE_ICON_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../qml/ArtCade/assets/icons)
set(ARTCADE_ICON_SVGS
    ${ARTCADE_ICON_DIR}/app.svg
    ${ARTCADE_ICON_DIR}/canvas.svg
    ${ARTCADE_ICON_DIR}/logic.svg
    ${ARTCADE_ICON_DIR}/script.svg
    ${ARTCADE_ICON_DIR}/undo.svg
    ${ARTCADE_ICON_DIR}/redo.svg
    ${ARTCADE_ICON_DIR}/save.svg
    ${ARTCADE_ICON_DIR}/build.svg
    ${ARTCADE_ICON_DIR}/play.svg
    ${ARTCADE_ICON_DIR}/stop.svg
    ${ARTCADE_ICON_DIR}/minimize.svg
    ${ARTCADE_ICON_DIR}/maximize.svg
    ${ARTCADE_ICON_DIR}/restore.svg
    ${ARTCADE_ICON_DIR}/close.svg
    ${ARTCADE_ICON_DIR}/search.svg
    ${ARTCADE_ICON_DIR}/add.svg
    ${ARTCADE_ICON_DIR}/eye.svg
    ${ARTCADE_ICON_DIR}/eyeOff.svg
    ${ARTCADE_ICON_DIR}/lock.svg
    ${ARTCADE_ICON_DIR}/layer.svg
    ${ARTCADE_ICON_DIR}/select.svg
    ${ARTCADE_ICON_DIR}/pan.svg
    ${ARTCADE_ICON_DIR}/move.svg
    ${ARTCADE_ICON_DIR}/rect.svg
    ${ARTCADE_ICON_DIR}/grid.svg
    ${ARTCADE_ICON_DIR}/snap.svg
    ${ARTCADE_ICON_DIR}/chevron.svg
    ${ARTCADE_ICON_DIR}/folder.svg
    ${ARTCADE_ICON_DIR}/sceneEmpty.svg
)
foreach(_icon ${ARTCADE_ICON_SVGS})
    get_filename_component(_icon_name ${_icon} NAME)
    set_source_files_properties(${_icon} PROPERTIES QT_RESOURCE_ALIAS "icons/${_icon_name}")
endforeach()

qt_add_qml_module(artcade-editor-qt
    URI ArtCade.Ui
    VERSION 1.0
    RESOURCE_PREFIX /qt/qml
    QML_FILES ${ARTCADE_QML_FILES}
    RESOURCES ${ARTCADE_ICON_SVGS}
    SOURCES
        bridge/editor_session.h
        bridge/editor_session.cpp
        bridge/hierarchy_model.h
        bridge/hierarchy_model.cpp
        bridge/layers_model.h
        bridge/layers_model.cpp
        bridge/assets_model.h
        bridge/assets_model.cpp
        bridge/scene_view_item.h
        bridge/scene_view_item.cpp
        bridge/play_process_host.h
        bridge/play_process_host.cpp
        bridge/console_model.h
        bridge/console_model.cpp
)

set(ARTCADE_QML_LINT_FILES
    ${ARTCADE_QML_ROOT}/Main.qml
    ${ARTCADE_QML_ROOT}/Theme/Theme.qml
    ${ARTCADE_QML_ROOT}/Theme/Metrics.qml
    ${ARTCADE_QML_ROOT}/Theme/Typography.qml
    ${ARTCADE_QML_ROOT}/Theme/Icons.qml
    ${ARTCADE_QML_ROOT}/Controls/AcToolbar.qml
    ${ARTCADE_QML_ROOT}/Controls/AcTabButton.qml
    ${ARTCADE_QML_ROOT}/Controls/AcSection.qml
    ${ARTCADE_QML_ROOT}/Controls/AcIconButton.qml
    ${ARTCADE_QML_ROOT}/Controls/AcButton.qml
    ${ARTCADE_QML_ROOT}/Controls/AcToolButton.qml
    ${ARTCADE_QML_ROOT}/Controls/AcTextField.qml
    ${ARTCADE_QML_ROOT}/Controls/AcWindowButton.qml
    ${ARTCADE_QML_ROOT}/Controls/AcPanelHeader.qml
    ${ARTCADE_QML_ROOT}/Controls/AcSplitterHandle.qml
    ${ARTCADE_QML_ROOT}/Controls/AcWindowResizeFrame.qml
    ${ARTCADE_QML_ROOT}/Controls/AcTreeDelegate.qml
    ${ARTCADE_QML_ROOT}/Controls/AcLayerRow.qml
    ${ARTCADE_QML_ROOT}/Controls/AcEmptyHint.qml
    ${ARTCADE_QML_ROOT}/Controls/AcLogicColumn.qml
    ${ARTCADE_QML_ROOT}/Controls/AcLogicRuleCard.qml
    ${ARTCADE_QML_ROOT}/Controls/AcLogicPropertyEditor.qml
    ${ARTCADE_QML_ROOT}/Controls/AcLogicKeyCapture.qml
    ${ARTCADE_QML_ROOT}/Controls/AcNumberField.qml
    ${ARTCADE_QML_ROOT}/Controls/AcInspectorRow.qml
    ${ARTCADE_QML_ROOT}/Controls/AcIcon.qml
    ${ARTCADE_QML_ROOT}/Shell/TitleBar.qml
    ${ARTCADE_QML_ROOT}/Shell/ModeBar.qml
    ${ARTCADE_QML_ROOT}/Shell/WorkspaceBar.qml
    ${ARTCADE_QML_ROOT}/Shell/EditorActions.qml
    ${ARTCADE_QML_ROOT}/Shell/LeftSidebar.qml
    ${ARTCADE_QML_ROOT}/Shell/ViewportPlaceholder.qml
    ${ARTCADE_QML_ROOT}/Shell/LogicBoardView.qml
    ${ARTCADE_QML_ROOT}/Shell/InspectorPane.qml
    ${ARTCADE_QML_ROOT}/Shell/ConsolePane.qml
    ${ARTCADE_QML_ROOT}/Shell/StatusBar.qml
)

find_program(ARTCADE_QMLLINT_EXECUTABLE NAMES qmllint qmllint.exe
    HINTS ${Qt6_DIR}/../../../bin
    DOC "Qt qmllint executable"
)
if(ARTCADE_QMLLINT_EXECUTABLE)
    add_custom_target(artcade-qmllint
        COMMAND ${ARTCADE_QMLLINT_EXECUTABLE} ${ARTCADE_QML_LINT_FILES}
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        COMMENT "Running qmllint on ArtCade.Ui QML sources"
        VERBATIM
    )
else()
    message(STATUS "qmllint not found — artcade-qmllint target skipped")
endif()

find_program(ARTCADE_QMLFORMAT_EXECUTABLE NAMES qmlformat qmlformat.exe
    HINTS ${Qt6_DIR}/../../../bin
    DOC "Qt qmlformat executable"
)
if(ARTCADE_QMLFORMAT_EXECUTABLE)
    add_custom_target(artcade-qmlformat
        COMMAND ${ARTCADE_QMLFORMAT_EXECUTABLE} -i ${ARTCADE_QML_LINT_FILES}
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        COMMENT "Running qmlformat -i on ArtCade.Ui QML sources"
        VERBATIM
    )
endif()

message(STATUS "ArtCade Qt editor: artcade-editor-qt (Qt ${Qt6_VERSION})")

# Play launches the native Raylib `game` target as a separate process (not embedded).
# Copy game.exe beside the editor so resolveGameExecutable() finds it without env vars.
if(TARGET game)
    add_dependencies(artcade-editor-qt game)
    add_custom_command(TARGET artcade-editor-qt POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            $<TARGET_FILE:game>
            $<TARGET_FILE_DIR:artcade-editor-qt>/game.exe
        COMMENT "Copy game.exe beside artcade-editor-qt for Play"
        VERBATIM
    )
endif()

# Copy Qt runtime DLLs next to the exe after build (dev convenience; LGPL dynamic link).
find_program(ARTCADE_WINDEPLOYQT_EXECUTABLE NAMES windeployqt windeployqt.exe
    HINTS ${Qt6_DIR}/../../../bin
    DOC "Qt windeployqt"
)
if(ARTCADE_WINDEPLOYQT_EXECUTABLE AND WIN32)
    # $<IF:...> avoids empty argv under VERBATIM (empty Debug genex breaks windeployqt).
    add_custom_command(TARGET artcade-editor-qt POST_BUILD
        COMMAND ${ARTCADE_WINDEPLOYQT_EXECUTABLE}
            --qmldir "${CMAKE_SOURCE_DIR}/qml"
            $<IF:$<CONFIG:Debug>,--debug,--release>
            "$<TARGET_FILE:artcade-editor-qt>"
        COMMENT "windeployqt: deploy Qt DLLs beside artcade-editor-qt"
        VERBATIM
    )
endif()

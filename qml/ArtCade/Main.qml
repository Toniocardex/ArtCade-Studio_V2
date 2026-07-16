import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import QtQuick.Window
import ArtCade.Ui

/**
 * ArtCade Studio shell — presentation only.
 * ProjectDocument lives in EditorCoordinator (C++).
 */
ApplicationWindow {
    id: window

    width: 1600
    height: 900
    minimumWidth: 1100
    minimumHeight: 700
    visible: true
    title: EditorSession.hasProject
           ? ("ArtCade Studio — " + EditorSession.projectName
              + (EditorSession.dirty ? " *" : ""))
           : "ArtCade Studio"
    color: Theme.window
    flags: Qt.Window | Qt.FramelessWindowHint

    property bool allowClose: false

    onClosing: function(close) {
        if (allowClose) {
            close.accepted = true
            return
        }
        if (EditorSession.requestClose()) {
            close.accepted = true
        } else {
            close.accepted = false
        }
    }

    Connections {
        target: EditorSession
        function onCloseBlockedByDirty() { unsavedDialog.open() }
        function onCloseAccepted() {
            window.allowClose = true
            window.close()
        }
    }

    MessageDialog {
        id: unsavedDialog
        title: "Unsaved changes"
        text: "The project has unsaved changes."
        informativeText: "Save before closing, discard changes, or cancel."
        buttons: MessageDialog.Save | MessageDialog.Discard | MessageDialog.Cancel
        onButtonClicked: function(button, role) {
            if (button === MessageDialog.Save) {
                EditorSession.saveProject()
                if (!EditorSession.dirty) {
                    window.allowClose = true
                    window.close()
                }
            } else if (button === MessageDialog.Discard) {
                EditorSession.discardAndClose()
            }
        }
    }

    EditorActions {
        id: editorActions
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        TitleBar {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.titleBarHeight
            windowTarget: window
        }

        WorkspaceBar {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.workspaceBarHeight
            actions: editorActions
        }

        SplitView {
            id: mainSplit
            Layout.fillWidth: true
            Layout.fillHeight: true
            orientation: Qt.Horizontal
            handle: AcSplitterHandle {}

            LeftSidebar {
                SplitView.preferredWidth: Metrics.leftSidebarDefaultWidth
                SplitView.minimumWidth: 220
                SplitView.maximumWidth: 450
                SplitView.fillHeight: true
            }

            SplitView {
                id: centerSplit
                orientation: Qt.Vertical
                SplitView.fillWidth: true
                SplitView.fillHeight: true
                SplitView.minimumWidth: 500
                handle: AcSplitterHandle {}

                ViewportPlaceholder {
                    SplitView.fillHeight: true
                    SplitView.minimumHeight: 200
                }

                ConsolePane {
                    SplitView.preferredHeight: EditorSession.hasProject
                                              ? Metrics.consoleDefaultHeight
                                              : Metrics.panelHeaderHeight
                    SplitView.minimumHeight: Metrics.panelHeaderHeight
                    SplitView.fillWidth: true
                }
            }

            InspectorPane {
                SplitView.preferredWidth: Metrics.inspectorDefaultWidth
                SplitView.minimumWidth: 270
                SplitView.maximumWidth: 480
                SplitView.fillHeight: true
            }
        }

        StatusBar {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.statusBarHeight
        }
    }

    // Native OS resize (snapping / animations) — above content, not ProjectDoc.
    AcWindowResizeFrame {
        anchors.fill: parent
        z: 1000
        windowTarget: window
    }
}

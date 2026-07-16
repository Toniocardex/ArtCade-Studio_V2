import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    /** EditorActions instance from Main — shared Action objects for shortcuts. */
    property var actions: null

    color: Theme.chrome
    height: Metrics.workspaceBarHeight

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingMd
        anchors.rightMargin: Metrics.spacingMd
        spacing: Metrics.spacingSm

        // Mode tabs: click sets mode; matching Action owns the shortcut only
        // (do not bind action: here — that would also rewrite button text).
        AcTabButton {
            text: "Canvas"
            iconSource: Icons.canvas
            active: EditorSession.activeMode === "canvas"
            onClicked: EditorSession.activeMode = "canvas"
        }
        AcTabButton {
            text: "Logic Board"
            iconSource: Icons.logic
            active: EditorSession.activeMode === "logic"
            onClicked: EditorSession.activeMode = "logic"
        }
        AcTabButton {
            text: "Script Editor"
            iconSource: Icons.script
            active: EditorSession.activeMode === "script"
            onClicked: EditorSession.activeMode = "script"
        }

        Item { Layout.fillWidth: true }

        Rectangle {
            Layout.preferredWidth: 1
            Layout.preferredHeight: 22
            color: Theme.borderSubtle
        }

        AcToolButton {
            iconSource: Icons.undo
            action: root.actions ? root.actions.undo : null
            ToolTip.visible: hovered
            ToolTip.text: "Undo (Ctrl+Z)"
        }
        AcToolButton {
            iconSource: Icons.redo
            action: root.actions ? root.actions.redo : null
            ToolTip.visible: hovered
            ToolTip.text: "Redo (Ctrl+Y)"
        }

        Rectangle {
            Layout.preferredWidth: 1
            Layout.preferredHeight: 22
            color: Theme.borderSubtle
        }

        AcButton {
            text: "Save"
            iconSource: Icons.save
            action: root.actions ? root.actions.save : null
        }
        AcButton {
            text: "Build"
            iconSource: Icons.build
            enabled: false
            ToolTip.visible: hovered
            ToolTip.text: "Build — coming next"
        }
        AcButton {
            text: EditorSession.playing ? "Stop" : "Play"
            iconSource: EditorSession.playing ? Icons.stop : Icons.play
            primary: true
            action: root.actions ? root.actions.playStop : null
        }

        Text {
            text: EditorSession.playing ? "PLAYING" : "EDIT"
            color: EditorSession.playing ? Theme.success : Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
            font.weight: Font.DemiBold
            Layout.alignment: Qt.AlignVCenter
            Layout.leftMargin: Metrics.spacingSm
        }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 1
        color: Theme.borderSubtle
    }
}

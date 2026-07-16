import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.chrome
    height: Metrics.workspaceBarHeight

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingMd
        anchors.rightMargin: Metrics.spacingMd
        spacing: Metrics.spacingSm

        AcTabButton {
            text: "Canvas"
            glyph: Icons.canvas
            active: EditorSession.activeMode === "canvas"
            onClicked: EditorSession.activeMode = "canvas"
        }
        AcTabButton {
            text: "Logic Board"
            glyph: Icons.logic
            active: EditorSession.activeMode === "logic"
            onClicked: EditorSession.activeMode = "logic"
        }
        AcTabButton {
            text: "Script Editor"
            glyph: Icons.script
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
            glyph: Icons.undo
            ToolTip.visible: hovered
            ToolTip.text: "Undo"
            onClicked: EditorSession.undo()
        }
        AcToolButton {
            glyph: Icons.redo
            ToolTip.visible: hovered
            ToolTip.text: "Redo"
            onClicked: EditorSession.redo()
        }

        Rectangle {
            Layout.preferredWidth: 1
            Layout.preferredHeight: 22
            color: Theme.borderSubtle
        }

        AcButton {
            text: "Save"
            onClicked: EditorSession.saveProject()
        }
        AcButton {
            text: "Build"
            enabled: false
            ToolTip.visible: hovered
            ToolTip.text: "Build — coming next"
        }
        AcButton {
            text: EditorSession.playing ? "Stop" : "Play"
            primary: true
            onClicked: EditorSession.playing ? EditorSession.stopPlay() : EditorSession.startPlay()
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

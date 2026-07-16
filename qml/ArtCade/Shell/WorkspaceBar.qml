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

    // Left zone: brand (spec §2 / §19 — independent of title-bar chrome).
    Text {
        anchors.left: parent.left
        anchors.leftMargin: Metrics.spacingLg
        anchors.verticalCenter: parent.verticalCenter
        text: "ArtCade"
        color: Theme.textPrimary
        font.family: Typography.family
        font.pixelSize: Typography.sizeWorkspace
        font.weight: Font.DemiBold
    }

    // Centre zone: the three main workspaces, truly centred in the bar
    // (independent of the left/right zones widths).
    Row {
        id: workspaceTabs
        anchors.centerIn: parent
        spacing: Metrics.spacingSm

        // Mode tabs: click sets mode; matching Action owns the shortcut only
        // (do not bind action: here — that would also rewrite button text).
        AcTabButton {
            text: "Canvas"
            iconSource: Icons.canvas
            enabled: EditorSession.hasProject
            active: EditorSession.hasProject && EditorSession.activeMode === "canvas"
            onClicked: EditorSession.activeMode = "canvas"
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: EditorSession.hasProject
                          ? "Canvas — scene view (Ctrl+1)"
                          : "Open a project to use Canvas"
        }
        AcTabButton {
            text: "Logic Board"
            iconSource: Icons.logic
            enabled: EditorSession.hasProject
            active: EditorSession.hasProject && EditorSession.activeMode === "logic"
            onClicked: EditorSession.activeMode = "logic"
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: EditorSession.hasProject
                          ? "Logic Board — visual gameplay rules (Ctrl+2)"
                          : "Open a project to use Logic Board"
        }
        AcTabButton {
            text: "Script Editor"
            iconSource: Icons.script
            enabled: EditorSession.hasProject
            active: EditorSession.hasProject && EditorSession.activeMode === "script"
            onClicked: EditorSession.activeMode = "script"
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: EditorSession.hasProject
                          ? "Script Editor — Lua scripts (Ctrl+3)"
                          : "Open a project to use Script Editor"
        }
    }

    // Right zone: global commands.
    RowLayout {
        anchors.right: parent.right
        anchors.rightMargin: Metrics.spacingMd
        anchors.verticalCenter: parent.verticalCenter
        spacing: Metrics.spacingSm

        AcToolButton {
            iconSource: Icons.undo
            action: root.actions ? root.actions.undo : null
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: "Undo last authoring change (Ctrl+Z)"
        }
        AcToolButton {
            iconSource: Icons.redo
            action: root.actions ? root.actions.redo : null
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: "Redo last undone change (Ctrl+Y)"
        }

        Rectangle {
            Layout.preferredWidth: 1
            Layout.preferredHeight: 22
            color: Theme.borderSubtle
        }

        AcButton {
            text: "Save"
            iconSource: Icons.save
            enabled: EditorSession.hasProject && !EditorSession.playing
            action: root.actions ? root.actions.save : null
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: EditorSession.hasProject
                          ? "Save project to disk (Ctrl+S)"
                          : "Open a project to save"
        }
        AcButton {
            text: "Build"
            iconSource: Icons.build
            enabled: false
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: "Build — coming next"
        }
        AcButton {
            text: EditorSession.playing ? "Stop" : "Play"
            iconSource: EditorSession.playing ? Icons.stop : Icons.play
            primary: true
            enabled: EditorSession.hasProject
            action: root.actions ? root.actions.playStop : null
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: !EditorSession.hasProject
                         ? "Open a project to Play"
                         : EditorSession.playing
                         ? "Stop Play (F5 or Esc)"
                         : "Play in game.exe — save first (F5)"
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

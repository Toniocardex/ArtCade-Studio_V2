import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import ArtCade.Ui

/**
 * Project Home — true no-project landing (Passata 2 / spec §9).
 * Presentation only: New / Open / Recent → EditorSession intents.
 */
Item {
    id: root

    Column {
        anchors.centerIn: parent
        width: Math.min(parent.width - Metrics.spacingXl * 4, 420)
        spacing: Metrics.spacingLg

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "ArtCade Studio"
            color: Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeObjectTitle
            font.weight: Font.DemiBold
        }

        Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: "Create a new project or open an existing one."
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeBody
        }

        Row {
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Metrics.spacingSm

            AcButton {
                text: "New Project"
                primary: true
                onClicked: newDialog.open()
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: "Create an empty project.json and open it"
            }
            AcButton {
                text: "Open Project"
                onClicked: openDialog.open()
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: "Open an existing project.json"
            }
            AcButton {
                visible: EditorSession.developerMode
                text: "Load Fixture"
                onClicked: EditorSession.openSliceFixture()
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: "Developer: load the Qt slice fixture (Ctrl+Shift+F)"
            }
        }

        Column {
            visible: EditorSession.recentProjects.length > 0
            width: parent.width
            spacing: Metrics.spacingSm

            Text {
                text: "Recent Projects"
                color: Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizePanelTitle
                font.weight: Font.DemiBold
            }

            Repeater {
                model: EditorSession.recentProjects

                delegate: Rectangle {
                    required property var modelData
                    width: parent.width
                    height: Metrics.controlHeight + 4
                    radius: Metrics.radiusControl
                    color: recentMa.containsMouse ? Theme.controlHover : Theme.control
                    border.width: 1
                    border.color: Theme.borderSubtle

                    Text {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.leftMargin: Metrics.spacingMd
                        anchors.rightMargin: Metrics.spacingMd
                        text: modelData.name
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                        elide: Text.ElideRight
                    }

                    MouseArea {
                        id: recentMa
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: EditorSession.openProject(modelData.path)
                    }
                }
            }
        }
    }

    FileDialog {
        id: openDialog
        title: "Open ArtCade project"
        nameFilters: ["ArtCade project (project.json *.json)", "All files (*)"]
        fileMode: FileDialog.OpenFile
        onAccepted: EditorSession.openProject(selectedFile)
    }

    FileDialog {
        id: newDialog
        title: "Create ArtCade project"
        nameFilters: ["ArtCade project (*.json)"]
        fileMode: FileDialog.SaveFile
        defaultSuffix: "json"
        onAccepted: EditorSession.createProject(selectedFile)
    }
}

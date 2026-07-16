import QtQuick
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.chrome
    height: Metrics.statusBarHeight

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingMd
        anchors.rightMargin: Metrics.spacingMd
        spacing: Metrics.spacingMd

        Text {
            text: "Ready"
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
        }
        Text {
            text: "No errors"
            color: Theme.success
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
        }

        Rectangle {
            Layout.preferredWidth: 1
            Layout.preferredHeight: 14
            color: Theme.borderSubtle
        }

        Text {
            text: EditorSession.statusMessage
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
            elide: Text.ElideRight
            Layout.fillWidth: true
            Layout.maximumWidth: 360
        }

        Item { Layout.fillWidth: true }

        Text {
            text: EditorSession.hasProject
                  ? ("Scene · Zoom · Layer: "
                     + (EditorSession.activeLayerId.length ? EditorSession.activeLayerId : "—"))
                  : "No scene"
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
        }

        Text {
            text: EditorSession.hasSelection
                  ? ("Select: " + EditorSession.selectedName)
                  : "Select: None"
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
        }

        Text {
            text: EditorSession.playing ? "PLAY" : "EDIT"
            color: EditorSession.playing ? Theme.success : Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
            font.weight: Font.DemiBold
        }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: 1
        color: Theme.border
    }
}

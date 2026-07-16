import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Polished Layers panel row — eye toggle, lock badge, active accent.
 * Model roles are required properties (ListView injects them).
 * Intents only: visibility / active layer → EditorSession.
 */
Item {
    id: root

    required property string display
    required property string layerId
    required property bool layerVisible
    required property bool locked
    required property bool active

    signal activateRequested(string layerId)
    signal visibilityToggled(string layerId, bool visible)

    width: ListView.view ? ListView.view.width : 200
    implicitHeight: Metrics.controlHeight + 4
    height: implicitHeight

    Rectangle {
        id: chrome
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingXs
        anchors.rightMargin: Metrics.spacingXs
        anchors.topMargin: 1
        anchors.bottomMargin: 1
        radius: Metrics.radiusSmall
        color: {
            if (root.active)
                return Theme.selection
            if (rowMa.containsMouse)
                return Theme.controlHover
            return "transparent"
        }
        border.width: root.active ? 1 : 0
        border.color: Theme.accent

        Rectangle {
            visible: root.active
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.margins: 1
            width: 3
            radius: 1
            color: Theme.accent
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: Metrics.spacingSm + (root.active ? 2 : 0)
            anchors.rightMargin: Metrics.spacingXs
            spacing: Metrics.spacingXs

            AcIcon {
                source: Icons.layer
                size: 14
                color: root.active ? Theme.textPrimary
                     : root.layerVisible ? Theme.textSecondary : Theme.textMuted
                Layout.alignment: Qt.AlignVCenter
                Layout.leftMargin: Metrics.spacingXs
            }

            Text {
                text: root.display
                color: root.layerVisible ? Theme.textPrimary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeSm
                font.weight: root.active ? Font.DemiBold : Font.Normal
                elide: Text.ElideRight
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignVCenter
                verticalAlignment: Text.AlignVCenter
            }

            ToolButton {
                id: eyeBtn
                implicitWidth: 26
                implicitHeight: 26
                padding: 0
                focusPolicy: Qt.NoFocus
                z: 2
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: root.layerVisible ? "Hide layer" : "Show layer"

                background: Rectangle {
                    radius: Metrics.radiusSmall
                    color: eyeBtn.down ? Theme.controlPressed
                         : eyeBtn.hovered ? Theme.control : "transparent"
                }
                contentItem: AcIcon {
                    anchors.centerIn: parent
                    source: root.layerVisible ? Icons.eye : Icons.eyeOff
                    size: 14
                    color: root.layerVisible ? Theme.textPrimary : Theme.textMuted
                }
                onClicked: root.visibilityToggled(root.layerId, !root.layerVisible)
            }

            Item {
                implicitWidth: 22
                implicitHeight: 26
                Layout.alignment: Qt.AlignVCenter
                z: 2

                AcIcon {
                    anchors.centerIn: parent
                    source: Icons.lock
                    size: 13
                    color: root.locked ? Theme.warning : Theme.textMuted
                    opacity: root.locked ? 1.0 : (rowMa.containsMouse || root.active ? 0.5 : 0.28)
                }
                ToolTip.visible: lockHover.hovered
                ToolTip.delay: 400
                ToolTip.text: root.locked ? "Layer locked (pick blocked)" : "Layer unlocked"
                HoverHandler { id: lockHover }
            }
        }

        MouseArea {
            id: rowMa
            anchors.fill: parent
            anchors.rightMargin: 52 // leave eye + lock hit targets alone
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.activateRequested(root.layerId)
        }
    }
}

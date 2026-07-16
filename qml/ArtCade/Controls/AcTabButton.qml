import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Workspace mode / segmented tab.
 */
Button {
    id: root

    property bool active: false
    property string glyph: ""

    implicitHeight: Metrics.controlHeight + 4
    implicitWidth: Math.max(88, contentItem.implicitWidth + Metrics.spacingLg * 2)
    padding: Metrics.spacingSm
    leftPadding: Metrics.spacingMd
    rightPadding: Metrics.spacingMd
    focusPolicy: Qt.StrongFocus

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: root.active ? Theme.accent
             : root.down ? Theme.controlPressed
             : root.hovered ? Theme.controlHover
             : "transparent"
    }

    contentItem: Row {
        spacing: Metrics.spacingSm
        Text {
            visible: root.glyph.length > 0
            text: root.glyph
            color: root.active ? "#FFFFFF" : Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: root.text
            color: root.active ? "#FFFFFF" : Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
            font.weight: root.active ? Font.DemiBold : Font.Normal
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}

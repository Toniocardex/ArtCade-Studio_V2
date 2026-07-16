import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Themed context-menu row — hover neutral, primary text, no system palette.
 */
MenuItem {
    id: root

    implicitHeight: 28
    padding: 0
    leftPadding: 8
    rightPadding: 8

    contentItem: Text {
        text: root.text
        color: root.enabled ? Theme.textPrimary : Theme.textDisabled
        font.family: Typography.family
        font.pixelSize: Typography.sizeToolbar
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }

    background: Rectangle {
        radius: Metrics.radiusControl
        color: root.highlighted ? Theme.controlHover : "transparent"
    }
}

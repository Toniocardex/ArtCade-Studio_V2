import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Themed context-menu row (flat zinc, no system palette).
 */
MenuItem {
    id: root

    implicitHeight: 26

    contentItem: Text {
        leftPadding: Metrics.spacingMd
        rightPadding: Metrics.spacingMd
        text: root.text
        color: root.enabled ? Theme.textPrimary : Theme.textMuted
        font.family: Typography.family
        font.pixelSize: Typography.sizeSm
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: root.highlighted ? Theme.controlHover : "transparent"
    }
}

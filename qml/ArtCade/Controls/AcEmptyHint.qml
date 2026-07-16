import QtQuick
import ArtCade.Ui

/**
 * Centered empty-state hint for dock lists (Hierarchy / Layers / Assets).
 * Not a second data authority — presentation only.
 */
Item {
    id: root

    property string message: "No items"
    property string hint: ""

    anchors.fill: parent
    z: 2

    Column {
        anchors.centerIn: parent
        anchors.verticalCenterOffset: -Metrics.spacingLg
        width: Math.min(parent.width - Metrics.spacingXl * 2, 220)
        spacing: Metrics.spacingXs

        Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: root.message
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
            font.weight: Font.DemiBold
        }
        Text {
            visible: root.hint.length > 0
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: root.hint
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
        }
    }
}

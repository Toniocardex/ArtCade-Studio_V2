import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Primary / secondary text button (Save, Build, Add Object).
 */
Button {
    id: root

    property bool primary: false
    property bool destructive: false

    implicitHeight: Metrics.controlHeight
    implicitWidth: Math.max(72, contentItem.implicitWidth + Metrics.spacingLg * 2)
    padding: Metrics.spacingSm
    leftPadding: Metrics.spacingMd
    rightPadding: Metrics.spacingMd
    focusPolicy: Qt.StrongFocus

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: {
            if (!root.enabled)
                return Theme.control
            if (root.primary) {
                if (root.down)
                    return Theme.accent
                if (root.hovered)
                    return Theme.accentHover
                return Theme.accent
            }
            if (root.down)
                return Theme.controlPressed
            if (root.hovered)
                return Theme.controlHover
            return Theme.control
        }
        border.width: root.primary ? 0 : 1
        border.color: root.activeFocus ? Theme.accent
                     : root.primary ? "transparent"
                     : Theme.border
    }

    contentItem: Text {
        text: root.text
        color: {
            if (!root.enabled)
                return Theme.textMuted
            if (root.primary)
                return "#FFFFFF"
            if (root.destructive)
                return Theme.error
            return Theme.textPrimary
        }
        font.family: Typography.family
        font.pixelSize: Typography.sizeSm
        font.weight: root.primary ? Font.DemiBold : Font.Normal
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
}

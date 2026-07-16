import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Compact text tool button (legacy callers — prefer AcToolButton / AcButton).
 */
Button {
    id: root

    implicitHeight: Metrics.controlHeight
    implicitWidth: Math.max(Metrics.controlHeight, contentItem.implicitWidth + Metrics.spacingMd)
    padding: Metrics.spacingXs
    focusPolicy: Qt.StrongFocus

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: root.down ? Theme.controlPressed
             : root.hovered ? Theme.controlHover
             : "transparent"
        border.color: root.activeFocus ? Theme.accent : "transparent"
        border.width: root.activeFocus ? 1 : 0
    }

    contentItem: Text {
        text: root.text
        color: root.enabled ? Theme.textPrimary : Theme.textMuted
        font.family: Typography.family
        font.pixelSize: Typography.sizeSm
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
}

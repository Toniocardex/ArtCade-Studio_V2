import QtQuick
import QtQuick.Controls
import ArtCade.Ui

TextField {
    id: root

    implicitHeight: Metrics.controlHeight
    leftPadding: Metrics.spacingMd
    rightPadding: Metrics.spacingMd
    color: Theme.textPrimary
    placeholderTextColor: Theme.textMuted
    selectionColor: Theme.accent
    selectedTextColor: "#FFFFFF"
    font.family: Typography.family
    font.pixelSize: Typography.sizeBody
    selectByMouse: true

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: Theme.control
        border.width: 1
        border.color: root.activeFocus ? Theme.accent
                     : root.hovered ? Theme.border
                     : Theme.borderSubtle
    }
}

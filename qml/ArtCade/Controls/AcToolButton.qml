import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

ToolButton {
    id: root

    property string glyph: ""
    property bool active: false

    implicitWidth: Metrics.toolButtonSize
    implicitHeight: Metrics.toolButtonSize
    padding: 0
    focusPolicy: Qt.StrongFocus

    contentItem: Text {
        text: root.glyph.length > 0 ? root.glyph : root.text
        color: !root.enabled ? Theme.textMuted
             : (root.checked || root.active) ? Theme.textPrimary
             : Theme.textSecondary
        font.family: Typography.family
        font.pixelSize: Typography.sizeSm
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: {
            if (root.down)
                return Theme.controlPressed
            if (root.checked || root.active)
                return Theme.selection
            if (root.hovered)
                return Theme.controlHover
            return "transparent"
        }
        border.width: (root.checked || root.active) ? 1 : 0
        border.color: Theme.accent
    }
}

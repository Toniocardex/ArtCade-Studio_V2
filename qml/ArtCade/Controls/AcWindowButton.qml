import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Title-bar window control (minimize / maximize / close).
 */
Button {
    id: root

    property string glyph: ""
    property bool destructive: false

    implicitWidth: 40
    implicitHeight: Metrics.titleBarHeight
    padding: 0
    focusPolicy: Qt.NoFocus

    background: Rectangle {
        color: {
            if (root.destructive && root.hovered)
                return Theme.error
            if (root.down)
                return Theme.controlPressed
            if (root.hovered)
                return Theme.controlHover
            return "transparent"
        }
    }

    contentItem: Text {
        text: root.glyph.length > 0 ? root.glyph : root.text
        color: root.destructive && root.hovered ? "#FFFFFF"
             : root.enabled ? Theme.textSecondary : Theme.textMuted
        font.family: Typography.family
        font.pixelSize: Typography.sizeMd
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }
}

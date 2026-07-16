import QtQuick
import QtQuick.Controls
import ArtCade.Ui

Button {
    id: root

    property url iconSource
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

    contentItem: Item {
        AcIcon {
            anchors.centerIn: parent
            source: root.iconSource
            size: Metrics.iconSize
            color: root.destructive && root.hovered ? "#FFFFFF"
                 : root.enabled ? Theme.textSecondary : Theme.textMuted
            visible: root.iconSource.toString().length > 0
        }
        Text {
            anchors.centerIn: parent
            visible: root.iconSource.toString().length === 0
            text: root.glyph.length > 0 ? root.glyph : root.text
            color: root.destructive && root.hovered ? "#FFFFFF"
                 : root.enabled ? Theme.textSecondary : Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeMd
        }
    }
}

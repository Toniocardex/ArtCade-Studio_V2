import QtQuick
import QtQuick.Controls
import ArtCade.Ui

ToolButton {
    id: root

    property url iconSource
    property bool active: false
    /** @deprecated Prefer iconSource — kept empty for API compatibility. */
    property string glyph: ""

    implicitWidth: Metrics.toolButtonSize
    implicitHeight: Metrics.toolButtonSize
    padding: 0
    focusPolicy: Qt.StrongFocus

    contentItem: Item {
        AcIcon {
            anchors.centerIn: parent
            source: root.iconSource
            size: Metrics.iconSize
            color: !root.enabled ? Theme.textMuted
                 : (root.checked || root.active) ? Theme.textPrimary
                 : Theme.textPrimary
            visible: root.iconSource.toString().length > 0
        }
        Text {
            anchors.centerIn: parent
            visible: root.iconSource.toString().length === 0
            text: root.glyph.length > 0 ? root.glyph : root.text
            color: !root.enabled ? Theme.textMuted
                 : (root.checked || root.active) ? Theme.textPrimary
                 : Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
        }
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
        // Accent is reserved for focus — active tools sit on the neutral
        // selected surface only.
        border.width: root.activeFocus ? 1 : 0
        border.color: Theme.accent
    }
}

import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Primary / secondary text button (Save, Build, Add Object).
 * Optional iconSource shows a tinted AcIcon beside the label.
 */
Button {
    id: root

    property bool primary: false
    property bool destructive: false
    property url iconSource

    implicitHeight: Metrics.controlHeight
    implicitWidth: Math.max(72, contentItem.implicitWidth + leftPadding + rightPadding)
    padding: Metrics.spacingSm
    leftPadding: Metrics.spacingMd
    rightPadding: Metrics.spacingMd
    focusPolicy: Qt.StrongFocus

    readonly property color _labelColor: {
        if (!root.enabled)
            return Theme.textMuted
        if (root.primary)
            return "#FFFFFF"
        if (root.destructive)
            return Theme.error
        return Theme.textPrimary
    }

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

    // Item (not Row) owns assignable implicit* — Row's implicitWidth is read-only in Qt 6.8.
    contentItem: Item {
        implicitWidth: row.implicitWidth
        implicitHeight: row.implicitHeight

        Row {
            id: row
            anchors.centerIn: parent
            spacing: Metrics.spacingXs

            AcIcon {
                visible: root.iconSource.toString().length > 0
                source: root.iconSource
                size: Metrics.iconSize
                color: root._labelColor
                anchors.verticalCenter: parent.verticalCenter
            }
            Text {
                text: root.text
                color: root._labelColor
                font.family: Typography.family
                font.pixelSize: Typography.sizeSm
                font.weight: root.primary ? Font.DemiBold : Font.Normal
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }
}

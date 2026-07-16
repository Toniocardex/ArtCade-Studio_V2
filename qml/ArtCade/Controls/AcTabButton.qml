import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Workspace tab — no accent fill: active = elevated neutral surface,
 * primary text, thin accent underline. Inactive = transparent + secondary.
 */
Button {
    id: root

    property url iconSource
    property string glyph: ""
    property bool active: false

    implicitHeight: Metrics.controlHeight + 4
    implicitWidth: Math.max(88, contentItem.implicitWidth + Metrics.spacingLg * 2)
    padding: Metrics.spacingSm
    leftPadding: Metrics.spacingMd
    rightPadding: Metrics.spacingMd
    focusPolicy: Qt.StrongFocus

    background: Rectangle {
        radius: 2
        color: root.active ? Theme.selection
             : root.down ? Theme.controlPressed
             : root.hovered ? Theme.controlHover
             : "transparent"
        border.width: root.activeFocus ? 1 : 0
        border.color: Theme.accent

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.leftMargin: Metrics.spacingMd
            anchors.rightMargin: Metrics.spacingMd
            height: 2
            radius: 1
            color: Theme.accent
            visible: root.active
        }
    }

    contentItem: Row {
        spacing: Metrics.spacingSm
        AcIcon {
            visible: root.iconSource.toString().length > 0
            anchors.verticalCenter: parent.verticalCenter
            source: root.iconSource
            size: Metrics.iconSize
            color: root.active ? Theme.textPrimary : Theme.textSecondary
        }
        Text {
            visible: root.glyph.length > 0 && root.iconSource.toString().length === 0
            text: root.glyph
            color: root.active ? Theme.textPrimary : Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeMd
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: root.text
            color: root.active ? Theme.textPrimary : Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeMd
            font.weight: Font.DemiBold
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}

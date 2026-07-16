import QtQuick
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Compact collapsible section header (Inspector / dock groups).
 */
ColumnLayout {
    id: root

    property string title: ""
    property bool expanded: true
    property bool uppercase: true
    default property alias content: body.data

    spacing: 0
    Layout.fillWidth: true

    Rectangle {
        Layout.fillWidth: true
        Layout.preferredHeight: Metrics.panelHeaderHeight
        color: Theme.panelRaised

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: Metrics.spacingMd
            anchors.rightMargin: Metrics.spacingMd
            spacing: Metrics.spacingSm

            Text {
                text: root.uppercase ? root.title.toUpperCase() : root.title
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                font.weight: Font.DemiBold
                Layout.fillWidth: true
            }

            AcIcon {
                source: Icons.chevron
                size: 12
                color: Theme.textSecondary
                rotation: root.expanded ? 0 : -90
            }
        }

        MouseArea {
            anchors.fill: parent
            onClicked: root.expanded = !root.expanded
        }

        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 1
            color: Theme.borderSubtle
        }
    }

    ColumnLayout {
        id: body
        visible: root.expanded
        Layout.fillWidth: true
        spacing: Metrics.spacingXs
    }
}

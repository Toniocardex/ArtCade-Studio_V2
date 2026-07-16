import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One row in a Logic Board catalog popup (When / Also / Then).
 * Distinguishes current value vs hover/keyboard focus — presentation only.
 */
ItemDelegate {
    id: root

    property string typeId: ""
    property string title: ""
    property string description: ""
    property bool isCurrent: false

    readonly property bool isHot: root.highlighted || root.hovered

    hoverEnabled: true
    implicitHeight: description.length > 0 ? 46 : 32
    padding: 0

    contentItem: RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingXs
        anchors.rightMargin: Metrics.spacingSm
        spacing: Metrics.spacingSm

        Rectangle {
            Layout.preferredWidth: 2
            Layout.fillHeight: true
            Layout.topMargin: 6
            Layout.bottomMargin: 6
            radius: 1
            color: Theme.accent
            opacity: root.isCurrent ? 1.0 : (root.isHot ? 0.55 : 0.0)
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.alignment: Qt.AlignVCenter
            spacing: 1

            Text {
                Layout.fillWidth: true
                text: root.title
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                font.weight: root.isCurrent || root.isHot ? Font.DemiBold : Font.Normal
                elide: Text.ElideRight
            }

            Text {
                Layout.fillWidth: true
                visible: root.description.length > 0
                text: root.description
                color: root.isHot ? Theme.textSecondary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: 10
                wrapMode: Text.WordWrap
                maximumLineCount: 2
                elide: Text.ElideRight
            }
        }

        Text {
            visible: root.isCurrent
            text: "●"
            color: Theme.accent
            font.pixelSize: 8
            Layout.alignment: Qt.AlignVCenter
        }
    }

    background: Rectangle {
        radius: Metrics.radiusSmall
        color: {
            if (root.isHot)
                return Theme.controlHover
            if (root.isCurrent)
                return Qt.alpha(Theme.accent, 0.10)
            return "transparent"
        }
        border.width: root.isHot ? 1 : 0
        border.color: Qt.alpha(Theme.accent, 0.35)
    }
}

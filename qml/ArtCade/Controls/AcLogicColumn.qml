import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic Board column (When / Also require / Then) — presentation only.
 */
Item {
    id: root

    property string title: ""
    property string subtitle: ""
    property color accent: Theme.accent
    property string emptyText: "Empty"
    property var blocks: []

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Metrics.spacingMd
        spacing: Metrics.spacingSm

        RowLayout {
            spacing: Metrics.spacingSm
            Layout.fillWidth: true

            Rectangle {
                width: 3
                height: 14
                radius: 1
                color: root.accent
            }
            Column {
                Layout.fillWidth: true
                spacing: 1
                Text {
                    text: root.title
                    color: Theme.textPrimary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                    font.weight: Font.DemiBold
                }
                Text {
                    text: root.subtitle
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: Metrics.radiusSmall
            color: Theme.control
            border.color: Theme.borderSubtle
            border.width: 1

            ListView {
                anchors.fill: parent
                anchors.margins: Metrics.spacingSm
                clip: true
                model: root.blocks
                spacing: Metrics.spacingXs
                visible: root.blocks.length > 0

                delegate: Rectangle {
                    required property string modelData
                    width: ListView.view.width
                    height: Metrics.controlHeight
                    radius: Metrics.radiusSmall
                    color: Theme.panelRaised
                    border.color: Theme.borderSubtle
                    border.width: 1

                    Text {
                        anchors.fill: parent
                        anchors.leftMargin: Metrics.spacingSm
                        anchors.rightMargin: Metrics.spacingSm
                        verticalAlignment: Text.AlignVCenter
                        text: modelData
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                        elide: Text.ElideRight
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                visible: root.blocks.length === 0
                width: parent.width - Metrics.spacingXl
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
                text: EditorSession.logicRuleCount === 0
                      ? "Add a rule to start"
                      : root.emptyText
                color: Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
            }
        }
    }
}

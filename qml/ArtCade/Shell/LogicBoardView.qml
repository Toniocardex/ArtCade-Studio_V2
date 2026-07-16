import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Logic Board workspace shell — type-targeted rulesheet presentation.
 * QML shows derived session state only; mutations come later via commands.
 */
Rectangle {
    id: root

    color: Theme.panel

    readonly property bool hasTypeTarget: EditorSession.selectedObjectTypeId.length > 0

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Module header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight + Metrics.spacingSm
            color: Theme.chrome

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingMd
                anchors.rightMargin: Metrics.spacingMd
                spacing: Metrics.spacingMd

                Column {
                    Layout.fillWidth: true
                    spacing: 2

                    Text {
                        text: "Logic Board"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeSm
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: {
                            if (!EditorSession.hasProject)
                                return "Open a project to author gameplay rules"
                            if (!root.hasTypeTarget)
                                return "Select a scene object — rules apply to its object type"
                            const rules = EditorSession.logicRuleCount
                            const ruleLabel = rules === 1 ? "1 rule" : (rules + " rules")
                            return "Applies to: " + EditorSession.selectedObjectTypeName
                                   + "  ·  " + ruleLabel
                        }
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                        elide: Text.ElideRight
                        width: parent.width
                    }
                }

                AcButton {
                    text: "+ Add Rule"
                    primary: true
                    enabled: false
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add rule — When / Also require / Then (coming next)"
                }
            }

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: Theme.borderSubtle
            }
        }

        // When / Also require / Then columns
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            visible: EditorSession.hasProject && root.hasTypeTarget

            LogicColumn {
                Layout.fillWidth: true
                Layout.fillHeight: true
                title: "When"
                subtitle: "Trigger"
                accent: Theme.accent
            }

            Rectangle {
                Layout.fillHeight: true
                Layout.preferredWidth: 1
                color: Theme.borderSubtle
            }

            LogicColumn {
                Layout.fillWidth: true
                Layout.fillHeight: true
                title: "Also require…"
                subtitle: "Conditions (optional)"
                accent: Theme.warning
            }

            Rectangle {
                Layout.fillHeight: true
                Layout.preferredWidth: 1
                color: Theme.borderSubtle
            }

            LogicColumn {
                Layout.fillWidth: true
                Layout.fillHeight: true
                title: "Then"
                subtitle: "Actions"
                accent: Theme.success
            }
        }

        // Empty / no-target states
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: !EditorSession.hasProject || !root.hasTypeTarget

            AcEmptyHint {
                message: !EditorSession.hasProject ? "No project open"
                                                   : "No object type selected"
                hint: !EditorSession.hasProject
                      ? "Open a project or load Fixture, then switch back to Logic Board"
                      : "Pick an object in Hierarchy or on the Canvas — rules belong to the type"
            }
        }
    }

    component LogicColumn: Item {
        id: col
        property string title: ""
        property string subtitle: ""
        property color accent: Theme.accent

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
                    color: col.accent
                }
                Column {
                    Layout.fillWidth: true
                    spacing: 1
                    Text {
                        text: col.title
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeSm
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: col.subtitle
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

                Text {
                    anchors.centerIn: parent
                    width: parent.width - Metrics.spacingXl
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: EditorSession.logicRuleCount === 0
                          ? "No blocks yet"
                          : "Rules loaded — block editor coming next"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                }
            }
        }
    }
}

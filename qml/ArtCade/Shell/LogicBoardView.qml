import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Logic Board workspace — type-targeted rulesheet.
 * Mutations only via EditorSession.addLogicRule (command path).
 */
Rectangle {
    id: root

    color: Theme.panel

    readonly property bool hasTypeTarget: EditorSession.selectedObjectTypeId.length > 0

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

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
                    enabled: EditorSession.hasProject && root.hasTypeTarget && !EditorSession.playing
                    onClicked: EditorSession.addLogicRule()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add a default When / Then rule on this object type"
                }

                AcButton {
                    text: "Delete Rule"
                    destructive: true
                    enabled: EditorSession.hasProject && root.hasTypeTarget
                             && EditorSession.selectedLogicRuleId.length > 0
                             && !EditorSession.playing
                    onClicked: EditorSession.removeLogicRule(EditorSession.selectedLogicRuleId)
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Delete the selected Logic rule (undoable)"
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

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            visible: EditorSession.hasProject && root.hasTypeTarget

            Rectangle {
                Layout.preferredWidth: 200
                Layout.fillHeight: true
                color: Theme.panelRaised

                ColumnLayout {
                    anchors.fill: parent
                    spacing: 0

                    Text {
                        Layout.fillWidth: true
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.topMargin: Metrics.spacingSm
                        Layout.bottomMargin: Metrics.spacingXs
                        text: "RULES"
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                        font.weight: Font.DemiBold
                    }

                    ListView {
                        id: rulesList
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        model: EditorSession.logicRuleIds
                        currentIndex: {
                            const ids = EditorSession.logicRuleIds
                            return ids.indexOf(EditorSession.selectedLogicRuleId)
                        }
                        boundsBehavior: Flickable.StopAtBounds

                        delegate: Rectangle {
                            required property string modelData
                            required property int index
                            width: rulesList.width
                            height: Metrics.controlHeight + 4
                            color: modelData === EditorSession.selectedLogicRuleId
                                   ? Theme.selection
                                   : (ruleMa.containsMouse ? Theme.controlHover : "transparent")

                            MouseArea {
                                id: ruleMa
                                anchors.fill: parent
                                anchors.rightMargin: 28
                                hoverEnabled: true
                                z: 0
                                onClicked: EditorSession.selectedLogicRuleId = modelData
                            }

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: Metrics.spacingMd
                                anchors.rightMargin: Metrics.spacingXs
                                spacing: Metrics.spacingXs
                                z: 1

                                Text {
                                    Layout.fillWidth: true
                                    text: modelData
                                    color: Theme.textPrimary
                                    font.family: Typography.family
                                    font.pixelSize: Typography.sizeSm
                                    elide: Text.ElideRight
                                }

                                AcToolButton {
                                    iconSource: Icons.close
                                    implicitWidth: 22
                                    implicitHeight: 22
                                    enabled: !EditorSession.playing
                                    ToolTip.visible: hovered
                                    ToolTip.delay: 400
                                    ToolTip.text: "Delete this rule"
                                    onClicked: EditorSession.removeLogicRule(modelData)
                                }
                            }
                        }

                        AcEmptyHint {
                            visible: EditorSession.logicRuleCount === 0
                            message: "No rules yet"
                            hint: "Click + Add Rule to create a When / Then rule"
                        }
                    }
                }

                Rectangle {
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    anchors.right: parent.right
                    width: 1
                    color: Theme.borderSubtle
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 0

                AcLogicColumn {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    title: "When"
                    subtitle: "Trigger"
                    accent: Theme.accent
                    emptyText: "No trigger"
                    blocks: EditorSession.selectedRuleTriggerTypeId.length > 0
                            ? [EditorSession.selectedRuleTriggerTypeId]
                            : []
                }

                Rectangle {
                    Layout.fillHeight: true
                    Layout.preferredWidth: 1
                    color: Theme.borderSubtle
                }

                AcLogicColumn {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    title: "Also require…"
                    subtitle: "Conditions (optional)"
                    accent: Theme.warning
                    emptyText: "None (always)"
                    blocks: EditorSession.selectedRuleConditionTypeIds
                }

                Rectangle {
                    Layout.fillHeight: true
                    Layout.preferredWidth: 1
                    color: Theme.borderSubtle
                }

                AcLogicColumn {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    title: "Then"
                    subtitle: "Actions"
                    accent: Theme.success
                    emptyText: "No actions"
                    blocks: EditorSession.selectedRuleActionTypeIds
                }
            }
        }

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
}

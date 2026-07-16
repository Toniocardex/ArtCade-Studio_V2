import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Logic Board workspace — type-targeted rulesheet, compact-first.
 * Rules render as compact rows; the selected rule expands inline.
 * Mutations only via EditorSession Logic commands (single write path).
 */
Rectangle {
    id: root

    color: Theme.panel

    readonly property bool hasTypeTarget: EditorSession.selectedObjectTypeId.length > 0
    /** UI density preference (presentation only — never dirties the project). */
    property bool comfortable: false

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: headerRow.implicitHeight + Metrics.spacingMd * 2
            color: Theme.chrome

            RowLayout {
                id: headerRow
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingMd
                anchors.rightMargin: Metrics.spacingMd
                anchors.topMargin: Metrics.spacingMd
                anchors.bottomMargin: Metrics.spacingMd
                spacing: Metrics.spacingMd

                Column {
                    Layout.fillWidth: true
                    spacing: 2

                    Text {
                        visible: root.hasTypeTarget
                        text: "Objects / " + EditorSession.selectedObjectTypeName
                        color: Theme.textMuted
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                    }

                    Row {
                        spacing: Metrics.spacingSm

                        Text {
                            text: root.hasTypeTarget ? EditorSession.selectedObjectTypeName
                                                     : "Logic Board"
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeLg
                            font.weight: Font.DemiBold
                        }

                        Rectangle {
                            visible: root.hasTypeTarget
                            anchors.verticalCenter: parent.verticalCenter
                            width: badgeText.implicitWidth + Metrics.spacingMd
                            height: 16
                            radius: 2
                            color: Qt.alpha(Theme.accent, 0.16)

                            Text {
                                id: badgeText
                                anchors.centerIn: parent
                                text: "OBJECT TYPE LOGIC"
                                color: Theme.accent
                                font.family: Typography.family
                                font.pixelSize: 9
                                font.weight: Font.DemiBold
                                font.letterSpacing: 0.5
                            }
                        }
                    }

                    Text {
                        text: {
                            if (!EditorSession.hasProject)
                                return "Open a project to author gameplay rules"
                            if (!root.hasTypeTarget)
                                return "Select a scene object — rules apply to its object type"
                            const rules = EditorSession.logicRuleCount
                            const ruleLabel = rules === 1 ? "1 rule" : (rules + " rules")
                            return "Applies to all " + EditorSession.selectedObjectTypeName
                                   + " instances  ·  " + ruleLabel
                        }
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                        elide: Text.ElideRight
                        width: parent.width
                    }
                }

                Text {
                    visible: root.hasTypeTarget && EditorSession.selectedName.length > 0
                    text: "Selected instance: " + EditorSession.selectedName
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                    ToolTip.visible: instanceMa.containsMouse
                    ToolTip.delay: 400
                    ToolTip.text: "This logic is shared by every " +
                                  EditorSession.selectedObjectTypeName +
                                  " instance. Runtime variables stay per-instance."

                    MouseArea {
                        id: instanceMa
                        anchors.fill: parent
                        hoverEnabled: true
                        acceptedButtons: Qt.NoButton
                    }
                }

                Rectangle {
                    visible: root.hasTypeTarget
                    Layout.preferredWidth: densityRow.implicitWidth + 2
                    Layout.preferredHeight: Metrics.controlHeight - 4
                    radius: Metrics.radiusSmall
                    color: Theme.control
                    border.width: 1
                    border.color: Theme.borderSubtle

                    Row {
                        id: densityRow
                        anchors.centerIn: parent

                        Repeater {
                            model: ["Compact", "Comfortable"]

                            delegate: Rectangle {
                                id: densityItem
                                required property string modelData
                                required property int index
                                readonly property bool comfortableChoice: index === 1
                                readonly property bool active:
                                    comfortableChoice === root.comfortable
                                width: densityLabel.implicitWidth + Metrics.spacingMd * 2
                                height: Metrics.controlHeight - 6
                                radius: Metrics.radiusSmall
                                color: active ? Theme.selection
                                     : densityMa.containsMouse ? Theme.controlHover
                                     : "transparent"

                                Text {
                                    id: densityLabel
                                    anchors.centerIn: parent
                                    text: densityItem.modelData
                                    color: densityItem.active ? Theme.textPrimary
                                                              : Theme.textSecondary
                                    font.family: Typography.family
                                    font.pixelSize: Typography.sizeXs
                                }

                                MouseArea {
                                    id: densityMa
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    onClicked: root.comfortable =
                                                   densityItem.comfortableChoice
                                }
                            }
                        }
                    }
                }

                AcButton {
                    text: "+ Add Rule"
                    primary: true
                    enabled: EditorSession.hasProject && root.hasTypeTarget
                             && !EditorSession.playing
                    onClicked: EditorSession.addLogicRule()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add a default When / Then rule on this object type"
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

        ListView {
            id: rulesList
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: Metrics.spacingMd
            clip: true
            visible: EditorSession.hasProject && root.hasTypeTarget
            model: EditorSession.logicRules
            spacing: Metrics.spacingSm
            boundsBehavior: Flickable.StopAtBounds

            delegate: AcLogicRuleCard {
                required property var modelData
                required property int index

                width: rulesList.width
                rule: modelData
                orderIndex: index
                expanded: modelData.id === EditorSession.selectedLogicRuleId
                comfortable: root.comfortable
                onSelectRequested: EditorSession.selectedLogicRuleId = modelData.id
                onEnabledToggled: function(enabled) {
                    EditorSession.setLogicRuleEnabled(modelData.id, enabled)
                }
                onDeleteRequested: EditorSession.removeLogicRule(modelData.id)
                onTriggerChosen: function(typeId) {
                    EditorSession.setLogicRuleTrigger(typeId)
                }
                onActionChosen: function(typeId) {
                    EditorSession.setLogicRulePrimaryAction(typeId)
                }
            }

            AcEmptyHint {
                visible: EditorSession.logicRuleCount === 0
                message: "This board has no rules yet"
                hint: "Click + Add Rule — a rule runs its Then actions when the When trigger fires"
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

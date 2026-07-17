import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/** ProjectDoc-backed global-variable authoring controls. */
AcPanelHeader {
    id: root

    title: "Project Variables"
    Layout.fillWidth: true

    Repeater {
        model: EditorSession.variablesModel

        delegate: ColumnLayout {
            id: variableRow

            required property string key
            required property string typeId
            required property string typeLabel
            required property string initialValue
            required property string description

            readonly property int logicReferenceCount:
                EditorSession.gameVariableLogicReferenceCount(key)
            property string initialValueError: ""

            Layout.fillWidth: true
            Layout.leftMargin: Metrics.spacingMd
            Layout.rightMargin: Metrics.spacingMd
            Layout.bottomMargin: Metrics.spacingSm
            spacing: 4

            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: variableRow.key
                    color: Theme.textPrimary
                    font.pixelSize: Typography.sizeSm
                    Layout.fillWidth: true
                    elide: Text.ElideRight
                }
                Text {
                    text: variableRow.typeLabel
                    color: Theme.textMuted
                    font.pixelSize: Typography.sizeXs
                }
                AcButton {
                    text: "Delete"
                    enabled: !EditorSession.playing && variableRow.logicReferenceCount === 0
                    ToolTip.visible: hovered && variableRow.logicReferenceCount > 0
                    ToolTip.text: "Remove Logic references before deleting this variable"
                    onClicked: EditorSession.removeGameVariable(variableRow.key)
                }
            }

            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: "Initial"
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeXs
                    Layout.preferredWidth: Metrics.labelColumnWidth
                }
                TextField {
                    Layout.fillWidth: true
                    text: variableRow.initialValue
                    enabled: !EditorSession.playing && variableRow.typeId !== "boolean"
                    visible: variableRow.typeId !== "boolean"
                    color: Theme.textPrimary
                    font.pixelSize: Typography.sizeXs
                    background: Rectangle {
                        color: Theme.panelRaised
                        radius: Metrics.radiusSmall
                        border.color: variableRow.initialValueError.length > 0
                                      ? Theme.danger : Theme.borderSubtle
                    }
                    onEditingFinished: {
                        if (variableRow.typeId === "number") {
                            const trimmed = text.trim()
                            const value = Number(trimmed)
                            if (trimmed.length === 0 || !Number.isFinite(value)) {
                                variableRow.initialValueError = "Enter a finite number."
                                return
                            }
                            variableRow.initialValueError = ""
                            EditorSession.setGameVariableInitialNumber(variableRow.key, value)
                        } else if (variableRow.typeId === "string") {
                            variableRow.initialValueError = ""
                            EditorSession.setGameVariableInitialString(variableRow.key, text)
                        }
                    }
                }
                ComboBox {
                    visible: variableRow.typeId === "boolean"
                    enabled: !EditorSession.playing
                    model: ["false", "true"]
                    currentIndex: variableRow.initialValue === "true" ? 1 : 0
                    onActivated: function(index) {
                        EditorSession.setGameVariableInitialBoolean(variableRow.key, index === 1)
                    }
                }
            }

            Text {
                Layout.fillWidth: true
                visible: variableRow.initialValueError.length > 0
                text: variableRow.initialValueError
                color: Theme.danger
                font.pixelSize: Typography.sizeXs
                wrapMode: Text.WordWrap
            }

            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: "Type"
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeXs
                    Layout.preferredWidth: Metrics.labelColumnWidth
                }
                ComboBox {
                    enabled: !EditorSession.playing && variableRow.logicReferenceCount === 0
                    ToolTip.visible: hovered && variableRow.logicReferenceCount > 0
                    ToolTip.text: "Remove Logic references before changing this variable type"
                    model: [
                        { value: "number", label: "Number" },
                        { value: "boolean", label: "Boolean" },
                        { value: "string", label: "String" }
                    ]
                    textRole: "label"
                    valueRole: "value"
                    Component.onCompleted: currentIndex = Math.max(0, indexOfValue(variableRow.typeId))
                    onActivated: function(index) {
                        EditorSession.setGameVariableType(variableRow.key, model[index].value)
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: "Description"
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeXs
                    Layout.preferredWidth: Metrics.labelColumnWidth
                }
                TextField {
                    Layout.fillWidth: true
                    text: variableRow.description
                    enabled: !EditorSession.playing
                    color: Theme.textPrimary
                    font.pixelSize: Typography.sizeXs
                    background: Rectangle {
                        color: Theme.panelRaised
                        radius: Metrics.radiusSmall
                        border.color: Theme.borderSubtle
                    }
                    onEditingFinished:
                        EditorSession.setGameVariableDescription(variableRow.key, text)
                }
            }
        }
    }

    AcButton {
        Layout.leftMargin: Metrics.spacingMd
        Layout.rightMargin: Metrics.spacingMd
        Layout.bottomMargin: Metrics.spacingSm
        text: "+ Add Variable"
        enabled: !EditorSession.playing
        onClicked: EditorSession.addGameVariable(
            EditorSession.suggestNextGameVariableKey(), "number")
    }
}

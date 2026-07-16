import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic block property row (Bool / Key / Number / Integer / String /
 * Vec2 / Asset). Project-backed rows carry choices ({value,label}) and render
 * a picker; ids stay the stored value, labels are display only.
 * Emits edited(valueText); parent routes to EditorSession.setLogicRuleBlockProperty.
 */
ColumnLayout {
    id: root

    property string propertyKey: ""
    property string kind: "string"
    property string valueText: ""
    /** Optional [{value, label}] picker entries from EditorSession.logicRules. */
    property var choices: []

    signal edited(string valueText)

    spacing: 2
    Layout.fillWidth: true

    Text {
        Layout.fillWidth: true
        text: root.propertyKey
        color: Theme.textMuted
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
        elide: Text.ElideRight
    }

    Loader {
        id: editorLoader
        Layout.fillWidth: true
        sourceComponent: {
            if (root.choices && root.choices.length > 0)
                return choiceEditor
            if (root.kind === "bool")
                return boolEditor
            if (root.kind === "key")
                return keyEditor
            if (root.kind === "number" || root.kind === "integer")
                return numberEditor
            if (root.kind === "vec2")
                return vec2Editor
            return stringEditor
        }
    }

    Component {
        id: choiceEditor
        ComboBox {
            id: choiceBox
            enabled: !EditorSession.playing
            // Leading "(not set)" entry keeps drafts authorable; Play validation gates it.
            model: {
                const out = [{ value: "", label: "(not set)" }]
                for (let i = 0; i < root.choices.length; ++i)
                    out.push(root.choices[i])
                return out
            }
            textRole: "label"
            valueRole: "value"
            Component.onCompleted: currentIndex = Math.max(0, indexOfValue(root.valueText))
            onActivated: function(index) {
                const next = model[index].value
                if (next !== root.valueText)
                    root.edited(next)
            }
            contentItem: Text {
                leftPadding: Metrics.spacingSm
                rightPadding: choiceBox.indicator.width + Metrics.spacingSm
                text: choiceBox.displayText
                color: root.valueText.length > 0 ? Theme.textPrimary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
            }
            background: Rectangle {
                implicitHeight: Metrics.controlHeight - 4
                radius: Metrics.radiusSmall
                color: choiceBox.hovered ? Theme.controlHover : Theme.panelRaised
                border.color: choiceBox.popup.visible ? Theme.accent : Theme.borderSubtle
                border.width: 1
            }
        }
    }

    Component {
        id: vec2Editor
        RowLayout {
            spacing: Metrics.spacingXs

            readonly property var parts: {
                const raw = String(root.valueText).split(",")
                const x = Number(raw[0])
                const y = Number(raw.length > 1 ? raw[1] : NaN)
                return [isNaN(x) ? 0 : x, isNaN(y) ? 0 : y]
            }

            function commit(x, y) {
                const next = String(x) + "," + String(y)
                if (next !== root.valueText)
                    root.edited(next)
            }

            AcNumberField {
                id: vecX
                Layout.fillWidth: true
                value: parent.parts[0]
                decimals: 2
                enabled: !EditorSession.playing
                font.pixelSize: Typography.sizeXs
                onValueChanged: {
                    if (value !== parent.parts[0])
                        parent.commit(value, vecY.value)
                }
            }
            AcNumberField {
                id: vecY
                Layout.fillWidth: true
                value: parent.parts[1]
                decimals: 2
                enabled: !EditorSession.playing
                font.pixelSize: Typography.sizeXs
                onValueChanged: {
                    if (value !== parent.parts[1])
                        parent.commit(vecX.value, value)
                }
            }
        }
    }

    Component {
        id: boolEditor
        ComboBox {
            id: boolBox
            model: ["true", "false"]
            enabled: !EditorSession.playing
            Component.onCompleted: currentIndex = root.valueText === "false" ? 1 : 0
            onActivated: function(index) {
                const next = model[index]
                if (next !== root.valueText)
                    root.edited(next)
            }
            contentItem: Text {
                leftPadding: Metrics.spacingSm
                text: boolBox.displayText
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                verticalAlignment: Text.AlignVCenter
            }
            background: Rectangle {
                implicitHeight: Metrics.controlHeight - 4
                radius: Metrics.radiusSmall
                color: Theme.panelRaised
                border.color: Theme.borderSubtle
                border.width: 1
            }
        }
    }

    Component {
        id: keyEditor
        AcLogicKeyCapture {
            width: editorLoader.width
            keyName: root.valueText
            onKeyChosen: function(name) { root.edited(name) }
        }
    }

    Component {
        id: numberEditor
        AcNumberField {
            value: Number(root.valueText)
            decimals: root.kind === "integer" ? 0 : 2
            enabled: !EditorSession.playing
            font.pixelSize: Typography.sizeXs
            onValueChanged: {
                const current = Number(root.valueText)
                if (!isNaN(current) && current === value)
                    return
                const next = root.kind === "integer"
                             ? String(Math.round(value))
                             : String(value)
                root.edited(next)
            }
        }
    }

    Component {
        id: stringEditor
        AcTextField {
            text: root.valueText
            enabled: !EditorSession.playing
            font.pixelSize: Typography.sizeXs
            onEditingFinished: {
                if (text !== root.valueText)
                    root.edited(text)
            }
        }
    }
}

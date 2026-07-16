import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic block property row (Bool / Key / Number / Integer / String).
 * Emits edited(valueText); parent routes to EditorSession.setLogicRuleBlockProperty.
 */
ColumnLayout {
    id: root

    property string propertyKey: ""
    property string kind: "string"
    property string valueText: ""

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
            if (root.kind === "bool")
                return boolEditor
            if (root.kind === "key")
                return keyEditor
            if (root.kind === "number" || root.kind === "integer")
                return numberEditor
            return stringEditor
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

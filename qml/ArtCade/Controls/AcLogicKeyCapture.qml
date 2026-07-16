import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Key detector for Logic Key properties — click, then press a supported key.
 * Emits keyChosen with a logicKeyName string (e.g. "Space", "W"). Presentation only.
 */
Column {
    id: root

    property string keyName: ""
    property bool listening: false
    property string statusHint: ""

    signal keyChosen(string name)

    spacing: 2
    width: parent ? parent.width : 120

    function beginListen() {
        if (EditorSession.playing)
            return
        statusHint = ""
        listening = true
        focusSink.forceActiveFocus()
    }

    function cancelListen() {
        listening = false
        statusHint = ""
    }

    Rectangle {
        id: face
        width: parent.width
        height: Metrics.controlHeight - 4
        radius: Metrics.radiusSmall
        color: root.listening ? Qt.alpha(Theme.accent, 0.14) : Theme.panelRaised
        border.width: 1
        border.color: root.listening ? Theme.accent
                     : (captureMa.containsMouse ? Theme.border : Theme.borderSubtle)

        Text {
            anchors.fill: parent
            anchors.leftMargin: Metrics.spacingSm
            anchors.rightMargin: Metrics.spacingSm
            verticalAlignment: Text.AlignVCenter
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
            text: {
                if (root.listening)
                    return "Press a key…"
                if (root.keyName && root.keyName.length > 0)
                    return root.keyName
                return "Click to bind"
            }
            color: root.listening ? Theme.accent : Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
            font.weight: root.listening ? Font.DemiBold : Font.Normal
        }

        MouseArea {
            id: captureMa
            anchors.fill: parent
            hoverEnabled: true
            enabled: !EditorSession.playing
            onClicked: {
                if (root.listening)
                    root.cancelListen()
                else
                    root.beginListen()
            }
        }

        ToolTip.visible: captureMa.containsMouse && !root.listening
        ToolTip.delay: 400
        ToolTip.text: "Click, then press the key this rule should listen for"
    }

    Text {
        visible: root.statusHint.length > 0
        width: parent.width
        text: root.statusHint
        color: Theme.warning
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
        elide: Text.ElideRight
    }

    // Focus sink so Keys handlers receive presses while listening.
    Item {
        id: focusSink
        width: 0
        height: 0
        focus: root.listening

        Keys.onPressed: function(event) {
            if (!root.listening) {
                event.accepted = false
                return
            }
            event.accepted = true
            if (event.key === Qt.Key_Escape) {
                root.cancelListen()
                return
            }
            const name = EditorSession.logicKeyFromQtKey(event.key)
            if (!name || name.length === 0) {
                root.statusHint = "Unsupported key — try A–Z, 0–9, arrows, Space, Enter"
                return
            }
            root.statusHint = ""
            root.listening = false
            if (name !== root.keyName)
                root.keyChosen(name)
        }

        Keys.onReleased: function(event) {
            if (root.listening)
                event.accepted = true
        }

        onActiveFocusChanged: {
            if (!activeFocus && root.listening)
                root.cancelListen()
        }
    }
}

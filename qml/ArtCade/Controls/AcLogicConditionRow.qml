import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One AND condition row inside AcLogicWhenColumn.
 * Presentation only — mutations via signals → EditorSession.
 */
Item {
    id: root

    property int conditionIndex: 0
    property string displayName: ""
    property string description: ""
    property var propertyRows: []
    property bool comfortable: false
    property bool canMoveUp: false
    property bool canMoveDown: false

    readonly property int rowSpacing: comfortable ? Metrics.spacingSm : Metrics.spacingXs
    readonly property bool editorsEnabled: !EditorSession.playing

    signal catalogRequested()
    signal propertyEdited(string propertyKey, string valueText)
    signal moveUpRequested()
    signal moveDownRequested()
    signal deleteRequested()

    implicitHeight: rowCol.implicitHeight
    implicitWidth: 120

    ColumnLayout {
        id: rowCol
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: root.rowSpacing

        RowLayout {
            Layout.fillWidth: true
            spacing: Metrics.spacingSm

            Text {
                Layout.preferredWidth: 36
                Layout.alignment: Qt.AlignVCenter
                text: "AND"
                color: Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeMeta
                font.weight: Font.DemiBold
            }

            Text {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignVCenter
                text: root.displayName.length > 0 ? root.displayName : "Condition"
                color: root.displayName.length > 0 ? Theme.textPrimary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }

            Rectangle {
                id: overflowBtn
                Layout.alignment: Qt.AlignVCenter
                Layout.preferredWidth: 28
                Layout.preferredHeight: 28
                radius: Metrics.radiusControl
                color: overflowHover.hovered ? Theme.controlHover : "transparent"
                opacity: root.editorsEnabled ? 1.0 : 0.5

                Text {
                    anchors.centerIn: parent
                    text: "⋯"
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeObjectTitle
                }

                HoverHandler {
                    id: overflowHover
                }

                TapHandler {
                    acceptedButtons: Qt.LeftButton
                    enabled: root.editorsEnabled
                    gesturePolicy: TapHandler.ReleaseWithinBounds
                    onTapped: conditionMenu.popup(overflowBtn, 0, overflowBtn.height)
                }
            }
        }

        Text {
            Layout.fillWidth: true
            Layout.leftMargin: 36 + Metrics.spacingSm
            visible: root.comfortable && root.description.length > 0
            wrapMode: Text.WordWrap
            text: root.description
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeMeta
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.leftMargin: 36 + Metrics.spacingSm
            spacing: root.rowSpacing
            visible: root.propertyRows && root.propertyRows.length > 0

            Repeater {
                model: root.propertyRows || []
                delegate: AcLogicPropertyEditor {
                    required property var modelData
                    Layout.fillWidth: true
                    propertyKey: modelData.key || ""
                    displayName: modelData.displayName || ""
                    kind: modelData.kind || "string"
                    valueText: modelData.value || ""
                    choices: modelData.choices || []
                    onEdited: function(valueText) {
                        root.propertyEdited(propertyKey, valueText)
                    }
                }
            }
        }
    }

    AcMenu {
        id: conditionMenu

        AcMenuItem {
            text: "Change Condition…"
            available: root.editorsEnabled
            disabledHint: EditorSession.playing ? "Unavailable during Play" : ""
            onTriggered: {
                if (available)
                    root.catalogRequested()
            }
        }
        AcMenuItem {
            text: "Move Up"
            available: root.editorsEnabled && root.canMoveUp
            disabledHint: EditorSession.playing ? "Unavailable during Play"
                           : (!root.canMoveUp ? "Already first" : "")
            onTriggered: {
                if (available)
                    root.moveUpRequested()
            }
        }
        AcMenuItem {
            text: "Move Down"
            available: root.editorsEnabled && root.canMoveDown
            disabledHint: EditorSession.playing ? "Unavailable during Play"
                           : (!root.canMoveDown ? "Already last" : "")
            onTriggered: {
                if (available)
                    root.moveDownRequested()
            }
        }
        MenuSeparator {}
        AcMenuItem {
            text: "Delete Condition"
            available: root.editorsEnabled
            disabledHint: EditorSession.playing ? "Unavailable during Play" : ""
            onTriggered: {
                if (available)
                    root.deleteRequested()
            }
        }
    }
}

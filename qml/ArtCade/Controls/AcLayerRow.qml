import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Layers panel row — drag handle, eye, lock, default ★, overflow menu.
 * Reorder: Move Forward = toward foreground (higher SceneDef.layers index).
 * Drag: workspace preview on the handle; one moveSceneLayer commit on release.
 */
Item {
    id: root

    required property string display
    required property string layerId
    required property bool layerVisible
    required property bool playVisible
    required property bool locked
    required property bool active
    required property bool isDefault
    required property int index

    readonly property int layerCount: ListView.view ? ListView.view.count : 0
    readonly property bool canMoveBackward: index > 0
    readonly property bool canMoveForward: index >= 0 && index < layerCount - 1

    signal activateRequested(string layerId)
    signal visibilityToggled(string layerId, bool visible)
    signal playVisibilityToggled(string layerId, bool visible)
    signal lockToggled(string layerId, bool locked)
    signal renameRequested(string layerId, string currentName)
    signal setDefaultRequested(string layerId)
    signal moveRequested(string layerId, int targetIndex)
    signal deleteRequested(string layerId, string display)
    signal duplicateRequested(string layerId)

    width: ListView.view ? ListView.view.width : 200
    implicitHeight: Metrics.controlHeight + 2
    height: implicitHeight
    z: gripMa.drag.active ? 10 : 0

    Rectangle {
        id: chrome
        width: parent.width - Metrics.spacingXs * 2
        height: parent.height - 2
        x: Metrics.spacingXs
        y: 1
        radius: Metrics.radiusSmall
        color: {
            if (gripMa.drag.active)
                return Theme.controlHover
            if (root.active)
                return Theme.selection
            if (rowMa.containsMouse || gripMa.containsMouse)
                return Theme.controlHover
            return "transparent"
        }
        border.width: root.active || gripMa.drag.active ? 1 : 0
        border.color: Theme.accent
        opacity: gripMa.drag.active ? 0.92 : 1.0

        Rectangle {
            visible: root.active && !gripMa.drag.active
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.margins: 1
            width: 3
            radius: 1
            color: Theme.accent
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: Metrics.spacingXs + (root.active ? 2 : 0)
            anchors.rightMargin: Metrics.spacingSm
            spacing: Metrics.spacingXs

            Item {
                id: grip
                implicitWidth: 16
                implicitHeight: 22
                Layout.alignment: Qt.AlignVCenter
                z: 3

                Text {
                    anchors.centerIn: parent
                    text: "⠿"
                    color: Theme.textMuted
                    font.pixelSize: Typography.sizeSm
                    opacity: gripMa.containsMouse || gripMa.drag.active ? 1.0 : 0.55
                }
                ToolTip.visible: gripMa.containsMouse && !gripMa.drag.active
                ToolTip.delay: 500
                ToolTip.text: "Drag to reorder"

                MouseArea {
                    id: gripMa
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.SizeAllCursor
                    preventStealing: true
                    drag.target: chrome
                    drag.axis: Drag.YAxis
                    drag.threshold: 4
                    onReleased: {
                        if (!drag.active && Math.abs(chrome.y - 1) < 1) {
                            chrome.y = 1
                            return
                        }
                        const rowH = root.height > 0 ? root.height : Metrics.controlHeight + 2
                        const deltaRows = Math.round((chrome.y - 1) / rowH)
                        const target = Math.max(0, Math.min(root.layerCount - 1,
                                                            root.index + deltaRows))
                        chrome.y = 1
                        if (target !== root.index)
                            root.moveRequested(root.layerId, target)
                    }
                    onCanceled: chrome.y = 1
                }
            }

            AcIcon {
                source: Icons.layer
                size: Metrics.iconSizeSm
                color: root.active ? Theme.textPrimary
                     : root.layerVisible ? Theme.textSecondary : Theme.textMuted
                Layout.alignment: Qt.AlignVCenter
            }

            Text {
                text: root.display
                color: root.layerVisible ? Theme.textPrimary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeSm
                font.weight: root.active ? Font.DemiBold : Font.Normal
                elide: Text.ElideRight
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignVCenter
                verticalAlignment: Text.AlignVCenter
            }

            Text {
                visible: root.isDefault
                text: "★"
                color: Theme.accent
                font.pixelSize: Typography.sizeSm
                Layout.alignment: Qt.AlignVCenter
                ToolTip.visible: defaultHover.hovered
                ToolTip.delay: 400
                ToolTip.text: "Default layer"
                HoverHandler { id: defaultHover }
            }

            ToolButton {
                id: eyeBtn
                implicitWidth: 22
                implicitHeight: 22
                padding: 0
                focusPolicy: Qt.NoFocus
                z: 2
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: root.layerVisible ? "Hide in editor" : "Show in editor"

                background: Rectangle {
                    radius: Metrics.radiusSmall
                    color: eyeBtn.down ? Theme.controlPressed
                         : eyeBtn.hovered ? Theme.control : "transparent"
                }
                contentItem: Item {
                    implicitWidth: Metrics.iconSizeSm
                    implicitHeight: Metrics.iconSizeSm
                    AcIcon {
                        anchors.centerIn: parent
                        source: root.layerVisible ? Icons.eye : Icons.eyeOff
                        size: Metrics.iconSizeSm
                        color: root.layerVisible ? Theme.textSecondary : Theme.textMuted
                    }
                }
                onClicked: root.visibilityToggled(root.layerId, !root.layerVisible)
            }

            ToolButton {
                id: lockBtn
                implicitWidth: 22
                implicitHeight: 22
                padding: 0
                focusPolicy: Qt.NoFocus
                z: 2
                enabled: !EditorSession.playing
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: root.locked ? "Unlock layer" : "Lock layer (blocks pick)"

                background: Rectangle {
                    radius: Metrics.radiusSmall
                    color: lockBtn.down ? Theme.controlPressed
                         : lockBtn.hovered ? Theme.control : "transparent"
                }
                contentItem: Item {
                    implicitWidth: Metrics.iconSizeSm
                    implicitHeight: Metrics.iconSizeSm
                    AcIcon {
                        anchors.centerIn: parent
                        source: Icons.lock
                        size: Metrics.iconSizeSm
                        color: root.locked ? Theme.warning : Theme.textMuted
                        opacity: root.locked ? 1.0
                               : (lockBtn.hovered || root.active ? 0.7 : 0.35)
                    }
                }
                onClicked: root.lockToggled(root.layerId, !root.locked)
            }

            ToolButton {
                id: menuBtn
                implicitWidth: 22
                implicitHeight: 22
                padding: 0
                focusPolicy: Qt.NoFocus
                z: 2
                text: "⋯"
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: "Layer actions"
                background: Rectangle {
                    radius: Metrics.radiusSmall
                    color: menuBtn.down ? Theme.controlPressed
                         : menuBtn.hovered ? Theme.control : "transparent"
                }
                contentItem: Text {
                    text: menuBtn.text
                    color: Theme.textSecondary
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    font.pixelSize: Typography.sizeMd
                }
                onClicked: layerMenu.open()
            }
        }

        MouseArea {
            id: rowMa
            anchors.fill: parent
            anchors.leftMargin: 20
            anchors.rightMargin: 70
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.activateRequested(root.layerId)
            onDoubleClicked: root.renameRequested(root.layerId, root.display)
        }
    }

    Menu {
        id: layerMenu
        MenuItem {
            text: "Rename Layer…"
            onTriggered: root.renameRequested(root.layerId, root.display)
        }
        MenuSeparator {}
        MenuItem {
            text: "Visible in Play"
            checkable: true
            checked: root.playVisible
            onTriggered: root.playVisibilityToggled(root.layerId, checked)
        }
        MenuSeparator {}
        MenuItem {
            text: "Move Forward"
            enabled: root.canMoveForward
            onTriggered: root.moveRequested(root.layerId, root.index + 1)
        }
        MenuItem {
            text: "Move Backward"
            enabled: root.canMoveBackward
            onTriggered: root.moveRequested(root.layerId, root.index - 1)
        }
        MenuItem {
            text: "Move to Front"
            enabled: root.canMoveForward
            onTriggered: root.moveRequested(root.layerId, root.layerCount - 1)
        }
        MenuItem {
            text: "Move to Back"
            enabled: root.canMoveBackward
            onTriggered: root.moveRequested(root.layerId, 0)
        }
        MenuSeparator {}
        MenuItem {
            text: "Set as Default Layer"
            enabled: !root.isDefault
            onTriggered: root.setDefaultRequested(root.layerId)
        }
        MenuItem {
            text: "Duplicate Layer"
            onTriggered: root.duplicateRequested(root.layerId)
        }
        MenuSeparator {}
        MenuItem {
            text: "Delete Layer…"
            enabled: !root.isDefault && root.layerCount > 1
            onTriggered: root.deleteRequested(root.layerId, root.display)
        }
    }
}

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Hierarchy tree row — one hit target, one expand API.
 *
 * Qt installs a TapHandler on TreeViewDelegate.indicator that calls
 * treeView.toggleExpanded(row). Writing expanded=… only flips a local flag and
 * does not expand children (empty “open” state). So indicator is null and the
 * whole row routes through activateRow() → treeView.toggleExpanded.
 */
TreeViewDelegate {
    id: root

    implicitHeight: Metrics.controlHeight
    indentation: Metrics.spacingLg
    leftMargin: Metrics.spacingXs
    rightMargin: Metrics.spacingSm
    spacing: Metrics.spacingXs

    /** Disable Qt’s separate indicator TapHandler — single click path below. */
    indicator: null

    readonly property string displayText: model.display ?? ""
    readonly property string nodeKind: model.nodeKind ?? ""
    readonly property var stableId: model.stableId ?? 0
    readonly property bool branchRow: root.hasChildren

    /**
     * Sole interaction entry for this row (label + chevron share this).
     * Instances select; branches toggle via TreeView (not the expanded flag).
     */
    function activateRow() {
        if (root.nodeKind === "instance") {
            EditorSession.selectEntity(root.stableId)
            return
        }
        if (root.branchRow && root.treeView)
            root.treeView.toggleExpanded(root.row)
    }

    background: Rectangle {
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingXs
        anchors.rightMargin: Metrics.spacingXs
        radius: Metrics.radiusSmall
        color: {
            if (root.nodeKind === "instance" && EditorSession.selectedEntityId === root.stableId)
                return Theme.selection
            if (root.hovered)
                return Theme.controlHover
            return "transparent"
        }
        border.width: (root.nodeKind === "instance"
                       && EditorSession.selectedEntityId === root.stableId) ? 1 : 0
        border.color: Theme.accent
    }

    contentItem: RowLayout {
        spacing: Metrics.spacingXs

        Item {
            Layout.preferredWidth: Metrics.iconSizeSm
            Layout.preferredHeight: Metrics.iconSizeSm
            Layout.alignment: Qt.AlignVCenter

            AcIcon {
                anchors.centerIn: parent
                visible: root.branchRow
                source: Icons.chevron
                size: Metrics.iconSizeSm
                color: root.hovered ? Theme.textPrimary : Theme.textSecondary
                rotation: root.expanded ? 0 : -90
                Behavior on rotation {
                    NumberAnimation { duration: 100; easing.type: Easing.OutCubic }
                }
            }
        }

        Text {
            Layout.fillWidth: true
            Layout.alignment: Qt.AlignVCenter
            text: root.displayText
            color: root.nodeKind === "scene" ? Theme.textSecondary : Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
            font.weight: root.nodeKind === "scene" ? Font.DemiBold : Font.Normal
            elide: Text.ElideRight
            verticalAlignment: Text.AlignVCenter
        }
    }

    onClicked: root.activateRow()

    TapHandler {
        acceptedButtons: Qt.RightButton
        gesturePolicy: TapHandler.ReleaseWithinBounds
        onTapped: {
            if (root.nodeKind !== "instance")
                return
            EditorSession.selectEntity(root.stableId)
            moveToLayerMenu.popup()
        }
    }

    Menu {
        id: moveToLayerMenu
        title: "Move to Layer"

        Instantiator {
            model: EditorSession.layersModel
            delegate: MenuItem {
                // AbstractButton.display is FINAL — cannot redeclare required property display.
                required property var model
                text: model.display
                checkable: true
                checked: model.layerId === EditorSession.selectedLayerId
                onTriggered: EditorSession.setEntityLayer(root.stableId, model.layerId)
            }
            onObjectAdded: (index, object) => moveToLayerMenu.insertItem(index, object)
            onObjectRemoved: (index, object) => moveToLayerMenu.removeItem(object)
        }
    }
}

import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Hierarchy tree row — ArtCade chevron + label as one hit target.
 * Scene (and other branch) rows toggle expand on the whole row; instances select.
 * Indicator is visual-only so expand is not chevron-only.
 */
TreeViewDelegate {
    id: root

    implicitHeight: Metrics.controlHeight
    indentation: Metrics.spacingLg
    leftMargin: Metrics.spacingXs
    rightMargin: Metrics.spacingSm
    spacing: Metrics.spacingXs

    readonly property string displayText: model.display ?? ""
    readonly property string nodeKind: model.nodeKind ?? ""
    readonly property var stableId: model.stableId ?? 0
    readonly property bool branchRow: root.hasChildren

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

    // Visual only — no TapHandler here; whole-row onClicked owns expand/select.
    indicator: Item {
        implicitWidth: Metrics.iconSizeSm
        implicitHeight: Metrics.iconSizeSm
        width: Metrics.iconSizeSm
        height: root.height
        x: root.leftMargin + (root.depth * root.indentation)

        AcIcon {
            anchors.centerIn: parent
            visible: root.branchRow
            source: Icons.chevron
            size: Metrics.iconSizeSm
            color: root.hovered ? Theme.textPrimary : Theme.textSecondary
            rotation: root.expanded ? 0 : -90
            Behavior on rotation { NumberAnimation { duration: 100; easing.type: Easing.OutCubic } }
        }
    }

    contentItem: Text {
        text: root.displayText
        color: root.nodeKind === "scene" ? Theme.textSecondary : Theme.textPrimary
        font.family: Typography.family
        font.pixelSize: Typography.sizeSm
        font.weight: root.nodeKind === "scene" ? Font.DemiBold : Font.Normal
        elide: Text.ElideRight
        verticalAlignment: Text.AlignVCenter
    }

    onClicked: {
        if (root.nodeKind === "instance") {
            EditorSession.selectEntity(root.stableId)
            return
        }
        if (root.branchRow)
            root.expanded = !root.expanded
    }
}

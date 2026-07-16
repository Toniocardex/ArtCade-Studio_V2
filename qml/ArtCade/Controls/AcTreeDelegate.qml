import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Compact tree row for Hierarchy (TreeView + QAbstractItemModel).
 */
TreeViewDelegate {
    id: root

    required property string display
    required property string nodeKind
    required property var stableId

    implicitHeight: Metrics.controlHeight
    indentation: Metrics.spacingMd

    background: Rectangle {
        color: {
            if (nodeKind === "instance" && EditorSession.selectedEntityId === stableId)
                return Theme.selection
            if (root.hovered)
                return Theme.controlHover
            return "transparent"
        }
    }

    contentItem: Text {
        text: display
        color: nodeKind === "scene" ? Theme.textSecondary : Theme.textPrimary
        font.family: Typography.family
        font.pixelSize: Typography.sizeSm
        font.weight: nodeKind === "scene" ? Font.DemiBold : Font.Normal
        elide: Text.ElideRight
        verticalAlignment: Text.AlignVCenter
    }

    onClicked: {
        if (nodeKind === "instance")
            EditorSession.selectEntity(stableId)
    }
}

import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Compact tree row for Hierarchy (TreeView + QAbstractItemModel).
 * Model roles are accessed via model.* — do not redeclare role names as
 * required properties (FINAL in Qt 6.8 TreeViewDelegate).
 */
TreeViewDelegate {
    id: root

    implicitHeight: Metrics.controlHeight
    indentation: Metrics.spacingMd

    readonly property string displayText: model.display ?? ""
    readonly property string nodeKind: model.nodeKind ?? ""
    readonly property var stableId: model.stableId ?? 0

    background: Rectangle {
        color: {
            if (root.nodeKind === "instance" && EditorSession.selectedEntityId === root.stableId)
                return Theme.selection
            if (root.hovered)
                return Theme.controlHover
            return "transparent"
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
        if (root.nodeKind === "instance")
            EditorSession.selectEntity(root.stableId)
    }
}

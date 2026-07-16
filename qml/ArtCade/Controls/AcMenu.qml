import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Themed popup / context menu — same chrome as ToolTip (spec §18):
 * selection surface, strong border, 4px radius, compact padding.
 */
Menu {
    id: root

    padding: 4
    topPadding: 6
    bottomPadding: 6
    leftPadding: 4
    rightPadding: 4

    delegate: AcMenuItem {}

    background: Rectangle {
        implicitWidth: 190
        color: Theme.selection
        border.color: Theme.borderStrong
        border.width: 1
        radius: Metrics.radiusCard
    }
}

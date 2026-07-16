import QtQuick
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Horizontal toolbar strip — presentation only.
 */
Rectangle {
    id: root

    default property alias content: row.data

    color: Theme.panelBackground
    height: Metrics.modeBarHeight
    border.color: Theme.borderSubtle
    border.width: 0

    RowLayout {
        id: row
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingSm
        anchors.rightMargin: Metrics.spacingSm
        spacing: Metrics.spacingXs
    }
}

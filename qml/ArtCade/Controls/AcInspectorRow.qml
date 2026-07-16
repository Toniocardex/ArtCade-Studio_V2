import QtQuick
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Inspector label + control row (mockup density: ~104px label column).
 */
RowLayout {
    id: root

    property string label: ""
    property string unit: ""
    default property alias content: fieldSlot.data

    Layout.fillWidth: true
    Layout.leftMargin: Metrics.spacingMd
    Layout.rightMargin: Metrics.spacingMd
    Layout.bottomMargin: Metrics.spacingXs
    spacing: Metrics.spacingSm

    Text {
        text: root.label
        color: Theme.textSecondary
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
        Layout.preferredWidth: Metrics.labelColumnWidth
        elide: Text.ElideRight
    }

    Item {
        id: fieldSlot
        Layout.fillWidth: true
        Layout.preferredHeight: Metrics.controlHeight
        // Children fill via anchors in callers, or implicit width
    }

    Text {
        visible: root.unit.length > 0
        text: root.unit
        color: Theme.textMuted
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
        Layout.preferredWidth: 28
    }
}

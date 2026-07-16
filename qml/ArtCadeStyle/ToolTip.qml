import QtQuick
import QtQuick.Templates as T
import ArtCade.Ui

/**
 * App-wide themed tooltip (style override — replaces the native white one).
 * Anthracite surface, strong border, 4px radius, ~400ms delay, max 280px.
 *
 * Width is measured via TextMetrics (unwrapped natural size) so wrapMode
 * cannot collapse the popup into a near-zero-width column.
 */
T.ToolTip {
    id: control

    readonly property int maxTooltipWidth: 280

    x: parent ? (parent.width - implicitWidth) / 2 : 0
    y: -implicitHeight - 6

    margins: 6
    topPadding: 6
    bottomPadding: 6
    leftPadding: 8
    rightPadding: 8
    delay: 400
    timeout: 9000

    TextMetrics {
        id: textMetrics
        text: control.text
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
    }

    implicitWidth: Math.min(
        maxTooltipWidth,
        Math.max(
            80,
            textMetrics.boundingRect.width
                + leftPadding
                + rightPadding
        )
    )
    implicitHeight:
        tooltipText.implicitHeight + topPadding + bottomPadding

    contentItem: Text {
        id: tooltipText
        width: control.availableWidth
        text: control.text
        wrapMode: Text.WrapAtWordBoundaryOrAnywhere
        color: Theme.textPrimary
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
    }

    background: Rectangle {
        color: Theme.selection
        border.color: Theme.borderStrong
        border.width: 1
        radius: Metrics.radiusCard
    }
}

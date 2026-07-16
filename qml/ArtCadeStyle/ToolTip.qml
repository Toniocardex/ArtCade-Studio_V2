import QtQuick
import QtQuick.Templates as T
import ArtCade.Ui

/**
 * App-wide themed tooltip (style override — replaces the native white one).
 * Anthracite surface, strong border, 4px radius, ~400ms delay, max 280px.
 *
 * Width from TextMetrics (natural size); content width/height are explicit
 * so T.ToolTip layout cannot leave the Text with incomplete geometry.
 */
T.ToolTip {
    id: control

    readonly property int maxTooltipWidth: 280
    readonly property int minTooltipWidth: 80
    readonly property real resolvedContentWidth: Math.max(
        1,
        implicitWidth - leftPadding - rightPadding
    )

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
            minTooltipWidth,
            Math.ceil(textMetrics.boundingRect.width)
                + leftPadding
                + rightPadding
        )
    )
    implicitHeight:
        tooltipText.contentHeight + topPadding + bottomPadding

    contentItem: Text {
        id: tooltipText
        width: control.resolvedContentWidth
        height: contentHeight
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

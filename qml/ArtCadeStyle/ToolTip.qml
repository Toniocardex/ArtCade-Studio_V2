import QtQuick
import QtQuick.Templates as T
import ArtCade.Ui

/**
 * App-wide themed tooltip (style override — replaces the native white one).
 * Anthracite surface, strong border, 4px radius, ~400ms delay, max 280px.
 */
T.ToolTip {
    id: control

    x: parent ? (parent.width - implicitWidth) / 2 : 0
    y: -implicitHeight - 6

    implicitWidth: Math.min(280,
                            implicitContentWidth + leftPadding + rightPadding)
    implicitHeight: implicitContentHeight + topPadding + bottomPadding

    margins: 6
    topPadding: 6
    bottomPadding: 6
    leftPadding: 8
    rightPadding: 8
    delay: 400
    timeout: 9000

    contentItem: Text {
        text: control.text
        wrapMode: Text.Wrap
        color: Theme.textPrimary
        font.family: Typography.family
        font.pixelSize: Typography.sizeXs
    }

    background: Rectangle {
        color: Theme.selection
        border.color: Theme.borderStrong
        border.width: 1
        radius: 4
    }
}

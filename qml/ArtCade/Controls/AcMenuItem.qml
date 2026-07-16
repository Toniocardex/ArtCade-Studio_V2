import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Themed context-menu row.
 * Use available/disabledHint for "Coming next" items — do not set enabled:false
 * if a hover tooltip is required (Qt disables pointer handling on children).
 */
MenuItem {
    id: root

    property bool available: true
    property string disabledHint: ""

    // Qt-level enabled stays true so HoverHandler works; gate authoring via available.
    enabled: true
    implicitHeight: 28
    padding: 0
    leftPadding: 8
    rightPadding: 8

    contentItem: Text {
        text: root.text
        color: root.available ? Theme.textPrimary : Theme.textDisabled
        font.family: Typography.family
        font.pixelSize: Typography.sizeToolbar
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }

    background: Rectangle {
        radius: Metrics.radiusControl
        color: root.highlighted && root.available ? Theme.controlHover : "transparent"
    }

    HoverHandler {
        id: disabledHover
    }

    ToolTip.visible: !root.available
                     && root.disabledHint.length > 0
                     && disabledHover.hovered
    ToolTip.delay: 400
    ToolTip.text: root.disabledHint
}

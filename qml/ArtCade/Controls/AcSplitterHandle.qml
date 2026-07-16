import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Thin SplitView handle — use as SplitView.handle.
 */
Rectangle {
    implicitWidth: 4
    implicitHeight: 4
    color: SplitHandle.pressed ? Theme.accent
         : SplitHandle.hovered ? Theme.border
         : Theme.borderSubtle
}

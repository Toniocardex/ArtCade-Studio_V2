pragma Singleton
import QtQuick

QtObject {
    readonly property int spacingXs: 4
    readonly property int spacingSm: 6
    readonly property int spacingMd: 8
    readonly property int spacingLg: 12
    readonly property int spacingXl: 16

    readonly property int radiusSmall: 3
    readonly property int radiusMedium: 5
    readonly property int borderRadius: radiusSmall

    readonly property int controlHeight: 28
    readonly property int toolButtonSize: 30
    readonly property int iconSize: 16
    readonly property int titleBarHeight: 34
    readonly property int workspaceBarHeight: 48
    readonly property int toolbarHeight: 38
    readonly property int panelHeaderHeight: 32
    readonly property int statusBarHeight: 27
    readonly property int modeBarHeight: workspaceBarHeight

    readonly property int leftSidebarDefaultWidth: 290
    readonly property int inspectorDefaultWidth: 320
    readonly property int consoleDefaultHeight: 180
    readonly property int splitHandle: 4
    readonly property int labelColumnWidth: 104
}

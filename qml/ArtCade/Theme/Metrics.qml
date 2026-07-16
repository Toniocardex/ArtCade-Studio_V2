pragma Singleton
import QtQuick

/**
 * Spacing and geometry — UI redesign radius ladder (spec §5):
 * 0 continuous tabs/separators · 2 controls · 4 cards/popups · 8+ pills.
 */
QtObject {
    readonly property int spacingXs: 4
    readonly property int spacingSm: 6
    readonly property int spacingMd: 8
    readonly property int spacingLg: 12
    readonly property int spacingXl: 16

    readonly property int radiusNone: 0
    readonly property int radiusControl: 2
    readonly property int radiusCard: 4
    readonly property int radiusPill: 8
    /** @deprecated Prefer radiusControl — kept for gradual call-site migration. */
    readonly property int radiusSmall: radiusControl
    /** @deprecated Prefer radiusCard. */
    readonly property int radiusMedium: radiusCard
    readonly property int borderRadius: radiusControl

    readonly property int controlHeight: 28
    readonly property int toolButtonSize: 30
    readonly property int iconSize: 16
    readonly property int iconSizeSm: 12
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

pragma Singleton
import QtQuick

/**
 * ArtCade design tokens — mockup palette (no hardcoded colors in panels).
 * Prefer these semantic names; legacy aliases kept for gradual migration.
 */
QtObject {
    readonly property color window: "#0E1116"
    readonly property color titleBar: "#11161E"
    readonly property color chrome: "#131922"
    readonly property color panel: "#171D26"
    readonly property color panelRaised: "#1B222D"
    readonly property color viewport: "#0B0F14"
    readonly property color control: "#111820"
    readonly property color controlHover: "#202936"
    readonly property color controlPressed: "#273244"
    readonly property color selection: "#1E3F6E"
    readonly property color accent: "#4B8FF7"
    readonly property color accentHover: "#65A1FF"
    readonly property color border: "#293240"
    readonly property color borderSubtle: "#202833"
    readonly property color textPrimary: "#DCE3ED"
    readonly property color textSecondary: "#919CAC"
    readonly property color textMuted: "#687486"
    readonly property color success: "#46BE7C"
    readonly property color warning: "#E1A62B"
    readonly property color error: "#E35B62"
    readonly property color info: "#4C91F2"

    // Legacy aliases (shell migration)
    readonly property color windowBackground: window
    readonly property color panelBackground: panel
    readonly property color controlBackground: control
    readonly property color panelHeader: panelRaised
    readonly property color accentMuted: accentHover
    readonly property color textDisabled: textMuted
    readonly property color danger: error
    readonly property color warn: warning
    readonly property color viewportVoid: viewport
    readonly property color rowHover: controlHover
    readonly property color rowSelected: selection
}

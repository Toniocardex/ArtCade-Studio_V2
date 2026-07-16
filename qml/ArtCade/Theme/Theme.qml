pragma Singleton
import QtQuick

/**
 * ArtCade design tokens — Cursor-like anthracite shell (UI redesign 2026-07).
 * 90-95% black/graphite surfaces split by luminance; accent is rare and
 * intentional (CTA, focus, active-workspace underline, selection indicator).
 * Prefer the semantic names; legacy aliases kept for gradual migration.
 */
QtObject {
    // Surfaces
    readonly property color titleBar: "#09090A"
    readonly property color window: "#0B0C0E"
    readonly property color viewport: "#0E0F11"     // main workspace
    readonly property color chrome: "#111214"       // toolbars
    readonly property color panel: "#141517"        // docks / side panels
    readonly property color panelRaised: "#181A1D"
    readonly property color card: "#1B1D21"
    readonly property color control: "#0E1013"      // input background
    readonly property color controlHover: "#202226"
    readonly property color controlPressed: "#2A2D32"
    readonly property color selection: "#25272C"    // neutral — pair with 2px accent bar

    // Accent (rare: CTA, focus ring, underline, selected-row indicator, Play)
    readonly property color accent: "#4C8DFF"
    readonly property color accentHover: "#5A98FF"
    readonly property color accentPressed: "#3977DC"
    readonly property color accentSubtle: "#17243A"

    // Borders
    readonly property color border: "#2C2F35"
    readonly property color borderSubtle: "#222429"
    readonly property color borderStrong: "#393D44"
    readonly property color splitter: "#202227"

    // Text
    readonly property color textPrimary: "#ECEEF1"
    readonly property color textSecondary: "#B5B8BE"
    readonly property color textMuted: "#7D828B"
    readonly property color textDisabled: "#51555D"

    // Semantic
    readonly property color success: "#55B88A"
    readonly property color warning: "#D4A64D"
    readonly property color error: "#DF6A73"
    readonly property color info: "#8B949E"

    // Legacy aliases (shell migration)
    readonly property color windowBackground: window
    readonly property color panelBackground: panel
    readonly property color controlBackground: control
    readonly property color panelHeader: panelRaised
    readonly property color accentMuted: accentHover
    readonly property color danger: error
    readonly property color warn: warning
    readonly property color viewportVoid: viewport
    readonly property color rowHover: controlHover
    readonly property color rowSelected: selection
}

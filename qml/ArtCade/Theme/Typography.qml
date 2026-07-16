pragma Singleton
import QtQuick

/**
 * Type scale — UI redesign (spec §16).
 * Prefer semantic tokens (sizeWorkspace, sizePanelTitle, …) over raw sizes.
 */
QtObject {
    readonly property string family: "Segoe UI"
    readonly property string familyMono: "Consolas"

    // Raw ladder
    readonly property int sizeStatus: 10
    readonly property int sizeXs: 11
    readonly property int sizeSm: 12
    readonly property int sizeMd: 13
    readonly property int sizeLg: 14
    readonly property int sizeXl: 16

    // Semantic aliases (spec §16)
    readonly property int sizeWorkspace: sizeMd       // 13 — Canvas | Logic | Script
    readonly property int sizeObjectTitle: sizeLg     // 14 — object / workspace titles
    readonly property int sizeToolbar: sizeSm         // 12 — menu & toolbar
    readonly property int sizeBody: sizeSm            // 12 — body & inputs
    readonly property int sizePanelTitle: sizeXs      // 11 — panel section titles
    readonly property int sizeMeta: sizeXs            // 11 — secondary metadata
}

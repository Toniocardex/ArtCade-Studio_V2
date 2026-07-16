pragma Singleton
import QtQuick

/**
 * ArtCade icon URLs (monochrome SVG in qrc). Tint at runtime via AcIcon.
 * Property names stay stable for toolbar call sites.
 */
QtObject {
    readonly property string _prefix: "qrc:/qt/qml/ArtCade/Ui/icons/"

    readonly property url app: _prefix + "app.svg"
    readonly property url canvas: _prefix + "canvas.svg"
    readonly property url logic: _prefix + "logic.svg"
    readonly property url script: _prefix + "script.svg"
    readonly property url undo: _prefix + "undo.svg"
    readonly property url redo: _prefix + "redo.svg"
    readonly property url save: _prefix + "save.svg"
    readonly property url build: _prefix + "build.svg"
    readonly property url play: _prefix + "play.svg"
    readonly property url stop: _prefix + "stop.svg"
    readonly property url minimize: _prefix + "minimize.svg"
    readonly property url maximize: _prefix + "maximize.svg"
    readonly property url restore: _prefix + "restore.svg"
    readonly property url close: _prefix + "close.svg"
    readonly property url search: _prefix + "search.svg"
    readonly property url add: _prefix + "add.svg"
    readonly property url eye: _prefix + "eye.svg"
    readonly property url lock: _prefix + "lock.svg"
    readonly property url select: _prefix + "select.svg"
    readonly property url pan: _prefix + "pan.svg"
    readonly property url move: _prefix + "move.svg"
    readonly property url rect: _prefix + "rect.svg"
    readonly property url grid: _prefix + "grid.svg"
    readonly property url snap: _prefix + "snap.svg"
    readonly property url chevron: _prefix + "chevron.svg"
    readonly property url folder: _prefix + "folder.svg"
    readonly property url sceneEmpty: _prefix + "sceneEmpty.svg"
}

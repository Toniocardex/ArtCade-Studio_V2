import QtQuick
import QtQuick.Controls
import QtQuick.Window
import ArtCade.Ui

/**
 * Shared editor Actions (toolbar + shortcuts). Intents only → EditorSession.
 * Instantiated once in Main; WorkspaceBar binds the same Action objects.
 *
 * Undo/Redo Actions disable while a text field has focus so Ctrl+Z/Y reach
 * TextInput instead of stealing document undo.
 */
Item {
    id: root

    readonly property alias undo: undoAction
    readonly property alias redo: redoAction
    readonly property alias save: saveAction
    readonly property alias playStop: playStopAction
    readonly property alias openFixture: openFixtureAction
    readonly property alias modeCanvas: modeCanvasAction
    readonly property alias modeLogic: modeLogicAction
    readonly property alias modeScript: modeScriptAction

    function focusIsTextInput(item) {
        if (!item)
            return false
        if (item instanceof TextInput || item instanceof TextEdit)
            return true
        if (item.contentItem && (item.contentItem instanceof TextInput
                                 || item.contentItem instanceof TextEdit))
            return true
        return false
    }

    readonly property bool textInputFocused: {
        const w = Window.window
        return focusIsTextInput(w ? w.activeFocusItem : null)
    }

    Action {
        id: undoAction
        text: qsTr("Undo")
        shortcut: StandardKey.Undo
        enabled: !root.textInputFocused
        onTriggered: EditorSession.undo()
    }
    Action {
        id: redoAction
        text: qsTr("Redo")
        shortcut: StandardKey.Redo
        enabled: !root.textInputFocused
        onTriggered: EditorSession.redo()
    }
    Action {
        id: saveAction
        text: qsTr("Save")
        shortcut: StandardKey.Save
        onTriggered: EditorSession.saveProject()
    }
    Action {
        id: playStopAction
        text: EditorSession.playing ? qsTr("Stop") : qsTr("Play")
        shortcut: "F5"
        onTriggered: EditorSession.playing ? EditorSession.stopPlay() : EditorSession.startPlay()
    }
    Action {
        id: openFixtureAction
        text: qsTr("Load Fixture")
        shortcut: "Ctrl+Shift+F"
        onTriggered: EditorSession.openSliceFixture()
    }
    Action {
        id: modeCanvasAction
        text: qsTr("Canvas")
        shortcut: "Ctrl+1"
        onTriggered: EditorSession.activeMode = "canvas"
    }
    Action {
        id: modeLogicAction
        text: qsTr("Logic Board")
        shortcut: "Ctrl+2"
        onTriggered: EditorSession.activeMode = "logic"
    }
    Action {
        id: modeScriptAction
        text: qsTr("Script Editor")
        shortcut: "Ctrl+3"
        onTriggered: EditorSession.activeMode = "script"
    }

    // Escape stops Play without mutating ProjectDoc.
    Action {
        id: stopPlayAction
        text: qsTr("Stop Play")
        shortcut: "Escape"
        enabled: EditorSession.playing
        onTriggered: EditorSession.stopPlay()
    }
}

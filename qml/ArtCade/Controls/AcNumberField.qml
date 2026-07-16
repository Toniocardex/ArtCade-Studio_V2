import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Numeric field with monospace text — commits on editingFinished.
 */
AcTextField {
    id: root

    property real value: 0
    property int decimals: 2
    property bool suppressSync: false

    font.family: Typography.familyMono
    horizontalAlignment: Text.AlignRight

    function syncFromValue() {
        suppressSync = true
        text = Number(value).toFixed(decimals)
        suppressSync = false
    }

    Component.onCompleted: syncFromValue()
    onValueChanged: {
        if (!activeFocus && !suppressSync)
            syncFromValue()
    }

    onEditingFinished: {
        const n = Number(text)
        if (!isNaN(n) && n !== value)
            value = n
        else
            syncFromValue()
    }
}

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic Board column (WHEN / IF / THEN) — flat event-sheet cell.
 * Block type exploration happens in AcLogicCatalogDialog (IDE catalog).
 */
Item {
    id: root

    /** "trigger" | "condition" | "action" */
    property string slotKind: "trigger"
    property string title: ""
    property string subtitle: ""
    property bool comfortable: false
    property var blocks: []
    property bool editable: false
    property string currentTypeId: ""
    property var propertyRows: []

    readonly property int columnPadding: comfortable ? Metrics.spacingMd : Metrics.spacingXs
    readonly property int rowSpacing: comfortable ? Metrics.spacingSm : Metrics.spacingXs

    readonly property bool isTrigger: slotKind === "trigger"
    readonly property bool isCondition: slotKind === "condition"
    readonly property bool isAction: slotKind === "action"
    readonly property bool hasBlocks: blocks && blocks.length > 0
    readonly property bool showEmptyCondition: isCondition && !hasBlocks
    readonly property string typeLabel: {
        if (!currentTypeId || currentTypeId.length === 0)
            return ""
        return EditorSession.logicBlockDisplayName(currentTypeId)
    }

    signal catalogRequested()
    signal propertyEdited(string propertyKey, string valueText)

    implicitHeight: col.implicitHeight + columnPadding * 2
    implicitWidth: 120

    ColumnLayout {
        id: col
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: root.columnPadding
        spacing: root.rowSpacing

        Column {
            Layout.fillWidth: true
            spacing: 1

            Text {
                text: root.title
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizePanelTitle
                font.weight: Font.DemiBold
            }
            Text {
                visible: root.comfortable && root.subtitle.length > 0
                text: root.subtitle
                color: Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeMeta
            }
        }

        // IF empty
        Column {
            Layout.fillWidth: true
            spacing: Metrics.spacingXs
            visible: root.showEmptyCondition

            Text {
                width: parent.width
                text: "No conditions"
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                font.weight: Font.DemiBold
            }
            Text {
                width: parent.width
                wrapMode: Text.WordWrap
                text: "Runs whenever the event occurs."
                color: Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeMeta
            }
            AcButton {
                text: "+ Add Condition"
                enabled: root.editable && !EditorSession.playing
                onClicked: root.catalogRequested()
            }
        }

        // Chosen block + Change / Select
        RowLayout {
            Layout.fillWidth: true
            spacing: Metrics.spacingXs
            visible: root.editable && !root.showEmptyCondition

            Text {
                Layout.fillWidth: true
                text: root.typeLabel.length > 0
                      ? root.typeLabel
                      : (root.isTrigger ? "No trigger"
                         : root.isAction ? "No action"
                         : "Select…")
                color: root.typeLabel.length > 0 ? Theme.textPrimary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }

            AcButton {
                text: root.typeLabel.length > 0 ? "Change" : "Select…"
                enabled: !EditorSession.playing
                onClicked: root.catalogRequested()
            }
        }

        // Extra THEN actions beyond the primary — label only
        Column {
            Layout.fillWidth: true
            spacing: root.rowSpacing
            visible: root.isAction && root.blocks.length > 1

            Repeater {
                model: {
                    const out = []
                    for (let i = 1; i < root.blocks.length; ++i)
                        out.push(root.blocks[i])
                    return out
                }
                delegate: Text {
                    required property string modelData
                    width: parent.width
                    text: EditorSession.logicBlockDisplayName(modelData)
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeMeta
                    elide: Text.ElideRight
                }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: root.rowSpacing
            visible: root.editable && root.hasBlocks

            Repeater {
                model: root.editable ? root.propertyRows : []
                delegate: AcLogicPropertyEditor {
                    required property var modelData
                    Layout.fillWidth: true
                    propertyKey: modelData.key || ""
                    kind: modelData.kind || "string"
                    valueText: modelData.value || ""
                    choices: modelData.choices || []
                    onEdited: function(valueText) {
                        root.propertyEdited(propertyKey, valueText)
                    }
                }
            }
        }
    }
}

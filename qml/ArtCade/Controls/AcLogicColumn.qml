import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic Board column (WHEN / IF / THEN) — flat event-sheet cell.
 * No nested card chrome; Column+Repeater (never a nested ListView).
 * Slot-specific anti-duplication: trigger = single ComboBox; IF empty =
 * compact empty + Add Condition; THEN = one editable unit per primary action.
 */
Item {
    id: root

    /** "trigger" | "condition" | "action" — drives empty/picker rules. */
    property string slotKind: "trigger"
    property string title: ""
    property string subtitle: ""
    property bool comfortable: false
    property bool showDescriptions: comfortable
    property var blocks: []
    property bool editable: false
    property var catalogTypeIds: []
    property string currentTypeId: ""
    property var propertyRows: []
    /** Local: after "+ Add Condition" until a type is chosen or cancelled. */
    property bool pickingCondition: false

    readonly property int columnPadding: comfortable ? Metrics.spacingMd : Metrics.spacingXs
    readonly property int rowSpacing: comfortable ? Metrics.spacingSm : Metrics.spacingXs

    readonly property bool isTrigger: slotKind === "trigger"
    readonly property bool isCondition: slotKind === "condition"
    readonly property bool isAction: slotKind === "action"
    readonly property bool hasBlocks: blocks && blocks.length > 0
    readonly property bool showEmptyCondition: isCondition && !hasBlocks && !pickingCondition
    readonly property bool showTypePicker: editable && catalogTypeIds.length > 0
            && (isTrigger || isAction || (isCondition && (hasBlocks || pickingCondition)))

    /** Catalog model — IF empty-picker has no leading "None" entry. */
    readonly property var comboModel: catalogTypeIds

    signal typeChosen(string typeId)
    signal propertyEdited(string propertyKey, string valueText)

    implicitHeight: col.implicitHeight + columnPadding * 2
    implicitWidth: 120

    function labelForTypeId(typeId) {
        if (!typeId || typeId.length === 0)
            return "—"
        return EditorSession.logicBlockDisplayName(typeId)
    }

    function descriptionForTypeId(typeId) {
        if (!typeId || typeId.length === 0)
            return ""
        return EditorSession.logicBlockDescription(typeId)
    }

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

        // IF empty — compact, no "None (always)" combo
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
                enabled: !EditorSession.playing
                onClicked: root.pickingCondition = true
            }
        }

        // Trigger / Action / Condition-with-type: single ComboBox (no chip list)
        ComboBox {
            id: catalogBox
            Layout.fillWidth: true
            visible: root.showTypePicker
            model: root.comboModel
            enabled: !EditorSession.playing
            palette.mid: Theme.panel
            palette.window: Theme.panel
            palette.base: Theme.panel
            palette.button: Theme.panelRaised
            palette.highlight: Theme.controlHover
            palette.highlightedText: Theme.textPrimary
            palette.text: Theme.textPrimary
            palette.buttonText: Theme.textPrimary

            contentItem: Text {
                leftPadding: Metrics.spacingSm
                rightPadding: catalogBox.indicator.width + Metrics.spacingSm
                text: catalogBox.currentIndex >= 0
                      ? root.labelForTypeId(String(root.comboModel[catalogBox.currentIndex] || ""))
                      : (root.isTrigger ? "Select trigger…"
                         : root.isAction ? "Select action…"
                         : "Select condition…")
                color: catalogBox.currentIndex >= 0 ? Theme.textPrimary : Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
            }

            background: Rectangle {
                implicitHeight: Metrics.controlHeight
                radius: Metrics.radiusControl
                color: catalogBox.hovered ? Theme.controlHover : Theme.control
                border.color: catalogBox.popup.visible ? Theme.accent : Theme.borderSubtle
                border.width: 1
            }

            popup: Popup {
                y: catalogBox.height + 2
                width: Math.max(catalogBox.width, 220)
                implicitHeight: Math.min(contentItem.implicitHeight + 8, 300)
                padding: 4
                closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutsideParent

                contentItem: ListView {
                    clip: true
                    implicitHeight: contentHeight
                    boundsBehavior: Flickable.StopAtBounds
                    model: catalogBox.popup.visible ? catalogBox.delegateModel : null
                    currentIndex: catalogBox.highlightedIndex
                    ScrollIndicator.vertical: ScrollIndicator {}
                    spacing: 2
                }

                background: Rectangle {
                    color: Theme.selection
                    border.color: Theme.borderStrong
                    border.width: 1
                    radius: Metrics.radiusCard
                }
            }

            delegate: AcLogicCatalogItem {
                required property string modelData
                required property int index
                width: ListView.view ? ListView.view.width : catalogBox.width
                typeId: modelData
                title: root.labelForTypeId(modelData)
                description: root.showDescriptions ? root.descriptionForTypeId(modelData) : ""
                isCurrent: (modelData || "") === (root.currentTypeId || "")
                highlighted: catalogBox.highlightedIndex === index
            }

            Component.onCompleted: syncIndex()
            onActivated: function(index) {
                const id = root.comboModel[index]
                const current = root.currentTypeId || ""
                if (id !== current)
                    root.typeChosen(id)
                root.pickingCondition = false
            }

            function syncIndex() {
                const current = root.currentTypeId || ""
                const i = root.comboModel.indexOf(current)
                // Never leave ComboBox on a default first item when unset —
                // that falsely showed "On Start" beside "No trigger".
                catalogBox.currentIndex = i
            }
        }

        // Extra THEN actions beyond the primary — label only (API edits primary)
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
            visible: root.showTypePicker && root.hasBlocks

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

        // (empty trigger uses ComboBox placeholder — no duplicate "No trigger" label)
    }

    onCurrentTypeIdChanged: {
        if (catalogBox.visible)
            catalogBox.syncIndex()
        if (root.hasBlocks)
            root.pickingCondition = false
    }
    onCatalogTypeIdsChanged: {
        if (catalogBox.visible)
            catalogBox.syncIndex()
    }
    onBlocksChanged: {
        if (root.hasBlocks)
            root.pickingCondition = false
    }
}

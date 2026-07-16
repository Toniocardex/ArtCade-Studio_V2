import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic Board column (WHEN / IF / THEN) — flat event-sheet cell.
 * Catalog exploration lives in AcLogicCatalogDialog; this shows the result + properties.
 */
Item {
    id: root

    /** "trigger" | "condition" | "action" */
    property string slotKind: "trigger"
    property string title: ""
    property bool comfortable: false
    property var blocks: []
    property bool editable: false
    property string currentTypeId: ""
    property var propertyRows: []

    readonly property int columnPadding: comfortable ? Metrics.spacingMd : Metrics.spacingSm
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
    readonly property string catalogButtonLabel: {
        if (showEmptyCondition)
            return "+ Add"
        if (typeLabel.length > 0)
            return "Change"
        return "Select…"
    }
    readonly property bool catalogEnabled: root.editable && !EditorSession.playing

    signal catalogRequested()
    signal propertyEdited(string propertyKey, string valueText)

    implicitHeight: col.implicitHeight + columnPadding * 2
    implicitWidth: 120

    component CatalogCta: Item {
        id: cta
        property string label: ""
        property bool interactive: true

        implicitWidth: ctaLabel.implicitWidth + Metrics.spacingXs
        implicitHeight: Math.max(22, ctaLabel.implicitHeight + 4)

        Text {
            id: ctaLabel
            anchors.centerIn: parent
            text: cta.label
            color: cta.interactive ? Theme.accent : Theme.textDisabled
            font.family: Typography.family
            font.pixelSize: Typography.sizeToolbar
            font.weight: Font.DemiBold
            opacity: ctaMa.containsMouse && cta.interactive ? 0.85 : 1.0
        }

        // MouseArea (not TapHandler): ListView/Flickable steals TapHandler presses.
        MouseArea {
            id: ctaMa
            anchors.fill: parent
            enabled: cta.interactive
            hoverEnabled: true
            cursorShape: cta.interactive ? Qt.PointingHandCursor : Qt.ArrowCursor
            preventStealing: true
            onClicked: root.catalogRequested()
        }
    }

    ColumnLayout {
        id: col
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: root.columnPadding
        spacing: root.rowSpacing

        Text {
            Layout.fillWidth: true
            text: root.title
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeMeta
            font.weight: Font.DemiBold
            font.letterSpacing: 0.6
        }

        // IF empty — result + quiet CTA
        RowLayout {
            Layout.fillWidth: true
            spacing: Metrics.spacingSm
            visible: root.showEmptyCondition

            Text {
                Layout.fillWidth: true
                text: "No conditions"
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }

            CatalogCta {
                label: root.catalogButtonLabel
                interactive: root.catalogEnabled
            }
        }

        Text {
            Layout.fillWidth: true
            visible: root.showEmptyCondition && root.comfortable
            wrapMode: Text.WordWrap
            text: "Runs whenever the event occurs."
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeMeta
        }

        // Chosen block + Change / Select
        RowLayout {
            Layout.fillWidth: true
            spacing: Metrics.spacingSm
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

            CatalogCta {
                label: root.catalogButtonLabel
                interactive: !EditorSession.playing
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

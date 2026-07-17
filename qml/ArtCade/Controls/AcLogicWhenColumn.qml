import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * WHEN column: trigger + AND condition clauses + Add condition CTA.
 * Presentation only — mutations via signals → EditorSession.
 */
Item {
    id: root

    property bool comfortable: false
    property string triggerTypeId: ""
    property var triggerProperties: []
    /** Optional block description from the bridge snapshot (may be empty). */
    property string triggerDescription: ""
    /** [{index,typeId,displayName,description,properties}] */
    property var conditionClauses: []

    readonly property int columnPadding: comfortable ? Metrics.spacingMd : Metrics.spacingSm
    readonly property int rowSpacing: comfortable ? Metrics.spacingSm : Metrics.spacingXs
    readonly property string triggerLabel: {
        if (!triggerTypeId || triggerTypeId.length === 0)
            return ""
        return EditorSession.logicBlockDisplayName(triggerTypeId)
    }
    readonly property string catalogButtonLabel: triggerLabel.length > 0 ? "Change" : "Select…"
    readonly property bool catalogEnabled: !EditorSession.playing
    readonly property int clauseCount: conditionClauses ? conditionClauses.length : 0

    signal triggerCatalogRequested()
    signal triggerPropertyEdited(string propertyKey, string valueText)
    /** index -1 means Add condition. */
    signal conditionCatalogRequested(int index)
    signal conditionPropertyEdited(int index, string propertyKey, string valueText)
    signal conditionMoveRequested(int from, int to)
    signal conditionDeleteRequested(int index)

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

        MouseArea {
            id: ctaMa
            anchors.fill: parent
            enabled: cta.interactive
            hoverEnabled: true
            cursorShape: cta.interactive ? Qt.PointingHandCursor : Qt.ArrowCursor
            preventStealing: true
            onClicked: root.triggerCatalogRequested()
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
            text: "WHEN"
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeMeta
            font.weight: Font.DemiBold
            font.letterSpacing: 0.6
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Metrics.spacingSm

            Text {
                Layout.fillWidth: true
                text: root.triggerLabel.length > 0 ? root.triggerLabel : "No trigger"
                color: root.triggerLabel.length > 0 ? Theme.textPrimary : Theme.textMuted
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
            visible: root.comfortable && root.triggerDescription.length > 0
            wrapMode: Text.WordWrap
            text: root.triggerDescription
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeMeta
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: root.rowSpacing
            visible: root.triggerLabel.length > 0
                     && root.triggerProperties && root.triggerProperties.length > 0

            Repeater {
                model: root.triggerProperties || []
                delegate: AcLogicPropertyEditor {
                    required property var modelData
                    Layout.fillWidth: true
                    propertyKey: modelData.key || ""
                    displayName: modelData.displayName || ""
                    kind: modelData.kind || "string"
                    valueText: modelData.value || ""
                    choices: modelData.choices || []
                    onEdited: function(valueText) {
                        root.triggerPropertyEdited(propertyKey, valueText)
                    }
                }
            }
        }

        Repeater {
            model: root.conditionClauses || []
            delegate: AcLogicConditionRow {
                required property var modelData
                required property int index
                Layout.fillWidth: true
                conditionIndex: modelData.index !== undefined ? modelData.index : index
                displayName: modelData.displayName || ""
                description: modelData.description || ""
                propertyRows: modelData.properties || []
                comfortable: root.comfortable
                canMoveUp: conditionIndex > 0
                canMoveDown: conditionIndex + 1 < root.clauseCount
                onCatalogRequested: root.conditionCatalogRequested(conditionIndex)
                onPropertyEdited: function(key, value) {
                    root.conditionPropertyEdited(conditionIndex, key, value)
                }
                onMoveUpRequested: root.conditionMoveRequested(conditionIndex,
                                                              conditionIndex - 1)
                onMoveDownRequested: root.conditionMoveRequested(conditionIndex,
                                                                conditionIndex + 1)
                onDeleteRequested: root.conditionDeleteRequested(conditionIndex)
            }
        }

        Item {
            id: addConditionCta
            Layout.fillWidth: true
            implicitHeight: Math.max(22, addLabel.implicitHeight + 4)
            visible: true
            opacity: root.catalogEnabled ? 1.0 : 0.5

            Text {
                id: addLabel
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                text: "+ Add condition"
                color: root.catalogEnabled ? Theme.accent : Theme.textDisabled
                font.family: Typography.family
                font.pixelSize: Typography.sizeToolbar
                font.weight: Font.DemiBold
                opacity: addMa.containsMouse && root.catalogEnabled ? 0.85 : 1.0
            }

            MouseArea {
                id: addMa
                anchors.fill: parent
                enabled: root.catalogEnabled
                hoverEnabled: true
                cursorShape: root.catalogEnabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                preventStealing: true
                onClicked: root.conditionCatalogRequested(-1)
            }
        }
    }
}

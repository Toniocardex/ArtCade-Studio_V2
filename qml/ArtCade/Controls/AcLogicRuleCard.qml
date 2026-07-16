import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic item as an event-sheet card.
 * Collapsed: Logic NN · Trigger → Action. Expanded: Logic NN + WHEN|IF|THEN body.
 * Presentation only — mutations via signals → EditorSession.
 */
Rectangle {
    id: root

    property var rule: ({})
    property int orderIndex: 0
    property bool expanded: false
    property bool comfortable: false
    property var searchTerms: []

    signal selectRequested()
    signal deleteRequested()
    signal enabledToggled(bool enabled)
    signal triggerChosen(string typeId)
    signal conditionChosen(string typeId)
    signal actionChosen(string typeId)
    signal propertyEdited(string slot, string propertyKey, string valueText)
    signal contextMenuRequested()

    readonly property bool ruleEnabled: rule.enabled === true
    readonly property var conditionIds: rule.conditionTypeIds || []
    readonly property var actionIds: rule.actionTypeIds || []
    readonly property var triggerProperties: rule.triggerProperties || []
    readonly property var conditionProperties: rule.conditionProperties || []
    readonly property var actionProperties: rule.actionProperties || []
    readonly property real summaryOpacity: ruleEnabled ? 1.0 : 0.45
    readonly property bool highlighting: searchTerms && searchTerms.length > 0

    readonly property int logicOuterPadding: comfortable ? Metrics.spacingMd : Metrics.spacingSm
    readonly property int logicSectionSpacing: comfortable ? Metrics.spacingMd : Metrics.spacingSm
    readonly property string logicLabel: "Logic "
            + String(root.orderIndex + 1).padStart(2, "0")
    readonly property string collapsedSummary: {
        const trigger = EditorSession.logicBlockDisplayName(root.rule.triggerTypeId || "")
        const action = root.actionIds.length > 0
                       ? EditorSession.logicBlockDisplayName(root.actionIds[0])
                       : ""
        if (trigger.length === 0 && action.length === 0)
            return root.logicLabel
        if (action.length === 0)
            return root.logicLabel + " · " + trigger
        return root.logicLabel + " · " + trigger + " → " + action
    }
    /** Stack WHEN/IF/THEN below this width (Inspector open / narrow center). */
    readonly property bool stackedColumns: width > 0 && width < 720

    function highlightText(text) {
        if (!highlighting)
            return text
        let out = String(text).replace(/&/g, "&amp;")
                              .replace(/</g, "&lt;")
                              .replace(/>/g, "&gt;")
        const escaped = []
        for (let i = 0; i < searchTerms.length; ++i) {
            const term = String(searchTerms[i])
            if (term.length > 0)
                escaped.push(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        }
        if (escaped.length === 0)
            return out
        const re = new RegExp("(" + escaped.join("|") + ")", "gi")
        return out.replace(re, "<font color=\"" + Theme.accent + "\">$1</font>")
    }

    implicitHeight: cardColumn.implicitHeight
    radius: Metrics.radiusCard
    color: expanded ? Theme.panelRaised
                    : (cardMa.containsMouse ? Theme.controlHover : Theme.control)
    border.width: 1
    border.color: expanded ? Theme.border : Theme.borderSubtle
    clip: true

    MouseArea {
        id: cardMa
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        onClicked: function(mouse) {
            root.selectRequested()
            if (mouse.button === Qt.RightButton)
                root.contextMenuRequested()
        }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 2
        color: Theme.accent
        visible: root.expanded
    }

    ColumnLayout {
        id: cardColumn
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: 0

        // —— Header ——
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            Layout.leftMargin: root.logicOuterPadding
            Layout.rightMargin: Metrics.spacingXs
            spacing: Metrics.spacingSm

            Item {
                Layout.preferredWidth: 16
                Layout.preferredHeight: 16
                ToolTip.visible: toggleMa.containsMouse
                ToolTip.delay: 400
                ToolTip.text: root.ruleEnabled
                              ? "Enabled — runs during Play. Click to disable."
                              : "Disabled — skipped during Play. Click to enable."

                Rectangle {
                    anchors.centerIn: parent
                    width: 14
                    height: 14
                    radius: Metrics.radiusControl
                    color: "transparent"
                    border.width: 1
                    border.color: toggleMa.containsMouse ? Theme.accent : Theme.border

                    Rectangle {
                        anchors.centerIn: parent
                        width: 8
                        height: 8
                        radius: 2
                        color: Theme.accent
                        visible: root.ruleEnabled
                    }
                }

                MouseArea {
                    id: toggleMa
                    anchors.fill: parent
                    hoverEnabled: true
                    enabled: !EditorSession.playing
                    onClicked: root.enabledToggled(!root.ruleEnabled)
                }
            }

            Text {
                visible: (root.rule.errorCount || 0) > 0 || (root.rule.warningCount || 0) > 0
                text: "⚠"
                color: (root.rule.errorCount || 0) > 0 ? Theme.error : Theme.warning
                font.pixelSize: Typography.sizeXs
                ToolTip.visible: diagMa.containsMouse
                ToolTip.delay: 200
                ToolTip.text: {
                    const rows = root.rule.diagnostics || []
                    const parts = []
                    for (let i = 0; i < rows.length; ++i)
                        parts.push(rows[i].severity + ": " + rows[i].message)
                    return parts.join("\n")
                }
                MouseArea {
                    id: diagMa
                    anchors.fill: parent
                    hoverEnabled: true
                    acceptedButtons: Qt.NoButton
                }
            }

            Text {
                Layout.fillWidth: true
                text: root.highlightText(
                          root.expanded ? root.logicLabel : root.collapsedSummary)
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                font.weight: Font.DemiBold
                elide: Text.ElideRight
                opacity: root.summaryOpacity
            }

            // Overflow — Delete Logic wired; Duplicate/Move coming next
            Button {
                id: overflowBtn
                flat: true
                text: "⋯"
                implicitWidth: 28
                implicitHeight: 28
                enabled: !EditorSession.playing
                onClicked: {
                    root.selectRequested()
                    overflowMenu.open()
                }

                contentItem: Text {
                    text: overflowBtn.text
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeObjectTitle
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
                background: Rectangle {
                    radius: Metrics.radiusControl
                    color: overflowBtn.hovered ? Theme.controlHover : "transparent"
                }

                AcMenu {
                    id: overflowMenu
                    AcMenuItem {
                        text: "Duplicate Logic"
                        enabled: false
                        ToolTip.visible: hovered
                        ToolTip.text: "Coming next"
                    }
                    AcMenuItem {
                        text: "Move Up"
                        enabled: false
                        ToolTip.visible: hovered
                        ToolTip.text: "Coming next"
                    }
                    AcMenuItem {
                        text: "Move Down"
                        enabled: false
                        ToolTip.visible: hovered
                        ToolTip.text: "Coming next"
                    }
                    AcMenuItem {
                        text: "Delete Logic"
                        enabled: !EditorSession.playing
                        onTriggered: root.deleteRequested()
                    }
                }
            }
        }

        // —— Expanded body: WHEN | IF | THEN ——
        Loader {
            Layout.fillWidth: true
            Layout.leftMargin: Metrics.spacingXs
            Layout.rightMargin: Metrics.spacingXs
            Layout.bottomMargin: root.logicOuterPadding
            active: root.expanded
            sourceComponent: root.stackedColumns ? stackedBody : rowBody
        }
    }

    Component {
        id: rowBody
        RowLayout {
            spacing: 0
            width: root.width - Metrics.spacingXs * 2

            AcLogicColumn {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignTop
                slotKind: "trigger"
                title: "WHEN"
                subtitle: "Trigger"
                comfortable: root.comfortable
                blocks: (root.rule.triggerTypeId || "").length > 0
                        ? [root.rule.triggerTypeId] : []
                editable: true
                catalogTypeIds: EditorSession.logicTriggerCatalog
                currentTypeId: root.rule.triggerTypeId || ""
                propertyRows: root.triggerProperties
                onTypeChosen: function(typeId) { root.triggerChosen(typeId) }
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("trigger", key, value)
                }
            }
            Rectangle {
                Layout.fillHeight: true
                Layout.preferredWidth: 1
                Layout.minimumHeight: 48
                color: Theme.borderSubtle
            }
            AcLogicColumn {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignTop
                slotKind: "condition"
                title: "IF"
                subtitle: "Conditions (optional)"
                comfortable: root.comfortable
                blocks: root.conditionIds
                editable: true
                catalogTypeIds: EditorSession.logicConditionCatalog
                currentTypeId: root.conditionIds.length > 0 ? root.conditionIds[0] : ""
                propertyRows: root.conditionProperties
                onTypeChosen: function(typeId) { root.conditionChosen(typeId) }
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("condition", key, value)
                }
            }
            Rectangle {
                Layout.fillHeight: true
                Layout.preferredWidth: 1
                Layout.minimumHeight: 48
                color: Theme.borderSubtle
            }
            AcLogicColumn {
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignTop
                slotKind: "action"
                title: "THEN"
                subtitle: "Actions"
                comfortable: root.comfortable
                blocks: root.actionIds
                editable: true
                catalogTypeIds: EditorSession.logicActionCatalog
                currentTypeId: root.actionIds.length > 0 ? root.actionIds[0] : ""
                propertyRows: root.actionProperties
                onTypeChosen: function(typeId) { root.actionChosen(typeId) }
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("action", key, value)
                }
            }
        }
    }

    Component {
        id: stackedBody
        ColumnLayout {
            spacing: 0
            width: root.width - Metrics.spacingXs * 2

            AcLogicColumn {
                Layout.fillWidth: true
                slotKind: "trigger"
                title: "WHEN"
                subtitle: "Trigger"
                comfortable: root.comfortable
                blocks: (root.rule.triggerTypeId || "").length > 0
                        ? [root.rule.triggerTypeId] : []
                editable: true
                catalogTypeIds: EditorSession.logicTriggerCatalog
                currentTypeId: root.rule.triggerTypeId || ""
                propertyRows: root.triggerProperties
                onTypeChosen: function(typeId) { root.triggerChosen(typeId) }
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("trigger", key, value)
                }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 1
                color: Theme.borderSubtle
            }
            AcLogicColumn {
                Layout.fillWidth: true
                slotKind: "condition"
                title: "IF"
                subtitle: "Conditions (optional)"
                comfortable: root.comfortable
                blocks: root.conditionIds
                editable: true
                catalogTypeIds: EditorSession.logicConditionCatalog
                currentTypeId: root.conditionIds.length > 0 ? root.conditionIds[0] : ""
                propertyRows: root.conditionProperties
                onTypeChosen: function(typeId) { root.conditionChosen(typeId) }
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("condition", key, value)
                }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 1
                color: Theme.borderSubtle
            }
            AcLogicColumn {
                Layout.fillWidth: true
                slotKind: "action"
                title: "THEN"
                subtitle: "Actions"
                comfortable: root.comfortable
                blocks: root.actionIds
                editable: true
                catalogTypeIds: EditorSession.logicActionCatalog
                currentTypeId: root.actionIds.length > 0 ? root.actionIds[0] : ""
                propertyRows: root.actionProperties
                onTypeChosen: function(typeId) { root.actionChosen(typeId) }
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("action", key, value)
                }
            }
        }
    }
}

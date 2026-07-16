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
    /** Local expand state — cards start collapsed; not tied to selection. */
    property bool expanded: false
    property bool selected: false
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
    color: root.expanded || root.selected ? Theme.panelRaised
                    : (cardMa.containsMouse ? Theme.controlHover : Theme.control)
    border.width: 1
    border.color: root.expanded || root.selected ? Theme.border : Theme.borderSubtle
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
        onDoubleClicked: function(mouse) {
            if (mouse.button === Qt.LeftButton)
                root.expanded = !root.expanded
        }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 2
        color: Theme.accent
        visible: root.selected || root.expanded
    }

    ColumnLayout {
        id: cardColumn
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: 0

        // —— Header: title · Enabled · ⋯ ——
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            Layout.leftMargin: root.logicOuterPadding + 4
            Layout.rightMargin: Metrics.spacingXs
            spacing: Metrics.spacingSm

            // No emoji / Canvas: ⚠ tofu + Canvas opaque buffer both showed a grey square.
            Rectangle {
                id: warnBadge
                visible: (root.rule.errorCount || 0) > 0 || (root.rule.warningCount || 0) > 0
                Layout.preferredWidth: 14
                Layout.preferredHeight: 14
                Layout.alignment: Qt.AlignVCenter
                radius: 2
                color: (root.rule.errorCount || 0) > 0 ? Theme.error : Theme.warning
                ToolTip.visible: warnHover.hovered
                ToolTip.delay: 400
                ToolTip.text: {
                    const rows = root.rule.diagnostics || []
                    const parts = []
                    for (let i = 0; i < rows.length; ++i)
                        parts.push(rows[i].severity + ": " + rows[i].message)
                    return parts.length > 0 ? parts.join("\n") : "Validation warning"
                }
                HoverHandler { id: warnHover }

                Text {
                    anchors.centerIn: parent
                    text: "!"
                    color: Theme.window
                    font.family: Typography.family
                    font.pixelSize: 10
                    font.weight: Font.Bold
                }
            }

            Text {
                id: titleLabel
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignVCenter
                Layout.minimumWidth: 80
                height: Typography.sizeBody + 4
                text: root.highlightText(
                          root.expanded ? root.logicLabel : root.collapsedSummary)
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizeBody
                font.weight: Font.DemiBold
                elide: Text.ElideRight
                opacity: root.summaryOpacity
                verticalAlignment: Text.AlignVCenter
            }

            // Plain Item chrome — Qt Button can leave an empty indicator square.
            Rectangle {
                id: enabledBtn
                Layout.alignment: Qt.AlignVCenter
                Layout.preferredHeight: 26
                Layout.preferredWidth: enabledLabel.implicitWidth + Metrics.spacingMd * 2
                radius: Metrics.radiusControl
                color: enabledMa.containsMouse ? Theme.controlHover : Theme.control
                border.width: 1
                border.color: root.ruleEnabled ? Theme.accent : Theme.border
                opacity: EditorSession.playing ? 0.5 : 1.0

                Text {
                    id: enabledLabel
                    anchors.centerIn: parent
                    text: root.ruleEnabled ? "Enabled" : "Disabled"
                    color: root.ruleEnabled ? Theme.textPrimary : Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeToolbar
                    font.weight: Font.DemiBold
                }

                MouseArea {
                    id: enabledMa
                    anchors.fill: parent
                    hoverEnabled: true
                    enabled: !EditorSession.playing
                    onClicked: {
                        root.selectRequested()
                        root.enabledToggled(!root.ruleEnabled)
                    }
                }
                ToolTip.visible: enabledMa.containsMouse
                ToolTip.delay: 400
                ToolTip.text: root.ruleEnabled
                              ? "Enabled — runs during Play. Click to disable."
                              : "Disabled — skipped during Play. Click to enable."
            }

            Rectangle {
                id: overflowBtn
                Layout.alignment: Qt.AlignVCenter
                Layout.preferredWidth: 28
                Layout.preferredHeight: 28
                radius: Metrics.radiusControl
                color: overflowMa.containsMouse ? Theme.controlHover : "transparent"
                opacity: EditorSession.playing ? 0.5 : 1.0

                Text {
                    anchors.centerIn: parent
                    text: "⋯"
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeObjectTitle
                }

                MouseArea {
                    id: overflowMa
                    anchors.fill: parent
                    hoverEnabled: true
                    enabled: !EditorSession.playing
                    onClicked: {
                        root.selectRequested()
                        overflowMenu.open()
                    }
                }

                AcMenu {
                    id: overflowMenu
                    AcMenuItem {
                        text: "Duplicate Logic"
                        enabled: false
                    }
                    AcMenuItem {
                        text: "Move Up"
                        enabled: false
                    }
                    AcMenuItem {
                        text: "Move Down"
                        enabled: false
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

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic rule as a compact row that expands inline when selected.
 * Presentation only — mutations are emitted as signals; the parent routes
 * them to EditorSession commands (single write path).
 */
Rectangle {
    id: root

    /** Summary map from EditorSession.logicRules ({id, enabled, trigger…}). */
    property var rule: ({})
    /** Zero-based execution index; rendered as the 1-based order number. */
    property int orderIndex: 0
    /** Selected rule — shows the inline When / Conditions / Then editor. */
    property bool expanded: false
    /** Comfortable density: conditions and actions on their own lines. */
    property bool comfortable: false
    /** Active search terms — matches inside summaries render accent-colored. */
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
    readonly property int maxPropertyCount: Math.max(
        triggerProperties.length,
        conditionProperties.length,
        actionProperties.length)
    readonly property real summaryOpacity: ruleEnabled ? 1.0 : 0.45

    readonly property bool highlighting: searchTerms && searchTerms.length > 0

    /**
     * HTML-escapes @p text and wraps search-term matches in accent color.
     * Used with Text.StyledText only while a search is active (elide needs
     * plain text, so idle summaries stay plain).
     */
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

    /** " · <value>" suffix from the primary block's first authorable property. */
    function primaryDetail(props) {
        if (!props || props.length === 0)
            return ""
        const row = props[0]
        const label = String(row.valueLabel !== undefined ? row.valueLabel : row.value)
        return label.length > 0 ? " · " + label : ""
    }

    /**
     * Joins display names, capping at @p max entries plus a "+N more" tail.
     * The first (primary) entry carries its leading property value.
     */
    function blockSummary(ids, max, primaryProps) {
        const shown = Math.min(ids.length, max)
        const parts = []
        for (let i = 0; i < shown; ++i) {
            let name = EditorSession.logicBlockDisplayName(ids[i])
            if (i === 0)
                name += primaryDetail(primaryProps)
            parts.push(name)
        }
        if (ids.length > shown)
            parts.push("+" + (ids.length - shown) + " more")
        return parts.join(" · ")
    }

    implicitHeight: cardColumn.implicitHeight
    radius: Metrics.radiusSmall
    color: expanded ? Theme.panelRaised
                    : (cardMa.containsMouse ? Theme.controlHover : Theme.control)
    border.width: 1
    border.color: expanded ? Theme.border : Theme.borderSubtle

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
        // Selection marker: 2px accent bar, no bright full border.
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 2
        radius: 1
        color: Theme.accent
        visible: root.expanded
    }

    ColumnLayout {
        id: cardColumn
        anchors.left: parent.left
        anchors.right: parent.right
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            Layout.leftMargin: Metrics.spacingMd
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
                    radius: 3
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
                text: String(root.orderIndex + 1).padStart(2, "0")
                color: Theme.textMuted
                font.family: Typography.familyMono
                font.pixelSize: Typography.sizeXs
                opacity: root.summaryOpacity
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
                text: root.highlightText(
                          EditorSession.logicBlockDisplayName(root.rule.triggerTypeId || "")
                          + root.primaryDetail(root.triggerProperties))
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizeSm
                font.weight: Font.DemiBold
                elide: Text.ElideRight
                Layout.maximumWidth: 260
                opacity: root.summaryOpacity
            }

            Text {
                visible: !root.comfortable && !root.expanded && root.conditionIds.length > 0
                text: root.highlightText(
                          "IF " + root.blockSummary(root.conditionIds, 2,
                                                    root.conditionProperties))
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                elide: Text.ElideRight
                Layout.maximumWidth: 260
                opacity: root.summaryOpacity
            }

            Text {
                visible: !root.comfortable && !root.expanded && root.actionIds.length > 0
                Layout.fillWidth: true
                text: root.highlightText(
                          "DO " + root.blockSummary(root.actionIds, 3,
                                                    root.actionProperties))
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                elide: Text.ElideRight
                opacity: root.summaryOpacity
            }

            Item {
                Layout.fillWidth: true
                visible: root.comfortable || root.expanded || root.actionIds.length === 0
            }

            AcToolButton {
                iconSource: Icons.close
                implicitWidth: 22
                implicitHeight: 22
                visible: cardMa.containsMouse || hovered || root.expanded
                enabled: !EditorSession.playing
                ToolTip.visible: hovered
                ToolTip.delay: 400
                ToolTip.text: "Delete this rule (undoable)"
                onClicked: root.deleteRequested()
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.leftMargin: Metrics.spacingMd + 16 + Metrics.spacingSm
            Layout.rightMargin: Metrics.spacingMd
            Layout.bottomMargin: Metrics.spacingSm
            spacing: 2
            visible: root.comfortable && !root.expanded

            Text {
                visible: root.conditionIds.length > 0
                Layout.fillWidth: true
                text: root.highlightText(
                          "IF " + root.blockSummary(root.conditionIds, 3,
                                                    root.conditionProperties))
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                elide: Text.ElideRight
                opacity: root.summaryOpacity
            }
            Text {
                visible: root.actionIds.length > 0
                Layout.fillWidth: true
                text: root.highlightText(
                          "DO " + root.blockSummary(root.actionIds, 3,
                                                    root.actionProperties))
                textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                elide: Text.ElideRight
                opacity: root.summaryOpacity
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 190 + root.maxPropertyCount * 44
            Layout.leftMargin: Metrics.spacingXs
            Layout.rightMargin: Metrics.spacingXs
            Layout.bottomMargin: Metrics.spacingXs
            spacing: 0
            visible: root.expanded

            AcLogicColumn {
                Layout.fillWidth: true
                Layout.fillHeight: true
                title: "When"
                subtitle: "Trigger"
                accent: Theme.accent
                emptyText: "No trigger"
                boardHasRules: true
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
                color: Theme.borderSubtle
            }

            AcLogicColumn {
                Layout.fillWidth: true
                Layout.fillHeight: true
                title: "Also require…"
                subtitle: "Conditions (optional)"
                accent: Theme.warning
                emptyText: "None — this rule always runs when the trigger fires"
                boardHasRules: true
                blocks: root.conditionIds
                editable: true
                allowNone: true
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
                color: Theme.borderSubtle
            }

            AcLogicColumn {
                Layout.fillWidth: true
                Layout.fillHeight: true
                title: "Then"
                subtitle: "Actions"
                accent: Theme.success
                emptyText: "No actions — this rule has no effect"
                boardHasRules: true
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

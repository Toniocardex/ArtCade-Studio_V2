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
    /** Workspace-owned expansion state, supplied by LogicBoardView. */
    property bool expanded: true
    property bool selected: false
    property bool comfortable: false
    property var searchTerms: []

    signal selectRequested()
    signal deleteRequested()
    signal enabledToggled(bool enabled)
    signal catalogRequested(string slot)
    signal propertyEdited(string slot, string propertyKey, string valueText)
    signal contextMenuRequested(var anchorItem)
    signal expansionToggleRequested()
    signal renameRequested()

    readonly property bool ruleEnabled: rule.enabled === true
    readonly property var conditionIds: rule.conditionTypeIds || []
    readonly property var actionIds: rule.actionTypeIds || []
    readonly property var triggerProperties: rule.triggerProperties || []
    readonly property var conditionProperties: rule.conditionProperties || []
    readonly property var actionProperties: rule.actionProperties || []
    readonly property var displayDiagnostics: {
        const entries = []
        const rows = root.rule.diagnostics || []
        for (let i = 0; i < rows.length; ++i) {
            const row = rows[i]
            if (!row)
                continue
            const message = String(row.message || "").trim()
            if (message.length === 0)
                continue
            entries.push({
                severity: row.severity === "error" ? "error" : "warning",
                message: message,
            })
        }
        return entries
    }
    readonly property string diagnosticText: displayDiagnostics
        .map(function(diagnostic) {
            return diagnostic.severity + ": " + diagnostic.message
        })
        .join("\n")
    readonly property bool hasDiagnostics: displayDiagnostics.length > 0
    readonly property bool hasErrors: {
        for (let i = 0; i < displayDiagnostics.length; ++i) {
            if (displayDiagnostics[i].severity === "error")
                return true
        }
        return false
    }
    readonly property real summaryOpacity: ruleEnabled ? 1.0 : 0.45
    readonly property bool highlighting: searchTerms && searchTerms.length > 0

    readonly property int logicOuterPadding: comfortable ? Metrics.spacingMd : Metrics.spacingSm
    readonly property int logicSectionSpacing: comfortable ? Metrics.spacingMd : Metrics.spacingSm
    readonly property string displayName: String(root.rule.displayName)
    readonly property string collapsedSummary: {
        const trigger = EditorSession.logicBlockDisplayName(root.rule.triggerTypeId || "")
        const action = root.actionIds.length > 0
                       ? EditorSession.logicBlockDisplayName(root.actionIds[0])
                       : ""
        if (trigger.length === 0 && action.length === 0)
            return "Not configured"
        if (action.length === 0)
            return trigger
        return trigger + " → " + action
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
                    : (headerHover.hovered ? Theme.controlHover : Theme.control)
    border.width: 1
    border.color: root.expanded || root.selected ? Theme.border : Theme.borderSubtle
    clip: true

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
                visible: root.hasDiagnostics
                Layout.preferredWidth: 14
                Layout.preferredHeight: 14
                Layout.alignment: Qt.AlignVCenter
                radius: 2
                color: root.hasErrors ? Theme.error : Theme.warning
                ToolTip.visible: root.hasDiagnostics && warnHover.hovered
                ToolTip.delay: 400
                ToolTip.text: root.diagnosticText
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

            Item {
                id: headerToggleArea
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignVCenter
                Layout.minimumWidth: 80
                Layout.preferredHeight: 36

                RowLayout {
                    anchors.fill: parent
                    spacing: Metrics.spacingSm

                    AcIcon {
                        Layout.alignment: Qt.AlignVCenter
                        source: Icons.chevron
                        size: Metrics.iconSizeSm
                        color: Theme.textSecondary
                        rotation: root.expanded ? 0 : -90
                    }

                    Text {
                        Layout.fillWidth: true
                        Layout.alignment: Qt.AlignVCenter
                        text: root.highlightText(root.displayName)
                        textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                        font.weight: Font.DemiBold
                        elide: Text.ElideRight
                        opacity: root.summaryOpacity
                        verticalAlignment: Text.AlignVCenter
                    }

                    Text {
                        visible: !root.expanded
                        Layout.alignment: Qt.AlignVCenter
                        Layout.maximumWidth: 260
                        Layout.preferredWidth: Math.min(implicitWidth, 260)
                        text: root.highlightText(root.collapsedSummary)
                        textFormat: root.highlighting ? Text.StyledText : Text.PlainText
                        color: Theme.textMuted
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeToolbar
                        elide: Text.ElideRight
                        opacity: root.summaryOpacity
                        verticalAlignment: Text.AlignVCenter
                    }
                }

                HoverHandler {
                    id: headerHover
                }

                // Defer single-click toggle so a double-click can rename without flapping expand.
                Timer {
                    id: headerClickTimer
                    interval: 280
                    repeat: false
                    onTriggered: root.expansionToggleRequested()
                }

                TapHandler {
                    acceptedButtons: Qt.LeftButton | Qt.RightButton
                    gesturePolicy: TapHandler.ReleaseWithinBounds
                    onTapped: function(eventPoint, button) {
                        if (button === Qt.RightButton) {
                            headerClickTimer.stop()
                            root.selectRequested()
                            root.contextMenuRequested(headerToggleArea)
                            return
                        }
                        root.selectRequested()
                        if (tapCount === 2) {
                            headerClickTimer.stop()
                            if (!EditorSession.playing)
                                root.renameRequested()
                        } else {
                            headerClickTimer.restart()
                        }
                    }
                }

                ToolTip.visible: headerHover.hovered && !EditorSession.playing
                ToolTip.delay: 600
                ToolTip.text: "Click to expand or collapse · Double-click to rename"
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
                color: overflowHover.hovered ? Theme.controlHover : "transparent"
                opacity: EditorSession.playing ? 0.5 : 1.0

                Text {
                    anchors.centerIn: parent
                    text: "⋯"
                    color: Theme.textSecondary
                    font.pixelSize: Typography.sizeObjectTitle
                }

                HoverHandler {
                    id: overflowHover
                }

                TapHandler {
                    acceptedButtons: Qt.LeftButton
                    enabled: !EditorSession.playing
                    gesturePolicy: TapHandler.ReleaseWithinBounds
                    onTapped: function(eventPoint, button) {
                        root.contextMenuRequested(overflowBtn)
                        root.selectRequested()
                    }
                }
            }
        }

        // —— Expanded body: WHEN | IF | THEN ——
        Loader {
            id: bodyLoader
            Layout.fillWidth: true
            Layout.minimumHeight: 0
            Layout.preferredHeight: root.expanded && bodyLoader.item
                                    ? bodyLoader.item.implicitHeight : 0
            Layout.maximumHeight: root.expanded ? Infinity : 0
            Layout.leftMargin: Metrics.spacingXs
            Layout.rightMargin: Metrics.spacingXs
            Layout.bottomMargin: root.expanded ? root.logicOuterPadding : 0
            active: root.expanded
            visible: root.expanded
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
                comfortable: root.comfortable
                blocks: (root.rule.triggerTypeId || "").length > 0
                        ? [root.rule.triggerTypeId] : []
                editable: true
                currentTypeId: root.rule.triggerTypeId || ""
                propertyRows: root.triggerProperties
                onCatalogRequested: root.catalogRequested("trigger")
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
                comfortable: root.comfortable
                blocks: root.conditionIds
                editable: true
                currentTypeId: root.conditionIds.length > 0 ? root.conditionIds[0] : ""
                propertyRows: root.conditionProperties
                onCatalogRequested: root.catalogRequested("condition")
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
                comfortable: root.comfortable
                blocks: root.actionIds
                editable: true
                currentTypeId: root.actionIds.length > 0 ? root.actionIds[0] : ""
                propertyRows: root.actionProperties
                onCatalogRequested: root.catalogRequested("action")
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
                comfortable: root.comfortable
                blocks: (root.rule.triggerTypeId || "").length > 0
                        ? [root.rule.triggerTypeId] : []
                editable: true
                currentTypeId: root.rule.triggerTypeId || ""
                propertyRows: root.triggerProperties
                onCatalogRequested: root.catalogRequested("trigger")
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
                comfortable: root.comfortable
                blocks: root.conditionIds
                editable: true
                currentTypeId: root.conditionIds.length > 0 ? root.conditionIds[0] : ""
                propertyRows: root.conditionProperties
                onCatalogRequested: root.catalogRequested("condition")
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
                comfortable: root.comfortable
                blocks: root.actionIds
                editable: true
                currentTypeId: root.actionIds.length > 0 ? root.actionIds[0] : ""
                propertyRows: root.actionProperties
                onCatalogRequested: root.catalogRequested("action")
                onPropertyEdited: function(key, value) {
                    root.propertyEdited("action", key, value)
                }
            }
        }
    }
}

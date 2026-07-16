import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Logic Board workspace — type-targeted rulesheet, compact-first.
 * Rules render as compact rows; the selected rule expands inline.
 * Mutations only via EditorSession Logic commands (single write path).
 */
Rectangle {
    id: root

    color: Theme.panel

    readonly property bool hasTypeTarget: EditorSession.selectedObjectTypeId.length > 0
    /** UI density preference (presentation only — never dirties the project). */
    property bool comfortable: false
    /** View state: collapsed section ids ({id: true}) — never dirties the project. */
    property var collapsedSections: ({})
    /** View state: rule search query (operators: trigger: condition: action: uses: is:). */
    property string searchText: ""

    readonly property var searchTokens: logicSearch.parse(searchText)
    readonly property bool filtering: searchTokens.length > 0
    readonly property var searchHighlightTerms: logicSearch.highlightTerms(searchTokens)
    readonly property int matchCount: {
        if (!filtering)
            return 0
        const rules = EditorSession.logicRules
        let n = 0
        for (let i = 0; i < rules.length; ++i) {
            if (logicSearch.ruleMatches(rules[i], searchTokens))
                n += 1
        }
        return n
    }

    function toggleSectionCollapsed(sectionId) {
        const next = {}
        for (const key in collapsedSections)
            next[key] = collapsedSections[key]
        next[sectionId] = !next[sectionId]
        collapsedSections = next
    }

    /**
     * Flattened display list in execution order: contiguous runs of rules
     * sharing a sectionId become a header + its rules; empty sections render
     * as headers at the end so they stay renamable/removable. While a search
     * is active only matching rules render, collapse is ignored (matches stay
     * visible) and empty sections are hidden.
     */
    readonly property var displayItems: {
        const rules = EditorSession.logicRules
        const sections = EditorSession.logicSections
        const nameById = {}
        for (let s = 0; s < sections.length; ++s)
            nameById[sections[s].id] = sections[s].name
        const items = []
        let started = false
        let openSection = ""
        let headerAt = -1
        for (let i = 0; i < rules.length; ++i) {
            const rule = rules[i]
            if (filtering && !logicSearch.ruleMatches(rule, searchTokens))
                continue
            const sid = (rule.sectionId && nameById[rule.sectionId] !== undefined)
                        ? rule.sectionId : ""
            if (!started || sid !== openSection) {
                started = true
                openSection = sid
                if (sid !== "") {
                    items.push({ kind: "header", sectionId: sid,
                                 name: nameById[sid], count: 0 })
                    headerAt = items.length - 1
                } else {
                    headerAt = -1
                }
            }
            if (headerAt >= 0)
                items[headerAt].count += 1
            if (sid === "" || filtering || !collapsedSections[sid])
                items.push({ kind: "rule", rule: rule, ruleIndex: i })
        }
        if (!filtering) {
            for (let s = 0; s < sections.length; ++s) {
                const id = sections[s].id
                let used = false
                for (let i = 0; i < rules.length; ++i) {
                    if (rules[i].sectionId === id) { used = true; break }
                }
                if (!used)
                    items.push({ kind: "header", sectionId: id,
                                 name: sections[s].name, count: 0 })
            }
        }
        return items
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: headerRow.implicitHeight + Metrics.spacingMd * 2
            color: Theme.chrome

            RowLayout {
                id: headerRow
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingMd
                anchors.rightMargin: Metrics.spacingMd
                anchors.topMargin: Metrics.spacingMd
                anchors.bottomMargin: Metrics.spacingMd
                spacing: Metrics.spacingMd

                Column {
                    Layout.fillWidth: true
                    spacing: 2

                    Text {
                        visible: root.hasTypeTarget
                        text: "Objects / " + EditorSession.selectedObjectTypeName
                        color: Theme.textMuted
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                    }

                    Row {
                        spacing: Metrics.spacingSm

                        Text {
                            text: root.hasTypeTarget ? EditorSession.selectedObjectTypeName
                                                     : "Logic Board"
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeLg
                            font.weight: Font.DemiBold
                        }

                        Rectangle {
                            visible: root.hasTypeTarget
                            anchors.verticalCenter: parent.verticalCenter
                            width: badgeText.implicitWidth + Metrics.spacingMd
                            height: 16
                            radius: 2
                            color: Qt.alpha(Theme.accent, 0.16)

                            Text {
                                id: badgeText
                                anchors.centerIn: parent
                                text: "OBJECT TYPE LOGIC"
                                color: Theme.accent
                                font.family: Typography.family
                                font.pixelSize: 9
                                font.weight: Font.DemiBold
                                font.letterSpacing: 0.5
                            }
                        }
                    }

                    Text {
                        text: {
                            if (!EditorSession.hasProject)
                                return "Open a project to author gameplay rules"
                            if (!root.hasTypeTarget)
                                return "Select a scene object — rules apply to its object type"
                            const rules = EditorSession.logicRuleCount
                            if (root.filtering)
                                return root.matchCount + " of " + rules + " rules match"
                            const ruleLabel = rules === 1 ? "1 rule" : (rules + " rules")
                            return "Applies to all " + EditorSession.selectedObjectTypeName
                                   + " instances  ·  " + ruleLabel
                        }
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                        elide: Text.ElideRight
                        width: parent.width
                    }
                }

                Text {
                    visible: root.hasTypeTarget && EditorSession.selectedName.length > 0
                    text: "Selected instance: " + EditorSession.selectedName
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                    ToolTip.visible: instanceMa.containsMouse
                    ToolTip.delay: 400
                    ToolTip.text: "This logic is shared by every " +
                                  EditorSession.selectedObjectTypeName +
                                  " instance. Runtime variables stay per-instance."

                    MouseArea {
                        id: instanceMa
                        anchors.fill: parent
                        hoverEnabled: true
                        acceptedButtons: Qt.NoButton
                    }
                }

                Rectangle {
                    visible: root.hasTypeTarget
                    Layout.preferredWidth: densityRow.implicitWidth + 2
                    Layout.preferredHeight: Metrics.controlHeight - 4
                    radius: Metrics.radiusSmall
                    color: Theme.control
                    border.width: 1
                    border.color: Theme.borderSubtle

                    Row {
                        id: densityRow
                        anchors.centerIn: parent

                        Repeater {
                            model: ["Compact", "Comfortable"]

                            delegate: Rectangle {
                                id: densityItem
                                required property string modelData
                                required property int index
                                readonly property bool comfortableChoice: index === 1
                                readonly property bool active:
                                    comfortableChoice === root.comfortable
                                width: densityLabel.implicitWidth + Metrics.spacingMd * 2
                                height: Metrics.controlHeight - 6
                                radius: Metrics.radiusSmall
                                color: active ? Theme.selection
                                     : densityMa.containsMouse ? Theme.controlHover
                                     : "transparent"

                                Text {
                                    id: densityLabel
                                    anchors.centerIn: parent
                                    text: densityItem.modelData
                                    color: densityItem.active ? Theme.textPrimary
                                                              : Theme.textSecondary
                                    font.family: Typography.family
                                    font.pixelSize: Typography.sizeXs
                                }

                                MouseArea {
                                    id: densityMa
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    onClicked: root.comfortable =
                                                   densityItem.comfortableChoice
                                }
                            }
                        }
                    }
                }

                AcTextField {
                    id: searchField
                    visible: root.hasTypeTarget
                    Layout.preferredWidth: 230
                    placeholderText: "Search rules…"
                    font.pixelSize: Typography.sizeXs
                    onTextChanged: root.searchText = text
                    Keys.onEscapePressed: text = ""
                    ToolTip.visible: hovered && !activeFocus
                    ToolTip.delay: 600
                    ToolTip.text: "Filters rules as you type. Operators: trigger:x  "
                                  + "condition:x  action:\"Play Sound\"  uses:value  "
                                  + "is:disabled|enabled|error|warning. "
                                  + "Terms are ANDed; Esc clears."
                }

                AcButton {
                    text: "+ Section"
                    enabled: EditorSession.hasProject && root.hasTypeTarget
                             && !EditorSession.playing
                    onClicked: EditorSession.addLogicSection()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add a display section — group rules for readability "
                                  + "(never changes execution order)"
                }

                AcButton {
                    text: "+ Add Rule"
                    primary: true
                    enabled: EditorSession.hasProject && root.hasTypeTarget
                             && !EditorSession.playing
                    onClicked: EditorSession.addLogicRule()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add a default When / Then rule on this object type"
                }
            }

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: Theme.borderSubtle
            }
        }

        ListView {
            id: rulesList
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: Metrics.spacingMd
            clip: true
            visible: EditorSession.hasProject && root.hasTypeTarget
            model: root.displayItems
            spacing: Metrics.spacingSm
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBar {
                policy: ScrollBar.AsNeeded
            }

            delegate: Loader {
                id: displayLoader
                required property var modelData
                width: rulesList.width
                sourceComponent: modelData.kind === "header" ? sectionHeaderComponent
                                                             : ruleCardComponent
            }

            AcEmptyHint {
                visible: EditorSession.logicRuleCount === 0
                         && EditorSession.logicSections.length === 0
                message: "This board has no rules yet"
                hint: "Click + Add Rule — a rule runs its Then actions when the When trigger fires"
            }
        }

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: !EditorSession.hasProject || !root.hasTypeTarget

            AcEmptyHint {
                message: !EditorSession.hasProject ? "No project open"
                                                   : "No object type selected"
                hint: !EditorSession.hasProject
                      ? "Open a project or load Fixture, then switch back to Logic Board"
                      : "Pick an object in Hierarchy or on the Canvas — rules belong to the type"
            }
        }
    }

    AcLogicSearch {
        id: logicSearch
    }

    Component {
        id: sectionHeaderComponent

        AcLogicSectionHeader {
            sectionId: displayLoader.modelData.sectionId
            name: displayLoader.modelData.name
            ruleCount: displayLoader.modelData.count
            collapsed: root.collapsedSections[displayLoader.modelData.sectionId] === true
            onToggleRequested: root.toggleSectionCollapsed(sectionId)
            onRenameCommitted: function(newName) {
                EditorSession.renameLogicSection(sectionId, newName)
            }
            onDeleteRequested: EditorSession.removeLogicSection(sectionId)
        }
    }

    Component {
        id: ruleCardComponent

        AcLogicRuleCard {
            readonly property string ruleId: displayLoader.modelData.rule.id

            rule: displayLoader.modelData.rule
            orderIndex: displayLoader.modelData.ruleIndex
            expanded: ruleId === EditorSession.selectedLogicRuleId
            comfortable: root.comfortable
            searchTerms: root.searchHighlightTerms
            onSelectRequested: EditorSession.selectedLogicRuleId = ruleId
            onEnabledToggled: function(enabled) {
                EditorSession.setLogicRuleEnabled(ruleId, enabled)
            }
            onDeleteRequested: EditorSession.removeLogicRule(ruleId)
            onTriggerChosen: function(typeId) {
                EditorSession.setLogicRuleTrigger(typeId)
            }
            onConditionChosen: function(typeId) {
                EditorSession.setLogicRulePrimaryCondition(typeId)
            }
            onActionChosen: function(typeId) {
                EditorSession.setLogicRulePrimaryAction(typeId)
            }
            onPropertyEdited: function(slot, key, value) {
                EditorSession.setLogicRuleBlockProperty(ruleId, slot, key, value)
            }
            onContextMenuRequested: ruleMenu.openFor(ruleId)
        }
    }

    AcMenu {
        id: ruleMenu

        property string targetRuleId: ""

        function openFor(ruleId) {
            targetRuleId = ruleId
            popup()
        }

        AcMenu {
            id: moveToSectionMenu
            title: "Move to section"

            AcMenuItem {
                text: "None (unsectioned)"
                enabled: !EditorSession.playing
                onTriggered: EditorSession.setLogicRuleSection(ruleMenu.targetRuleId, "")
            }

            Instantiator {
                model: EditorSession.logicSections
                delegate: AcMenuItem {
                    required property var modelData
                    text: modelData.name
                    enabled: !EditorSession.playing
                    onTriggered: EditorSession.setLogicRuleSection(
                                     ruleMenu.targetRuleId, modelData.id)
                }
                onObjectAdded: function(index, object) {
                    moveToSectionMenu.insertItem(index + 1, object)
                }
                onObjectRemoved: function(index, object) {
                    moveToSectionMenu.removeItem(object)
                }
            }
        }

        AcMenuItem {
            text: "Delete rule"
            enabled: !EditorSession.playing
            onTriggered: EditorSession.removeLogicRule(ruleMenu.targetRuleId)
        }
    }
}

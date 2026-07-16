import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Logic Board workspace — event sheet for the selected Object Type.
 * Four body states via StackLayout (no ListView overlay). Mutations only
 * via EditorSession Logic commands (single write path).
 */
Rectangle {
    id: root

    color: Theme.panel

    readonly property bool hasTypeTarget: EditorSession.selectedObjectTypeId.length > 0
    /** UI density preference (presentation only — never dirties the project). */
    property bool comfortable: false
    property var collapsedSections: ({})
    property var collapsedRules: ({})
    property string searchText: ""

    readonly property int logicOuterPadding: comfortable ? Metrics.spacingMd : Metrics.spacingSm
    readonly property int logicFooterMargin: comfortable ? Metrics.spacingLg : Metrics.spacingMd

    readonly property var searchTokens: logicSearch.parse(searchText)
    readonly property bool filtering: searchTokens.length > 0
    readonly property var searchHighlightTerms: logicSearch.highlightTerms(searchTokens)
    readonly property int totalLogicCount: EditorSession.logicRuleCount
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
    readonly property int filteredLogicCount: filtering ? matchCount : totalLogicCount

    /**
     * 0 = no target, 1 = empty board, 2 = search no match, 3 = populated.
     * Derived from authoritative counts — never from filtered model alone.
     */
    readonly property int bodyState: {
        if (!EditorSession.hasProject || !root.hasTypeTarget)
            return 0
        if (root.totalLogicCount === 0)
            return 1
        if (root.filtering && root.filteredLogicCount === 0)
            return 2
        return 3
    }

    function toggleSectionCollapsed(sectionId) {
        const next = {}
        for (const key in collapsedSections)
            next[key] = collapsedSections[key]
        next[sectionId] = !next[sectionId]
        collapsedSections = next
    }

    function isRuleExpanded(ruleId) {
        return collapsedRules[ruleId] !== true
    }

    function toggleRuleExpanded(ruleId) {
        const next = {}
        for (const key in collapsedRules)
            next[key] = collapsedRules[key]
        next[ruleId] = !isRuleExpanded(ruleId)
        collapsedRules = next
    }

    function clearSearch() {
        searchField.text = ""
        root.searchText = ""
    }

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

        // —— Header: context + secondary tools (no Add Logic) ——
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
                        font.pixelSize: Typography.sizeMeta
                    }

                    Row {
                        spacing: Metrics.spacingSm

                        Text {
                            text: root.hasTypeTarget ? EditorSession.selectedObjectTypeName
                                                     : "Logic Board"
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeObjectTitle
                            font.weight: Font.DemiBold
                        }

                        Text {
                            visible: root.hasTypeTarget
                            anchors.verticalCenter: parent.verticalCenter
                            text: "· OBJECT TYPE LOGIC"
                            color: Theme.textMuted
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeMeta
                            font.weight: Font.DemiBold
                            font.letterSpacing: 0.4
                        }
                    }

                    Text {
                        text: {
                            if (!EditorSession.hasProject)
                                return "Create or open a project to author logic"
                            if (!root.hasTypeTarget)
                                return "Select an Object Type to edit its logic"
                            const n = root.totalLogicCount
                            if (root.filtering)
                                return root.matchCount + " of " + n
                                       + (n === 1 ? " logic item" : " logic items")
                                       + " match"
                            const label = n === 1 ? "1 logic item" : (n + " logic items")
                            return "Applies to all " + EditorSession.selectedObjectTypeName
                                   + " instances  ·  " + label
                        }
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeMeta
                        elide: Text.ElideRight
                        width: parent.width
                    }
                }

                Text {
                    visible: root.hasTypeTarget && EditorSession.selectedName.length > 0
                    text: "Selected instance: " + EditorSession.selectedName
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeMeta
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

                AcTextField {
                    id: searchField
                    visible: root.hasTypeTarget
                    Layout.preferredWidth: 230
                    placeholderText: "Search logic…"
                    font.pixelSize: Typography.sizeToolbar
                    onTextChanged: root.searchText = text
                    Keys.onEscapePressed: root.clearSearch()
                    ToolTip.visible: hovered && !activeFocus
                    ToolTip.delay: 600
                    ToolTip.text: "Filters logic items. Operators: trigger:x  "
                                  + "condition:x  action:\"Play Sound\"  uses:value  "
                                  + "is:disabled|enabled|error|warning. Esc clears."
                }

                Rectangle {
                    visible: root.hasTypeTarget
                    Layout.preferredWidth: densityRow.implicitWidth + 2
                    Layout.preferredHeight: Metrics.controlHeight - 4
                    radius: Metrics.radiusControl
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
                                radius: Metrics.radiusControl
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
                                    font.pixelSize: Typography.sizeToolbar
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

                AcButton {
                    text: "+ Section"
                    enabled: EditorSession.hasProject && root.hasTypeTarget
                             && !EditorSession.playing
                    onClicked: EditorSession.addLogicSection()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add a display section — group logic for readability "
                                  + "(never changes execution order)"
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

        // —— Body: exclusive states (no overlay on ListView) ——
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.bodyState

            // 0 — No Object Type
            Item {
                Column {
                    anchors.centerIn: parent
                    width: Math.min(parent.width - Metrics.spacingXl * 2, 360)
                    spacing: Metrics.spacingSm

                    Text {
                        width: parent.width
                        horizontalAlignment: Text.AlignHCenter
                        text: "Select an Object Type"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeObjectTitle
                        font.weight: Font.DemiBold
                    }
                    Text {
                        width: parent.width
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                        text: "Choose an instance or Object Type to edit its logic."
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                    }
                }
            }

            // 1 — Empty board
            Item {
                Column {
                    anchors.centerIn: parent
                    width: Math.min(parent.width - Metrics.spacingXl * 2, 400)
                    spacing: Metrics.spacingMd

                    Text {
                        width: parent.width
                        horizontalAlignment: Text.AlignHCenter
                        text: "No logic yet"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeObjectTitle
                        font.weight: Font.DemiBold
                    }
                    Text {
                        width: parent.width
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                        text: "Add your first logic to define how "
                              + EditorSession.selectedObjectTypeName + " behaves."
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                    }
                    Column {
                        anchors.horizontalCenter: parent.horizontalCenter
                        spacing: 2
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "WHEN something happens"
                            color: Theme.textMuted
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeMeta
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "IF optional conditions are true"
                            color: Theme.textMuted
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeMeta
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "THEN perform one or more actions"
                            color: Theme.textMuted
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeMeta
                        }
                    }
                    AcButton {
                        anchors.horizontalCenter: parent.horizontalCenter
                        width: 160
                        text: "+ Add Logic"
                        primary: true
                        enabled: !EditorSession.playing
                        onClicked: EditorSession.addLogicRule()
                    }
                }
            }

            // 2 — Search no match
            Item {
                Column {
                    anchors.centerIn: parent
                    width: Math.min(parent.width - Metrics.spacingXl * 2, 400)
                    spacing: Metrics.spacingMd

                    Text {
                        width: parent.width
                        horizontalAlignment: Text.AlignHCenter
                        text: "No matching logic"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeObjectTitle
                        font.weight: Font.DemiBold
                    }
                    Text {
                        width: parent.width
                        horizontalAlignment: Text.AlignHCenter
                        wrapMode: Text.WordWrap
                        text: "No logic matches \"" + root.searchText + "\"."
                        color: Theme.textSecondary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                    }
                    Row {
                        anchors.horizontalCenter: parent.horizontalCenter
                        spacing: Metrics.spacingSm
                        AcButton {
                            text: "Clear Search"
                            onClicked: root.clearSearch()
                        }
                        AcButton {
                            width: 160
                            text: "+ Add Logic"
                            primary: true
                            enabled: !EditorSession.playing
                            onClicked: EditorSession.addLogicRule()
                        }
                    }
                }
            }

            // 3 — Populated list + footer CTA
            ListView {
                id: rulesList
                clip: true
                model: root.displayItems
                spacing: Metrics.spacingSm
                boundsBehavior: Flickable.StopAtBounds
                topMargin: root.logicOuterPadding
                leftMargin: root.logicOuterPadding
                rightMargin: root.logicOuterPadding
                bottomMargin: root.logicFooterMargin
                ScrollBar.vertical: ScrollBar {
                    policy: ScrollBar.AsNeeded
                }

                delegate: Item {
                    id: delegateRoot
                    required property var modelData
                    width: rulesList.width - root.logicOuterPadding * 2
                    readonly property bool isHeader: modelData.kind === "header"
                    implicitHeight: isHeader ? sectionHeader.implicitHeight : ruleCard.implicitHeight

                    AcLogicSectionHeader {
                        id: sectionHeader
                        anchors.left: parent.left
                        anchors.right: parent.right
                        visible: delegateRoot.isHeader
                        enabled: visible
                        sectionId: visible ? delegateRoot.modelData.sectionId : ""
                        name: visible ? delegateRoot.modelData.name : ""
                        ruleCount: visible ? delegateRoot.modelData.count : 0
                        collapsed: visible
                                   && root.collapsedSections[delegateRoot.modelData.sectionId] === true
                        onToggleRequested: root.toggleSectionCollapsed(sectionId)
                        onRenameCommitted: function(newName) {
                            EditorSession.renameLogicSection(sectionId, newName)
                        }
                        onDeleteRequested: EditorSession.removeLogicSection(sectionId)
                    }

                    AcLogicRuleCard {
                        id: ruleCard
                        anchors.left: parent.left
                        anchors.right: parent.right
                        visible: !delegateRoot.isHeader
                        enabled: visible
                        readonly property string ruleId: visible ? delegateRoot.modelData.rule.id : ""
                        rule: visible ? delegateRoot.modelData.rule : ({})
                        expanded: visible && root.isRuleExpanded(ruleId)
                        selected: ruleId === EditorSession.selectedLogicRuleId
                        comfortable: root.comfortable
                        searchTerms: root.searchHighlightTerms
                        onSelectRequested: EditorSession.selectedLogicRuleId = ruleId
                        onExpansionToggleRequested: root.toggleRuleExpanded(ruleId)
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
                        onContextMenuRequested: ruleMenu.openFor(ruleId, rule.displayName)
                    }
                }

                footer: Item {
                    width: rulesList.width - root.logicOuterPadding * 2
                    implicitHeight: addLogicFooter.visible
                                    ? (addLogicFooter.implicitHeight + root.logicFooterMargin * 2)
                                    : 0
                    height: implicitHeight

                    AcButton {
                        id: addLogicFooter
                        anchors.horizontalCenter: parent.horizontalCenter
                        anchors.verticalCenter: parent.verticalCenter
                        width: 160
                        text: "+ Add Logic"
                        primary: true
                        visible: true
                        enabled: !EditorSession.playing
                        onClicked: EditorSession.addLogicRule()
                    }
                }
            }
        }
    }

    AcLogicSearch {
        id: logicSearch
    }

    AcMenu {
        id: ruleMenu

        property string targetRuleId: ""
        property string targetDisplayName: ""

        function openFor(ruleId, displayName) {
            targetRuleId = ruleId
            targetDisplayName = displayName
            popup()
        }

        AcMenuItem {
            text: "Rename Logic…"
            available: !EditorSession.playing
            disabledHint: EditorSession.playing ? "Unavailable during Play" : ""
            onTriggered: renameLogicDialog.openFor(ruleMenu.targetRuleId,
                                                    ruleMenu.targetDisplayName)
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
            text: "Duplicate Logic"
            available: false
            disabledHint: "Coming next"
            visible: EditorSession.developerMode || available
        }
        AcMenuItem {
            text: "Move Up"
            available: false
            disabledHint: "Coming next"
            visible: EditorSession.developerMode || available
        }
        AcMenuItem {
            text: "Move Down"
            available: false
            disabledHint: "Coming next"
            visible: EditorSession.developerMode || available
        }
        AcMenuItem {
            text: "Delete Logic"
            available: !EditorSession.playing
            disabledHint: EditorSession.playing ? "Unavailable during Play" : ""
            onTriggered: {
                if (available)
                    EditorSession.removeLogicRule(ruleMenu.targetRuleId)
            }
        }
    }

    Dialog {
        id: renameLogicDialog
        parent: Overlay.overlay
        modal: true
        title: "Rename Logic"
        property string targetRuleId: ""
        property string validationError: ""

        function openFor(ruleId, displayName) {
            targetRuleId = ruleId
            validationError = ""
            renameNameField.text = displayName
            open()
        }

        function commit() {
            const requestedName = renameNameField.text.trim()
            if (requestedName.length === 0) {
                validationError = "Logic name cannot be empty"
                return
            }
            if (EditorSession.renameLogicRule(targetRuleId, requestedName)) {
                close()
                return
            }
            validationError = EditorSession.statusMessage
        }

        onOpened: {
            renameNameField.forceActiveFocus()
            renameNameField.selectAll()
        }

        contentItem: ColumnLayout {
            implicitWidth: 360
            spacing: Metrics.spacingSm

            Text {
                text: "Name"
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeToolbar
            }

            AcTextField {
                id: renameNameField
                Layout.fillWidth: true
                onTextChanged: renameLogicDialog.validationError = ""
                onAccepted: renameLogicDialog.commit()
                Keys.onEscapePressed: renameLogicDialog.close()
            }

            Text {
                Layout.fillWidth: true
                visible: renameLogicDialog.validationError.length > 0
                text: renameLogicDialog.validationError
                color: Theme.error
                font.family: Typography.family
                font.pixelSize: Typography.sizeToolbar
                wrapMode: Text.WordWrap
            }

            RowLayout {
                Layout.alignment: Qt.AlignRight
                spacing: Metrics.spacingSm

                AcButton {
                    text: "Cancel"
                    onClicked: renameLogicDialog.close()
                }
                AcButton {
                    text: "Rename"
                    primary: true
                    onClicked: renameLogicDialog.commit()
                }
            }
        }
    }
}

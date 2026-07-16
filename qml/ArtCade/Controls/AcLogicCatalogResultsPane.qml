import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Item {
    id: root

    property var catalog: null
    property var categoryIds: []
    property string categoryId: "all"
    property string currentTypeId: ""
    property string searchText: ""
    property bool showTypeId: false
    property string emptyKindLabel: "blocks"
    property string selectedTypeId: ""

    readonly property var entries: {
        const raw = []
        if (!catalog)
            return raw
        const revision = catalog.revision
        const query = searchText.trim().toLowerCase()
        for (let i = 0; i < catalog.rowCount(); ++i) {
            const entry = catalog.entryMap(i)
            if (!entry || !entry.typeId || (categoryId !== "all" && entry.categoryId !== categoryId))
                continue
            let haystack = (entry.displayName + " " + entry.description + " "
                            + entry.categoryLabel).toLowerCase()
            if (entry.searchSynonyms && entry.searchSynonyms.length > 0)
                haystack += " " + entry.searchSynonyms.join(" ").toLowerCase()
            if (showTypeId)
                haystack += " " + String(entry.typeId).toLowerCase()
            if (query.length === 0 || haystack.indexOf(query) >= 0)
                raw.push(entry)
        }
        if (categoryId !== "all" || query.length > 0)
            return raw
        // All view: category separators between sorted groups
        const out = []
        let lastCat = ""
        for (let i = 0; i < raw.length; ++i) {
            const entry = raw[i]
            const label = String(entry.categoryLabel || "").toUpperCase()
            if (label.length > 0 && label !== lastCat) {
                lastCat = label
                out.push({
                    isSeparator: true,
                    typeId: "",
                    categoryLabel: label,
                    displayName: label,
                    available: false,
                })
            }
            out.push(entry)
        }
        return out
    }
    readonly property var selectableEntries: {
        const out = []
        for (let i = 0; i < entries.length; ++i) {
            if (!entries[i].isSeparator)
                out.push(entries[i])
        }
        return out
    }
    readonly property var selectedEntry: {
        for (let i = 0; i < selectableEntries.length; ++i) {
            if (selectableEntries[i].typeId === selectedTypeId)
                return selectableEntries[i]
        }
        return selectableEntries.length > 0 ? selectableEntries[0] : null
    }
    readonly property int selectedIndex: {
        for (let i = 0; i < entries.length; ++i) {
            if (!entries[i].isSeparator && entries[i].typeId === selectedTypeId)
                return i
        }
        for (let i = 0; i < entries.length; ++i) {
            if (!entries[i].isSeparator)
                return i
        }
        return -1
    }

    function syncSelection() {
        if (selectableEntries.length === 0) {
            selectedTypeId = ""
            return
        }
        for (let i = 0; i < selectableEntries.length; ++i) {
            if (selectableEntries[i].typeId === selectedTypeId)
                return
        }
        for (let i = 0; i < selectableEntries.length; ++i) {
            if (selectableEntries[i].typeId === currentTypeId) {
                selectedTypeId = selectableEntries[i].typeId
                return
            }
        }
        selectedTypeId = selectableEntries[0].typeId
    }

    function moveSelection(delta) {
        if (selectableEntries.length === 0)
            return
        let current = -1
        for (let i = 0; i < selectableEntries.length; ++i) {
            if (selectableEntries[i].typeId === selectedTypeId) {
                current = i
                break
            }
        }
        if (current < 0)
            current = 0
        const next = Math.max(0, Math.min(selectableEntries.length - 1, current + delta))
        selectedTypeId = selectableEntries[next].typeId
        scrollToSelected()
    }

    function moveCategory(delta) {
        if (!categoryIds || categoryIds.length === 0)
            return
        const current = Math.max(0, categoryIds.indexOf(categoryId))
        categoryId = categoryIds[Math.max(0, Math.min(categoryIds.length - 1, current + delta))]
        syncSelection()
        scrollToSelected()
    }

    function scrollToSelected() {
        if (selectedIndex >= 0)
            resultsList.positionViewAtIndex(selectedIndex, ListView.Contain)
    }

    function focusResults() {
        resultsList.forceActiveFocus()
    }

    ListView {
        id: resultsList
        anchors.fill: parent
        anchors.margins: Metrics.spacingXs
        clip: true
        model: root.entries
        currentIndex: root.selectedIndex
        focus: true

        Keys.onDownPressed: root.moveSelection(1)
        Keys.onUpPressed: root.moveSelection(-1)
        Keys.onLeftPressed: root.moveCategory(-1)
        Keys.onRightPressed: root.moveCategory(1)
        Keys.onReturnPressed: root.selectionConfirmed(root.selectedTypeId)
        Keys.onEnterPressed: root.selectionConfirmed(root.selectedTypeId)
        Keys.onEscapePressed: root.cancelled()

        delegate: Rectangle {
            required property var modelData
            width: resultsList.width
            height: modelData.isSeparator ? 26 : 36
            readonly property bool isSeparator: modelData.isSeparator === true
            readonly property bool isSelected: !isSeparator && modelData.typeId === root.selectedTypeId
            readonly property bool isCurrent: !isSeparator && modelData.typeId === root.currentTypeId
            radius: Metrics.radiusControl
            color: isSelected ? Theme.controlHover : "transparent"
            opacity: isSeparator ? 1.0 : (modelData.available ? 1.0 : 0.55)

            Text {
                visible: parent.isSeparator
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: Metrics.spacingSm
                anchors.rightMargin: Metrics.spacingSm
                text: modelData.categoryLabel || ""
                color: Theme.textMuted
                font.family: Typography.family
                font.pixelSize: Typography.sizeMeta
                font.weight: Font.DemiBold
                font.letterSpacing: 0.8
            }

            Column {
                visible: !parent.isSeparator
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: Metrics.spacingSm
                anchors.rightMargin: Metrics.spacingSm
                spacing: 1
                Text {
                    width: parent.width
                    text: modelData.displayName + (isCurrent ? "  ·  current" : "")
                    color: modelData.available ? Theme.textPrimary : Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeBody
                    font.weight: isSelected ? Font.DemiBold : Font.Normal
                    elide: Text.ElideRight
                }
                Text {
                    visible: !modelData.available
                             && String(modelData.unavailableReason || "").length > 0
                    width: parent.width
                    text: modelData.unavailableReason
                    color: Theme.warning
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeMeta
                    elide: Text.ElideRight
                }
            }
            MouseArea {
                anchors.fill: parent
                enabled: !parent.isSeparator
                onClicked: {
                    root.selectedTypeId = modelData.typeId
                    root.focusResults()
                }
                onDoubleClicked: root.selectionConfirmed(modelData.typeId)
            }
        }
    }

    Column {
        anchors.centerIn: parent
        spacing: Metrics.spacingXs
        visible: root.entries.filter(function(e) { return !e.isSeparator }).length === 0
        width: parent.width - Metrics.spacingLg * 2
        Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            text: "No matching " + root.emptyKindLabel
            color: Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeBody
            font.weight: Font.DemiBold
        }
        Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.WordWrap
            text: root.searchText.length > 0
                  ? ("No " + root.emptyKindLabel + " match \"" + root.searchText.trim() + "\".")
                  : ("No " + root.emptyKindLabel + " in this category.")
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeToolbar
        }
        AcButton {
            anchors.horizontalCenter: parent.horizontalCenter
            visible: root.searchText.length > 0
            text: "Clear Search"
            onClicked: root.clearSearchRequested()
        }
    }

    signal selectionConfirmed(string typeId)
    signal clearSearchRequested()
    signal cancelled()
}

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
        const out = []
        if (!catalog)
            return out
        const revision = catalog.revision
        const query = searchText.trim().toLowerCase()
        for (let i = 0; i < catalog.rowCount(); ++i) {
            const entry = catalog.entryMap(i)
            if (!entry || !entry.typeId || (categoryId !== "all" && entry.categoryId !== categoryId))
                continue
            let haystack = (entry.displayName + " " + entry.description + " "
                            + entry.categoryLabel).toLowerCase()
            if (showTypeId)
                haystack += " " + String(entry.typeId).toLowerCase()
            if (query.length === 0 || haystack.indexOf(query) >= 0)
                out.push(entry)
        }
        return out
    }
    readonly property var selectedEntry: {
        for (let i = 0; i < entries.length; ++i) {
            if (entries[i].typeId === selectedTypeId)
                return entries[i]
        }
        return entries.length > 0 ? entries[0] : null
    }
    readonly property int selectedIndex: {
        for (let i = 0; i < entries.length; ++i) {
            if (entries[i].typeId === selectedTypeId)
                return i
        }
        return entries.length > 0 ? 0 : -1
    }

    function syncSelection() {
        if (entries.length === 0) {
            selectedTypeId = ""
            return
        }
        for (let i = 0; i < entries.length; ++i) {
            if (entries[i].typeId === selectedTypeId)
                return
        }
        for (let i = 0; i < entries.length; ++i) {
            if (entries[i].typeId === currentTypeId) {
                selectedTypeId = entries[i].typeId
                return
            }
        }
        selectedTypeId = entries[0].typeId
    }

    function moveSelection(delta) {
        if (entries.length === 0)
            return
        const next = Math.max(0, Math.min(entries.length - 1, selectedIndex + delta))
        selectedTypeId = entries[next].typeId
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
            height: 36
            readonly property bool isSelected: modelData.typeId === root.selectedTypeId
            readonly property bool isCurrent: modelData.typeId === root.currentTypeId
            radius: Metrics.radiusControl
            color: isSelected ? Theme.controlHover : "transparent"
            opacity: modelData.available ? 1.0 : 0.55

            Column {
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
        visible: root.entries.length === 0
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

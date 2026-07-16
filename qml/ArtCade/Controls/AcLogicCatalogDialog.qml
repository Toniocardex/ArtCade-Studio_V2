import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * IDE-style Logic Catalog modal. The model owns catalog rows; this component owns only
 * transient selection and emits the chosen type to its parent intent path.
 */
Popup {
    id: root

    property string kind: "action"
    property string currentTypeId: ""
    property string contextObjectTypeId: ""
    property string triggerTypeId: ""
    property bool replacingConfigured: false
    property string replaceDiscardHint: ""

    readonly property var catalog: EditorSession.logicCatalogModel
    readonly property var categoryIds: catalog ? catalog.categoryIds : []
    readonly property string titleText: kind === "trigger" ? "Choose Trigger"
                                      : kind === "condition" ? "Choose Condition"
                                      : "Choose Action"
    readonly property string searchPlaceholder: kind === "trigger" ? "Search triggers…"
                                               : kind === "condition" ? "Search conditions…"
                                               : "Search actions…"
    readonly property string confirmLabel: {
        if (kind === "trigger") return currentTypeId.length > 0 ? "Replace Trigger" : "Use Trigger"
        if (kind === "condition") return currentTypeId.length > 0 ? "Replace Condition" : "Use Condition"
        return currentTypeId.length > 0 ? "Replace Action" : "Use Action"
    }
    readonly property string emptyKindLabel: kind === "trigger" ? "triggers"
                                           : kind === "condition" ? "conditions" : "actions"

    signal accepted(string typeId)
    signal cancelled()

    parent: Overlay.overlay
    modal: true
    focus: true
    width: Math.min(Math.max(parent ? parent.width * 0.62 : 760, 680), 900)
    height: Math.min(Math.max(parent ? parent.height * 0.62 : 500, 440), 620)
    anchors.centerIn: parent
    closePolicy: Popup.CloseOnEscape
    padding: 0

    background: Rectangle {
        color: Theme.panelRaised
        border.color: Theme.borderStrong
        border.width: 1
        radius: Metrics.radiusCard
    }

    Overlay.modal: Rectangle { color: "#80000000" }

    function openCatalog() {
        if (EditorSession.playing || !catalog)
            return
        catalog.kind = root.kind
        catalog.contextObjectTypeId = root.contextObjectTypeId
        catalog.triggerTypeId = root.triggerTypeId
        catalog.reload()
        resultsPane.categoryId = "all"
        resultsPane.currentTypeId = root.currentTypeId
        resultsPane.selectedTypeId = root.currentTypeId
        searchField.text = ""
        open()
        Qt.callLater(function() {
            resultsPane.syncSelection()
            resultsPane.scrollToSelected()
            searchField.forceActiveFocus()
        })
    }

    function confirmSelection() {
        const entry = resultsPane.selectedEntry
        if (!entry || !entry.available)
            return
        if (entry.typeId !== root.currentTypeId)
            root.accepted(entry.typeId)
        close()
    }

    function requestCancel() {
        root.cancelled()
        close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            Layout.leftMargin: Metrics.spacingMd
            Layout.rightMargin: Metrics.spacingSm
            Text {
                text: root.titleText
                color: Theme.textPrimary
                font.family: Typography.family
                font.pixelSize: Typography.sizeObjectTitle
                font.weight: Font.DemiBold
                Layout.fillWidth: true
            }
            AcToolButton {
                iconSource: Icons.close
                implicitWidth: 28
                implicitHeight: 28
                onClicked: root.requestCancel()
            }
        }

        AcTextField {
            id: searchField
            Layout.fillWidth: true
            Layout.leftMargin: Metrics.spacingMd
            Layout.rightMargin: Metrics.spacingMd
            Layout.bottomMargin: Metrics.spacingSm
            placeholderText: root.searchPlaceholder
            onTextChanged: {
                resultsPane.searchText = text
                resultsPane.syncSelection()
            }
            Keys.onDownPressed: resultsPane.moveSelection(1)
            Keys.onUpPressed: resultsPane.moveSelection(-1)
            Keys.onReturnPressed: root.confirmSelection()
            Keys.onEnterPressed: root.confirmSelection()
            Keys.onEscapePressed: root.requestCancel()
        }

        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSubtle }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            AcLogicCatalogCategoryPane {
                Layout.preferredWidth: 160
                Layout.fillHeight: true
                categoryIds: root.categoryIds
                selectedCategoryId: resultsPane.categoryId
                catalog: root.catalog
                onCategorySelected: function(categoryId) {
                    resultsPane.categoryId = categoryId
                    resultsPane.syncSelection()
                    resultsPane.scrollToSelected()
                }
            }
            Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; color: Theme.borderSubtle }
            AcLogicCatalogResultsPane {
                id: resultsPane
                Layout.fillWidth: true
                Layout.fillHeight: true
                Layout.minimumWidth: 220
                catalog: root.catalog
                categoryIds: root.categoryIds
                showTypeId: EditorSession.developerMode
                emptyKindLabel: root.emptyKindLabel
                onSelectionConfirmed: root.confirmSelection()
                onClearSearchRequested: searchField.text = ""
                onCancelled: root.requestCancel()
            }
            Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; color: Theme.borderSubtle }
            AcLogicCatalogDetailsPane {
                Layout.preferredWidth: 220
                Layout.fillHeight: true
                selectedEntry: resultsPane.selectedEntry
                replacingConfigured: root.replacingConfigured
                currentTypeId: root.currentTypeId
                replaceDiscardHint: root.replaceDiscardHint
                onAddComponentRequested: function(componentId) {
                    if (!EditorSession.ensureObjectTypeComponent(componentId))
                        return
                    if (root.catalog)
                        root.catalog.reload()
                    resultsPane.syncSelection()
                }
            }
        }

        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSubtle }
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            Layout.leftMargin: Metrics.spacingMd
            Layout.rightMargin: Metrics.spacingMd
            spacing: Metrics.spacingSm
            Item { Layout.fillWidth: true }
            AcButton { text: "Cancel"; onClicked: root.requestCancel() }
            AcButton {
                text: root.confirmLabel
                primary: true
                enabled: resultsPane.selectedEntry !== null && resultsPane.selectedEntry.available
                onClicked: root.confirmSelection()
            }
        }
    }

    Shortcut {
        sequence: "Ctrl+F"
        enabled: root.visible
        onActivated: searchField.forceActiveFocus()
    }
}

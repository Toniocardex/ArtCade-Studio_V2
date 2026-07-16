import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * One Logic Board column (When / Also require / Then) — presentation + optional catalog picker.
 * Mutations are emitted as typeChosen; parent routes to EditorSession commands.
 */
Item {
    id: root

    property string title: ""
    property string subtitle: ""
    property color accent: Theme.accent
    property string emptyText: "Empty"
    property string boardEmptyHint: "Add a rule to start"
    property bool boardHasRules: false
    property var blocks: []
    property bool editable: false
    property var catalogTypeIds: []
    property string currentTypeId: ""
    /** When true, ComboBox includes an empty entry meaning “no condition”. */
    property bool allowNone: false
    property string noneLabel: "None (always)"
    /**
     * Authorable property rows for the primary block:
     * [{ key, kind, value }, ...] from EditorSession.logicRules.
     */
    property var propertyRows: []

    readonly property var comboModel: {
        if (!root.allowNone)
            return root.catalogTypeIds
        const out = [""]
        for (let i = 0; i < root.catalogTypeIds.length; ++i)
            out.push(root.catalogTypeIds[i])
        return out
    }

    signal typeChosen(string typeId)
    signal propertyEdited(string propertyKey, string valueText)

    function labelForTypeId(typeId) {
        if (!typeId || typeId.length === 0)
            return root.noneLabel
        return EditorSession.logicBlockDisplayName(typeId)
    }

    function descriptionForTypeId(typeId) {
        if (!typeId || typeId.length === 0)
            return "Always true — no extra check required"
        return EditorSession.logicBlockDescription(typeId)
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Metrics.spacingMd
        spacing: Metrics.spacingSm

        RowLayout {
            spacing: Metrics.spacingSm
            Layout.fillWidth: true

            Rectangle {
                width: 3
                height: 14
                radius: 1
                color: root.accent
            }
            Column {
                Layout.fillWidth: true
                spacing: 1
                Text {
                    text: root.title
                    color: Theme.textPrimary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                    font.weight: Font.DemiBold
                }
                Text {
                    text: root.subtitle
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: Metrics.radiusSmall
            color: Theme.control
            border.color: Theme.borderSubtle
            border.width: 1

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: Metrics.spacingSm
                spacing: Metrics.spacingXs

                ListView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    model: root.blocks
                    spacing: Metrics.spacingXs
                    visible: root.blocks.length > 0

                    delegate: Rectangle {
                        required property string modelData
                        width: ListView.view.width
                        height: Metrics.controlHeight
                        radius: Metrics.radiusSmall
                        color: Theme.panelRaised
                        border.color: Theme.borderSubtle
                        border.width: 1

                        Text {
                            anchors.fill: parent
                            anchors.leftMargin: Metrics.spacingSm
                            anchors.rightMargin: Metrics.spacingSm
                            verticalAlignment: Text.AlignVCenter
                            text: EditorSession.logicBlockDisplayName(modelData)
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeXs
                            elide: Text.ElideRight
                        }
                    }
                }

                Text {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    visible: root.blocks.length === 0
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    wrapMode: Text.WordWrap
                    text: root.boardHasRules ? root.emptyText : root.boardEmptyHint
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                }

                ComboBox {
                    id: catalogBox
                    Layout.fillWidth: true
                    visible: root.editable && root.comboModel.length > 0 && root.boardHasRules
                    model: root.comboModel
                    enabled: !EditorSession.playing
                    // Suppress Fusion/system highlight blue; row chrome is custom.
                    palette.mid: Theme.panel
                    palette.window: Theme.panel
                    palette.base: Theme.panel
                    palette.button: Theme.panelRaised
                    palette.highlight: Theme.controlHover
                    palette.highlightedText: Theme.textPrimary
                    palette.text: Theme.textPrimary
                    palette.buttonText: Theme.textPrimary

                    contentItem: Text {
                        leftPadding: Metrics.spacingSm
                        rightPadding: catalogBox.indicator.width + Metrics.spacingSm
                        text: root.labelForTypeId(catalogBox.displayText)
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                        verticalAlignment: Text.AlignVCenter
                        elide: Text.ElideRight
                    }

                    background: Rectangle {
                        implicitHeight: Metrics.controlHeight
                        radius: Metrics.radiusSmall
                        color: catalogBox.hovered ? Theme.controlHover : Theme.panelRaised
                        border.color: catalogBox.popup.visible ? Theme.accent : Theme.borderSubtle
                        border.width: 1
                    }

                    popup: Popup {
                        y: catalogBox.height + 2
                        width: Math.max(catalogBox.width, 220)
                        implicitHeight: Math.min(contentItem.implicitHeight + 8, 300)
                        padding: 4
                        closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutsideParent

                        contentItem: ListView {
                            clip: true
                            implicitHeight: contentHeight
                            boundsBehavior: Flickable.StopAtBounds
                            model: catalogBox.popup.visible ? catalogBox.delegateModel : null
                            currentIndex: catalogBox.highlightedIndex
                            ScrollIndicator.vertical: ScrollIndicator {}
                            spacing: 2
                        }

                        background: Rectangle {
                            color: Theme.panelRaised
                            border.color: Theme.border
                            border.width: 1
                            radius: Metrics.radiusSmall
                        }
                    }

                    delegate: AcLogicCatalogItem {
                        required property string modelData
                        required property int index
                        width: ListView.view ? ListView.view.width : catalogBox.width
                        typeId: modelData
                        title: root.labelForTypeId(modelData)
                        description: root.descriptionForTypeId(modelData)
                        isCurrent: (modelData || "") === (root.currentTypeId || "")
                        highlighted: catalogBox.highlightedIndex === index
                    }

                    Component.onCompleted: syncIndex()
                    onActivated: function(index) {
                        const id = root.comboModel[index]
                        const current = root.currentTypeId || ""
                        if (id !== current)
                            root.typeChosen(id)
                    }

                    function syncIndex() {
                        const current = root.currentTypeId || ""
                        const i = root.comboModel.indexOf(current)
                        if (i >= 0)
                            catalogBox.currentIndex = i
                        else if (root.allowNone && current.length === 0)
                            catalogBox.currentIndex = 0
                    }
                }

                Repeater {
                    model: root.editable ? root.propertyRows : []
                    delegate: AcLogicPropertyEditor {
                        required property var modelData
                        Layout.fillWidth: true
                        propertyKey: modelData.key || ""
                        kind: modelData.kind || "string"
                        valueText: modelData.value || ""
                        choices: modelData.choices || []
                        onEdited: function(valueText) {
                            root.propertyEdited(propertyKey, valueText)
                        }
                    }
                }
            }
        }
    }

    onCurrentTypeIdChanged: catalogBox.syncIndex()
    onCatalogTypeIdsChanged: catalogBox.syncIndex()
}

import QtQuick
import QtQuick.Layouts
import ArtCade.Ui

Item {
    id: root

    property var selectedEntry: null
    property bool replacingConfigured: false
    property string currentTypeId: ""
    property string replaceDiscardHint: ""

    readonly property var missingComponentIds: {
        const out = []
        if (!selectedEntry)
            return out
        const ids = selectedEntry.missingComponentIds || []
        const requiredIds = selectedEntry.requiredComponentIds || []
        const labels = selectedEntry.requiredComponents || []
        for (let i = 0; i < ids.length; ++i) {
            const id = String(ids[i] || "")
            if (id.length === 0)
                continue
            const labelIndex = requiredIds.indexOf(id)
            out.push({
                id: id,
                label: labelIndex >= 0 ? (labels[labelIndex] || id) : id,
            })
        }
        return out
    }

    signal addComponentRequested(string componentId)

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Metrics.spacingMd
        spacing: Metrics.spacingSm
        visible: root.selectedEntry !== null

        Text {
            Layout.fillWidth: true
            text: root.selectedEntry ? String(root.selectedEntry.displayName).toUpperCase() : ""
            color: Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeToolbar
            font.weight: Font.DemiBold
            wrapMode: Text.WordWrap
        }
        Text {
            Layout.fillWidth: true
            text: root.selectedEntry ? root.selectedEntry.description : ""
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeToolbar
            wrapMode: Text.WordWrap
        }
        Text {
            text: "Category"
            color: Theme.textMuted
            font.pixelSize: Typography.sizeMeta
        }
        Text {
            Layout.fillWidth: true
            text: root.selectedEntry ? root.selectedEntry.categoryLabel : ""
            color: Theme.textPrimary
            font.pixelSize: Typography.sizeToolbar
        }
        Text {
            visible: root.selectedEntry && root.selectedEntry.requiredContext
                     && root.selectedEntry.requiredContext.length > 0
            text: "Context"
            color: Theme.textMuted
            font.pixelSize: Typography.sizeMeta
        }
        Text {
            Layout.fillWidth: true
            visible: root.selectedEntry && root.selectedEntry.requiredContext
                     && root.selectedEntry.requiredContext.length > 0
            text: root.selectedEntry ? root.selectedEntry.requiredContext.join(", ") : ""
            color: Theme.textPrimary
            font.pixelSize: Typography.sizeToolbar
            wrapMode: Text.WordWrap
        }
        Text {
            visible: root.selectedEntry && root.selectedEntry.requiredComponents
                     && root.selectedEntry.requiredComponents.length > 0
            text: "Requires"
            color: Theme.textMuted
            font.pixelSize: Typography.sizeMeta
        }
        Text {
            Layout.fillWidth: true
            visible: root.selectedEntry && root.selectedEntry.requiredComponents
                     && root.selectedEntry.requiredComponents.length > 0
            text: root.selectedEntry ? root.selectedEntry.requiredComponents.join(", ") : ""
            color: Theme.textPrimary
            font.pixelSize: Typography.sizeToolbar
            wrapMode: Text.WordWrap
        }
        Text {
            text: "Status"
            color: Theme.textMuted
            font.pixelSize: Typography.sizeMeta
        }
        Text {
            Layout.fillWidth: true
            text: {
                if (!root.selectedEntry)
                    return ""
                return root.selectedEntry.available ? "Available"
                                                    : (root.selectedEntry.unavailableReason || "Unavailable")
            }
            color: root.selectedEntry && root.selectedEntry.available ? Theme.textPrimary : Theme.warning
            font.pixelSize: Typography.sizeToolbar
            wrapMode: Text.WordWrap
        }

        Column {
            Layout.fillWidth: true
            spacing: Metrics.spacingXs
            visible: root.missingComponentIds.length > 0 && !EditorSession.playing

            Repeater {
                model: root.missingComponentIds
                delegate: AcButton {
                    required property var modelData
                    width: parent.width
                    text: "Add " + modelData.label
                    enabled: !EditorSession.playing
                    onClicked: root.addComponentRequested(modelData.id)
                }
            }
        }

        Text {
            visible: root.selectedEntry && String(root.selectedEntry.propertySummary || "").length > 0
            text: "Properties"
            color: Theme.textMuted
            font.pixelSize: Typography.sizeMeta
        }
        Text {
            Layout.fillWidth: true
            visible: root.selectedEntry && String(root.selectedEntry.propertySummary || "").length > 0
            text: root.selectedEntry ? root.selectedEntry.propertySummary : ""
            color: Theme.textSecondary
            font.pixelSize: Typography.sizeToolbar
            wrapMode: Text.WordWrap
        }
        Text {
            Layout.fillWidth: true
            visible: root.replacingConfigured && root.replaceDiscardHint.length > 0
                     && root.selectedEntry && root.selectedEntry.typeId !== root.currentTypeId
            text: root.replaceDiscardHint
            color: Theme.warning
            font.pixelSize: Typography.sizeMeta
            wrapMode: Text.WordWrap
        }
        Item { Layout.fillHeight: true }
    }

    Text {
        anchors.centerIn: parent
        visible: root.selectedEntry === null
        text: "Select a block"
        color: Theme.textMuted
        font.family: Typography.family
        font.pixelSize: Typography.sizeToolbar
    }
}

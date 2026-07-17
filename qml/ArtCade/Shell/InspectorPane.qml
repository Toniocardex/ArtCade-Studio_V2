import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.panel

    /** Captured at edit start so mid-edit selection change cannot apply to the wrong entity. */
    property int transformEditTargetId: 0

    readonly property string context: {
        if (!EditorSession.hasProject)
            return "no-project"
        if (EditorSession.activeMode === "script")
            return "script"
        if (EditorSession.activeMode === "logic")
            return "logic"
        if (EditorSession.hasAssetSelection)
            return "asset"
        if (EditorSession.hasSelection)
            return "entity"
        return "scene"
    }

    readonly property int contextIndex: {
        switch (root.context) {
        case "no-project": return 0
        case "script": return 1
        case "logic": return 2
        case "asset": return 3
        case "entity": return 4
        default: return 5
        }
    }

    readonly property string selectedLogicLabel: {
        const id = EditorSession.selectedLogicRuleId
        if (id.length === 0)
            return "None"
        const rules = EditorSession.logicRules || []
        for (let i = 0; i < rules.length; ++i) {
            if (rules[i].id === id)
                return rules[i].displayName || "Logic " + String(i + 1).padStart(2, "0")
        }
        return "None"
    }

    readonly property string logicStatusText: {
        const id = EditorSession.selectedLogicRuleId
        if (id.length === 0)
            return "—"
        const rules = EditorSession.logicRules || []
        for (let i = 0; i < rules.length; ++i) {
            if (rules[i].id !== id)
                continue
            const err = rules[i].errorCount || 0
            const warn = rules[i].warningCount || 0
            if (err > 0)
                return err + (err === 1 ? " error" : " errors")
            if (warn > 0)
                return warn + (warn === 1 ? " warning" : " warnings")
            return "OK"
        }
        return "—"
    }

    function captureTransformTarget() {
        transformEditTargetId = EditorSession.selectedEntityId
    }

    function syncTransformFieldsFromSession() {
        xField.value = EditorSession.selectedX
        yField.value = EditorSession.selectedY
        rotationField.value = EditorSession.selectedRotationDeg
        scaleXField.value = EditorSession.selectedScaleX
        scaleYField.value = EditorSession.selectedScaleY
    }

    function commitPos() {
        if (transformEditTargetId === 0
                || transformEditTargetId !== EditorSession.selectedEntityId) {
            syncTransformFieldsFromSession()
            return
        }
        EditorSession.commitPosition(transformEditTargetId, xField.value, yField.value)
    }

    function commitScale() {
        if (transformEditTargetId === 0
                || transformEditTargetId !== EditorSession.selectedEntityId) {
            syncTransformFieldsFromSession()
            return
        }
        EditorSession.commitScale(transformEditTargetId, scaleXField.value, scaleYField.value)
    }

    function commitRotation() {
        if (transformEditTargetId === 0
                || transformEditTargetId !== EditorSession.selectedEntityId) {
            syncTransformFieldsFromSession()
            return
        }
        EditorSession.commitRotation(transformEditTargetId, rotationField.value)
    }

    Connections {
        target: EditorSession
        function onSelectedTransformChanged() {
            if (root.context !== "entity")
                return
            if (!xField.activeFocus && !yField.activeFocus
                    && !rotationField.activeFocus
                    && !scaleXField.activeFocus && !scaleYField.activeFocus)
                syncTransformFieldsFromSession()
        }
        function onSelectionChanged() {
            if (root.context === "entity") {
                nameField.text = EditorSession.selectedName
                syncTransformFieldsFromSession()
            }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.panelRaised

            Text {
                anchors.left: parent.left
                anchors.leftMargin: Metrics.spacingMd
                anchors.verticalCenter: parent.verticalCenter
                text: "INSPECTOR"
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                font.weight: Font.DemiBold
            }

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: Theme.borderSubtle
            }
        }

        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.contextIndex

            // 0 — no-project
            Item {
                Text {
                    anchors.left: parent.left
                    anchors.leftMargin: Metrics.spacingMd
                    anchors.top: parent.top
                    anchors.topMargin: Metrics.spacingMd
                    text: "No project"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeBody
                }
            }

            // 1 — script
            Item {
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: Metrics.spacingMd
                    spacing: Metrics.spacingSm

                    Text {
                        text: "No script selected"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                        font.weight: Font.DemiBold
                    }
                    Text {
                        Layout.fillWidth: true
                        text: "Script authoring will appear here."
                        color: Theme.textMuted
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeSm
                        wrapMode: Text.WordWrap
                    }
                    Item { Layout.fillHeight: true }
                }
            }

            // 2 — logic
            ScrollView {
                clip: true
                ColumnLayout {
                    width: root.width
                    spacing: 0

                    AcPanelHeader {
                        title: EditorSession.selectedObjectTypeName.length > 0
                               ? EditorSession.selectedObjectTypeName
                               : "Object Type"
                        Layout.fillWidth: true
                        uppercase: false

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            spacing: Metrics.spacingSm
                            Text {
                                text: "Object Type"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                Layout.fillWidth: true
                                text: EditorSession.selectedObjectTypeName.length > 0
                                      ? EditorSession.selectedObjectTypeName
                                      : "—"
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                                elide: Text.ElideRight
                            }
                        }
                    }

                    AcPanelHeader {
                        title: "Logic"
                        Layout.fillWidth: true

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Logic items"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: String(EditorSession.logicRuleCount)
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Selected Logic"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: root.selectedLogicLabel
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                                ToolTip.visible: EditorSession.developerMode
                                                 && selectedLogicDevHover.hovered
                                                 && EditorSession.selectedLogicRuleId.length > 0
                                ToolTip.delay: 400
                                ToolTip.text: EditorSession.selectedLogicRuleId
                                HoverHandler { id: selectedLogicDevHover }
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            Text {
                                text: "Status"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: root.logicStatusText
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                            }
                        }
                    }

                    Item { Layout.fillHeight: true }
                }
            }

            // 3 — asset
            ScrollView {
                clip: true
                ColumnLayout {
                    width: root.width
                    spacing: 0

                    AcPanelHeader {
                        title: "Asset"
                        Layout.fillWidth: true

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Name"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                Layout.fillWidth: true
                                text: EditorSession.selectedAssetName
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                                elide: Text.ElideRight
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Type"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                Layout.fillWidth: true
                                text: {
                                    const k = EditorSession.selectedAssetKind
                                    if (k.length === 0)
                                        return "—"
                                    return k.charAt(0).toUpperCase() + k.slice(1)
                                }
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            Text {
                                text: "Path"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                Layout.fillWidth: true
                                text: EditorSession.selectedAssetPath.length > 0
                                      ? EditorSession.selectedAssetPath
                                      : EditorSession.selectedAssetId
                                color: Theme.textPrimary
                                font.family: Typography.familyMono
                                font.pixelSize: Typography.sizeXs
                                elide: Text.ElideMiddle
                            }
                        }
                    }

                    Item { Layout.fillHeight: true }
                }
            }

            // 4 — entity (Transform fields stay mounted while this page exists in StackLayout)
            ScrollView {
                clip: true
                ColumnLayout {
                    width: root.width
                    spacing: 0

                    AcPanelHeader {
                        title: "Object"
                        Layout.fillWidth: true

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Name"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            AcTextField {
                                id: nameField
                                Layout.fillWidth: true
                                text: EditorSession.selectedName
                                onEditingFinished: {
                                    if (text !== EditorSession.selectedName)
                                        EditorSession.commitRename(text)
                                }
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Type"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                Layout.fillWidth: true
                                text: EditorSession.selectedObjectTypeName
                                color: Theme.textPrimary
                                font.family: Typography.family
                                font.pixelSize: Typography.sizeSm
                                elide: Text.ElideRight
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Layer"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            ComboBox {
                                id: entityLayerCombo
                                Layout.fillWidth: true
                                enabled: !EditorSession.playing
                                model: EditorSession.layersModel
                                textRole: "display"
                                valueRole: "layerId"
                                palette.mid: Theme.panel
                                palette.window: Theme.panel
                                palette.base: Theme.panel
                                palette.button: Theme.panelRaised
                                palette.highlight: Theme.controlHover
                                palette.highlightedText: Theme.textPrimary
                                palette.text: Theme.textPrimary
                                palette.buttonText: Theme.textPrimary

                                function syncIndex() {
                                    currentIndex = Math.max(
                                        0, indexOfValue(EditorSession.selectedLayerId))
                                }

                                Component.onCompleted: syncIndex()
                                Connections {
                                    target: EditorSession
                                    function onSelectionChanged() {
                                        entityLayerCombo.syncIndex()
                                    }
                                }
                                onActivated: function(index) {
                                    const next = currentValue
                                    if (next !== EditorSession.selectedLayerId)
                                        EditorSession.setEntityLayer(
                                            EditorSession.selectedEntityId, next)
                                }

                                contentItem: Text {
                                    leftPadding: Metrics.spacingSm
                                    rightPadding: entityLayerCombo.indicator.width
                                                  + Metrics.spacingSm
                                    text: entityLayerCombo.displayText
                                    color: Theme.textPrimary
                                    font.pixelSize: Typography.sizeSm
                                    verticalAlignment: Text.AlignVCenter
                                    elide: Text.ElideRight
                                }
                                background: Rectangle {
                                    implicitHeight: Metrics.controlHeight
                                    color: entityLayerCombo.enabled
                                           ? Theme.panelRaised : Theme.panel
                                    border.width: 1
                                    border.color: entityLayerCombo.activeFocus
                                                  ? Theme.accent : Theme.border
                                    radius: Metrics.radiusSmall
                                }
                            }
                        }
                    }

                    AcPanelHeader {
                        title: "Transform"
                        Layout.fillWidth: true

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Position X"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            AcNumberField {
                                id: xField
                                Layout.fillWidth: true
                                value: EditorSession.selectedX
                                decimals: 3
                                enabled: !EditorSession.playing
                                onActiveFocusChanged: if (activeFocus) root.captureTransformTarget()
                            }
                            Text {
                                text: "px"
                                color: Theme.textMuted
                                font.pixelSize: Typography.sizeXs
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Position Y"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            AcNumberField {
                                id: yField
                                Layout.fillWidth: true
                                value: EditorSession.selectedY
                                decimals: 3
                                enabled: !EditorSession.playing
                                onActiveFocusChanged: if (activeFocus) root.captureTransformTarget()
                            }
                            Text {
                                text: "px"
                                color: Theme.textMuted
                                font.pixelSize: Typography.sizeXs
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Rotation"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            AcNumberField {
                                id: rotationField
                                Layout.fillWidth: true
                                value: EditorSession.selectedRotationDeg
                                decimals: 2
                                enabled: !EditorSession.playing
                                onActiveFocusChanged: if (activeFocus) root.captureTransformTarget()
                            }
                            Text {
                                text: "°"
                                color: Theme.textMuted
                                font.pixelSize: Typography.sizeXs
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Scale X"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            AcNumberField {
                                id: scaleXField
                                Layout.fillWidth: true
                                value: EditorSession.selectedScaleX
                                decimals: 3
                                enabled: !EditorSession.playing
                                onActiveFocusChanged: if (activeFocus) root.captureTransformTarget()
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            spacing: Metrics.spacingSm

                            Text {
                                text: "Scale Y"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            AcNumberField {
                                id: scaleYField
                                Layout.fillWidth: true
                                value: EditorSession.selectedScaleY
                                decimals: 3
                                enabled: !EditorSession.playing
                                onActiveFocusChanged: if (activeFocus) root.captureTransformTarget()
                            }
                        }

                        Connections {
                            target: xField
                            function onEditingFinished() { root.commitPos() }
                        }
                        Connections {
                            target: yField
                            function onEditingFinished() { root.commitPos() }
                        }
                        Connections {
                            target: rotationField
                            function onEditingFinished() { root.commitRotation() }
                        }
                        Connections {
                            target: scaleXField
                            function onEditingFinished() { root.commitScale() }
                        }
                        Connections {
                            target: scaleYField
                            function onEditingFinished() { root.commitScale() }
                        }
                    }

                    Item { Layout.fillHeight: true }
                }
            }

            // 5 — scene (nothing selected)
            ScrollView {
                clip: true
                ColumnLayout {
                    width: root.width
                    spacing: 0

                    Text {
                        Layout.fillWidth: true
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.topMargin: Metrics.spacingMd
                        Layout.bottomMargin: Metrics.spacingSm
                        text: "Nothing selected"
                        color: Theme.textMuted
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeBody
                    }

                    AcPanelHeader {
                        title: "Canvas"
                        Layout.fillWidth: true
                        expanded: true

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Scene Name"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: EditorSession.activeSceneName
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeSm
                                Layout.fillWidth: true
                                elide: Text.ElideRight
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Size"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: Math.round(EditorSession.activeSceneWidth) + " × "
                                      + Math.round(EditorSession.activeSceneHeight)
                                color: Theme.textPrimary
                                font.family: Typography.familyMono
                                font.pixelSize: Typography.sizeXs
                                Layout.fillWidth: true
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            Text {
                                text: "Active Layer"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: EditorSession.activeLayerId.length
                                      ? EditorSession.activeLayerId : "—"
                                color: Theme.textPrimary
                                font.pixelSize: Typography.sizeXs
                                Layout.fillWidth: true
                                elide: Text.ElideRight
                            }
                        }
                    }

                    AcPanelHeader {
                        title: "World Settings"
                        Layout.fillWidth: true

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingXs
                            Text {
                                text: "Gravity"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: EditorSession.worldGravity.toFixed(2)
                                color: Theme.textPrimary
                                font.family: Typography.familyMono
                                font.pixelSize: Typography.sizeXs
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: Metrics.spacingMd
                            Layout.rightMargin: Metrics.spacingMd
                            Layout.bottomMargin: Metrics.spacingSm
                            Text {
                                text: "Pixels / Meter"
                                color: Theme.textSecondary
                                font.pixelSize: Typography.sizeXs
                                Layout.preferredWidth: Metrics.labelColumnWidth
                            }
                            Text {
                                text: EditorSession.worldPixelsPerMeter.toFixed(0)
                                color: Theme.textPrimary
                                font.family: Typography.familyMono
                                font.pixelSize: Typography.sizeXs
                            }
                        }
                    }

                    Item { Layout.fillHeight: true }
                }
            }
        }
    }

    Rectangle {
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        width: 1
        color: Theme.border
    }
}

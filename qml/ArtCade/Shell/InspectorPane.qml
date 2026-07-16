import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.panel

    /** Captured at edit start so mid-edit selection change cannot apply to the wrong entity. */
    property int transformEditTargetId: 0

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
            if (!xField.activeFocus && !yField.activeFocus
                    && !rotationField.activeFocus
                    && !scaleXField.activeFocus && !scaleYField.activeFocus)
                syncTransformFieldsFromSession()
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

        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true

            ColumnLayout {
                width: root.width
                spacing: 0

                Text {
                    visible: !EditorSession.hasSelection && !EditorSession.hasProject
                    Layout.fillWidth: true
                    Layout.leftMargin: Metrics.spacingMd
                    Layout.topMargin: Metrics.spacingMd
                    text: "No project"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                }

                Text {
                    visible: EditorSession.hasProject && !EditorSession.hasSelection
                    Layout.fillWidth: true
                    Layout.leftMargin: Metrics.spacingMd
                    Layout.topMargin: Metrics.spacingMd
                    text: "No Selection"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                }

                AcPanelHeader {
                    title: "Object"
                    Layout.fillWidth: true
                    visible: EditorSession.hasSelection

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
                        Layout.bottomMargin: Metrics.spacingSm
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
                }

                AcPanelHeader {
                    title: "Transform"
                    Layout.fillWidth: true
                    visible: EditorSession.hasSelection

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

                    // Connections (not onEditingFinished overrides) so AcNumberField can parse first.
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

                AcPanelHeader {
                    title: "Canvas"
                    Layout.fillWidth: true
                    visible: EditorSession.hasProject
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
                    visible: EditorSession.hasProject

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

                AcPanelHeader {
                    title: "Output"
                    Layout.fillWidth: true
                    expanded: false
                    visible: EditorSession.hasProject

                    Text {
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.bottomMargin: Metrics.spacingSm
                        text: "Target platform — coming next"
                        color: Theme.textMuted
                        font.pixelSize: Typography.sizeXs
                    }
                }

                AcPanelHeader {
                    title: "Debug / Time"
                    Layout.fillWidth: true
                    expanded: false
                    visible: EditorSession.hasProject

                    Text {
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.bottomMargin: Metrics.spacingSm
                        text: "Grid / colliders — coming next"
                        color: Theme.textMuted
                        font.pixelSize: Typography.sizeXs
                    }
                }

                Item { Layout.fillHeight: true }
            }
        }
    }

    Connections {
        target: EditorSession
        function onSelectionChanged() {
            nameField.text = EditorSession.selectedName
            xField.value = EditorSession.selectedX
            yField.value = EditorSession.selectedY
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

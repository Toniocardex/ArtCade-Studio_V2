import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.panel
    property int sceneTab: 0

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // —— SCENE ——
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.panelRaised

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingMd
                anchors.rightMargin: Metrics.spacingSm

                Text {
                    text: "SCENE"
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                    font.weight: Font.DemiBold
                    Layout.fillWidth: true
                }

                AcIconButton {
                    text: "Open"
                    onClicked: openDialog.open()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Open project.json"
                }
                AcIconButton {
                    visible: EditorSession.developerMode
                    text: "Fixture"
                    onClicked: EditorSession.openSliceFixture()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Developer: load Qt slice fixture"
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.controlHeight + Metrics.spacingSm
            Layout.leftMargin: Metrics.spacingSm
            Layout.rightMargin: Metrics.spacingSm
            Layout.topMargin: Metrics.spacingSm
            spacing: Metrics.spacingXs

            AcTabButton {
                text: "Hierarchy"
                active: root.sceneTab === 0
                Layout.fillWidth: true
                onClicked: root.sceneTab = 0
            }
            AcTabButton {
                text: "Layers"
                active: root.sceneTab === 1
                Layout.fillWidth: true
                onClicked: root.sceneTab = 1
            }
        }

        AcTextField {
            Layout.fillWidth: true
            Layout.leftMargin: Metrics.spacingSm
            Layout.rightMargin: Metrics.spacingSm
            Layout.topMargin: Metrics.spacingSm
            Layout.bottomMargin: Metrics.spacingXs
            placeholderText: root.sceneTab === 0 ? "Search hierarchy" : "Search layers"
            enabled: EditorSession.hasProject
        }

        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.sceneTab

            // Hierarchy
            Item {
                TreeView {
                    id: hierarchyTree
                    anchors.fill: parent
                    clip: true
                    model: EditorSession.hierarchyModel
                    boundsBehavior: Flickable.StopAtBounds
                    delegate: AcTreeDelegate {}
                    visible: EditorSession.hasProject
                    ScrollBar.vertical: ScrollBar {
                        policy: ScrollBar.AsNeeded
                    }

                    function expandScenes() {
                        for (let r = 0; r < rows; ++r)
                            expand(r)
                    }

                    Connections {
                        target: EditorSession
                        function onProjectChanged() {
                            Qt.callLater(hierarchyTree.expandScenes)
                        }
                        function onHasProjectChanged() {
                            if (EditorSession.hasProject)
                                Qt.callLater(hierarchyTree.expandScenes)
                        }
                    }
                    Connections {
                        target: EditorSession.hierarchyModel
                        function onModelReset() {
                            Qt.callLater(hierarchyTree.expandScenes)
                        }
                    }
                }

                AcEmptyHint {
                    visible: !EditorSession.hasProject
                    message: "No project"
                    hint: "Create or open a project from the home screen"
                }
            }

            // Layers
            Item {
                ListView {
                    id: layersList
                    anchors.fill: parent
                    clip: true
                    model: EditorSession.layersModel
                    spacing: 1
                    boundsBehavior: Flickable.StopAtBounds
                    visible: EditorSession.hasProject
                    ScrollBar.vertical: ScrollBar {
                        policy: ScrollBar.AsNeeded
                    }

                    delegate: AcLayerRow {
                        onActivateRequested: function(id) { EditorSession.setActiveLayer(id) }
                        onVisibilityToggled: function(id, visible) {
                            EditorSession.setLayerVisible(id, visible)
                        }
                    }
                }

                AcEmptyHint {
                    visible: !EditorSession.hasProject
                    message: "No project"
                    hint: "Create or open a project from the home screen"
                }
            }
        }

        // —— ASSETS dock (single registry list) ——
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.border
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.panelRaised

            Text {
                anchors.left: parent.left
                anchors.leftMargin: Metrics.spacingMd
                anchors.verticalCenter: parent.verticalCenter
                text: "ASSETS"
                color: Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeXs
                font.weight: Font.DemiBold
            }
        }

        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 180
            Layout.minimumHeight: 120

            ListView {
                id: assetsList
                anchors.fill: parent
                clip: true
                model: EditorSession.assetsModel
                visible: EditorSession.hasProject && count > 0
                ScrollBar.vertical: ScrollBar {
                    policy: ScrollBar.AsNeeded
                }

                delegate: Rectangle {
                    id: assetRow
                    width: assetsList.width
                    height: Metrics.controlHeight + 8
                    required property string display
                    required property string assetId
                    required property string sourcePath
                    required property string kind
                    readonly property bool selected:
                        assetId === EditorSession.selectedAssetId

                    color: selected ? Theme.panelRaised
                         : (assetMa.containsMouse ? Theme.controlHover : "transparent")

                    Rectangle {
                        anchors.left: parent.left
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        width: 2
                        color: Theme.accent
                        visible: assetRow.selected
                    }

                    Column {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.leftMargin: Metrics.spacingMd + 2
                        anchors.rightMargin: Metrics.spacingMd
                        spacing: 2

                        Text {
                            width: parent.width
                            text: assetRow.display
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeSm
                            elide: Text.ElideRight
                        }
                        Text {
                            width: parent.width
                            text: {
                                const kindLabel = assetRow.kind.length > 0
                                                  ? assetRow.kind.charAt(0).toUpperCase()
                                                    + assetRow.kind.slice(1)
                                                  : "Asset"
                                const path = assetRow.sourcePath.length > 0
                                             ? assetRow.sourcePath
                                             : assetRow.assetId
                                return kindLabel + "  ·  " + path
                            }
                            color: Theme.textMuted
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeXs
                            elide: Text.ElideMiddle
                        }
                    }

                    MouseArea {
                        id: assetMa
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: EditorSession.selectedAssetId = assetRow.assetId
                    }
                }
            }

            AcEmptyHint {
                visible: !EditorSession.hasProject
                message: "No project"
                hint: "Create or open a project to view its assets."
            }

            AcEmptyHint {
                visible: EditorSession.hasProject && assetsList.count === 0
                message: "No assets yet"
                hint: "Imported and generated assets will appear here."
            }
        }
    }

    FileDialog {
        id: openDialog
        title: "Open ArtCade project.json"
        nameFilters: ["JSON (*.json)", "All files (*)"]
        fileMode: FileDialog.OpenFile
        onAccepted: EditorSession.openProject(selectedFile)
    }

    Rectangle {
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        anchors.right: parent.right
        width: 1
        color: Theme.border
    }
}

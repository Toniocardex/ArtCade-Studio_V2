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
                }
                AcIconButton {
                    text: "Fixture"
                    onClicked: EditorSession.openSliceFixture()
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
            AcTabButton {
                text: "Assets"
                active: root.sceneTab === 2
                Layout.fillWidth: true
                onClicked: root.sceneTab = 2
            }
        }

        AcTextField {
            Layout.fillWidth: true
            Layout.leftMargin: Metrics.spacingSm
            Layout.rightMargin: Metrics.spacingSm
            Layout.topMargin: Metrics.spacingXs
            placeholderText: root.sceneTab === 0 ? "Search hierarchy"
                           : root.sceneTab === 1 ? "Search layers"
                           : "Search assets"
            enabled: EditorSession.hasProject
        }

        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: root.sceneTab

            TreeView {
                id: hierarchyTree
                clip: true
                model: EditorSession.hierarchyModel
                boundsBehavior: Flickable.StopAtBounds
                delegate: AcTreeDelegate {}

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

                Text {
                    anchors.centerIn: parent
                    visible: !EditorSession.hasProject
                    text: "Open or load Fixture"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                    z: 1
                }
            }

            ListView {
                id: layersList
                clip: true
                model: EditorSession.layersModel

                delegate: Rectangle {
                    width: layersList.width
                    height: Metrics.controlHeight
                    required property string display
                    required property string layerId
                    required property bool layerVisible
                    required property bool locked
                    required property bool active

                    color: active ? Theme.selection
                                  : (layerMa.containsMouse ? Theme.controlHover : "transparent")

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: Metrics.spacingMd
                        anchors.rightMargin: Metrics.spacingSm
                        spacing: Metrics.spacingSm

                        CheckBox {
                            checked: layerVisible
                            onToggled: EditorSession.setLayerVisible(layerId, checked)
                        }

                        Text {
                            text: display
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeSm
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                        }

                        AcIcon {
                            visible: locked
                            source: Icons.lock
                            size: 12
                            color: Theme.textSecondary
                        }
                    }

                    MouseArea {
                        id: layerMa
                        anchors.fill: parent
                        anchors.leftMargin: 36
                        hoverEnabled: true
                        onClicked: EditorSession.setActiveLayer(layerId)
                    }
                }
            }

            ListView {
                id: assetsTabList
                clip: true
                model: EditorSession.assetsModel

                delegate: Rectangle {
                    width: assetsTabList.width
                    height: Metrics.controlHeight + 6
                    required property string display
                    required property string assetId
                    required property string sourcePath
                    required property string kind

                    color: assetMa.containsMouse ? Theme.controlHover : "transparent"

                    Column {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.leftMargin: Metrics.spacingMd
                        anchors.rightMargin: Metrics.spacingMd
                        spacing: 2

                        Text {
                            width: parent.width
                            text: display
                            color: Theme.textPrimary
                            font.family: Typography.family
                            font.pixelSize: Typography.sizeSm
                            elide: Text.ElideRight
                        }
                        Text {
                            width: parent.width
                            text: sourcePath.length > 0 ? sourcePath : assetId
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
                    }
                }
            }
        }

        // —— ASSETS dock (always visible folder strip) ——
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.border
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.panelRaised

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingMd
                anchors.rightMargin: Metrics.spacingSm

                Text {
                    text: "ASSETS"
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                    font.weight: Font.DemiBold
                    Layout.fillWidth: true
                }

                AcToolButton {
                    iconSource: Icons.search
                    implicitWidth: 26
                    implicitHeight: 26
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Search assets — coming next"
                }
                AcToolButton {
                    iconSource: Icons.add
                    implicitWidth: 26
                    implicitHeight: 26
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Import asset — coming next"
                }
            }
        }

        ListView {
            id: assetFolders
            Layout.fillWidth: true
            Layout.preferredHeight: 160
            Layout.minimumHeight: 100
            clip: true
            model: ListModel {
                ListElement { name: "Favorites" }
                ListElement { name: "Images" }
                ListElement { name: "Audio" }
                ListElement { name: "Fonts" }
                ListElement { name: "Scripts" }
                ListElement { name: "Scenes" }
                ListElement { name: "Tilesets" }
                ListElement { name: "Prefabs" }
            }

            delegate: Rectangle {
                width: assetFolders.width
                height: Metrics.controlHeight - 2
                required property string name
                color: folderMa.containsMouse ? Theme.controlHover : "transparent"

                Row {
                    anchors.left: parent.left
                    anchors.leftMargin: Metrics.spacingMd
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Metrics.spacingSm

                    AcIcon {
                        source: Icons.folder
                        size: Metrics.iconSize
                        color: Theme.textSecondary
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Text {
                        text: name
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeSm
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }

                MouseArea {
                    id: folderMa
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: root.sceneTab = 2
                }
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

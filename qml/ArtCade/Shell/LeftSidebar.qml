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

            ListView {
                id: hierarchyList
                clip: true
                model: EditorSession.hierarchyModel

                delegate: Rectangle {
                    width: hierarchyList.width
                    height: Metrics.controlHeight
                    required property string display
                    required property string nodeKind
                    required property var stableId

                    color: nodeKind === "instance" && EditorSession.selectedEntityId === stableId
                           ? Theme.selection
                           : (hierarchyMa.containsMouse ? Theme.controlHover : "transparent")

                    Text {
                        anchors.left: parent.left
                        anchors.leftMargin: nodeKind === "scene" ? Metrics.spacingMd : Metrics.spacingXl
                        anchors.verticalCenter: parent.verticalCenter
                        text: display
                        color: nodeKind === "scene" ? Theme.textSecondary : Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeSm
                        font.weight: nodeKind === "scene" ? Font.DemiBold : Font.Normal
                    }

                    MouseArea {
                        id: hierarchyMa
                        anchors.fill: parent
                        hoverEnabled: true
                        enabled: nodeKind === "instance"
                        onClicked: EditorSession.selectEntity(stableId)
                    }
                }

                Text {
                    anchors.centerIn: parent
                    visible: !EditorSession.hasProject
                    text: "Open or load Fixture"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
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

                        Text {
                            visible: locked
                            text: Icons.lock
                            color: Theme.textMuted
                            font.pixelSize: Typography.sizeXs
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
                    glyph: Icons.search
                    implicitWidth: 26
                    implicitHeight: 26
                }
                AcToolButton {
                    glyph: Icons.add
                    implicitWidth: 26
                    implicitHeight: 26
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

                    Text {
                        text: Icons.folder
                        color: Theme.textMuted
                        font.pixelSize: Typography.sizeSm
                    }
                    Text {
                        text: name
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeSm
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

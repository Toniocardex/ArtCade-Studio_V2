import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.panel

    function commitPos() {
        if (!EditorSession.hasSelection)
            return
        if (xField.value === EditorSession.selectedX
                && yField.value === EditorSession.selectedY)
            return
        EditorSession.commitPosition(xField.value, yField.value)
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
                            onEditingFinished: commitPos()
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
                        Layout.bottomMargin: Metrics.spacingSm
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
                            onEditingFinished: commitPos()
                        }
                        Text {
                            text: "px"
                            color: Theme.textMuted
                            font.pixelSize: Typography.sizeXs
                        }
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

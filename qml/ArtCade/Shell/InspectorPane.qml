import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.panel

    function commitPos() {
        const x = Number(xField.text)
        const y = Number(yField.text)
        if (isNaN(x) || isNaN(y))
            return
        if (x === EditorSession.selectedX && y === EditorSession.selectedY)
            return
        EditorSession.commitPosition(x, y)
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
                    visible: !EditorSession.hasSelection
                    Layout.fillWidth: true
                    Layout.leftMargin: Metrics.spacingMd
                    Layout.topMargin: Metrics.spacingMd
                    text: EditorSession.hasProject ? "No Selection" : "No project"
                    color: Theme.textMuted
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                }

                AcPanelHeader {
                    title: "Name"
                    Layout.fillWidth: true
                    visible: EditorSession.hasSelection

                    AcTextField {
                        id: nameField
                        Layout.fillWidth: true
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.rightMargin: Metrics.spacingMd
                        Layout.bottomMargin: Metrics.spacingSm
                        text: EditorSession.selectedName
                        onEditingFinished: {
                            if (text !== EditorSession.selectedName)
                                EditorSession.commitRename(text)
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
                        Layout.bottomMargin: Metrics.spacingSm
                        spacing: Metrics.spacingSm

                        Text {
                            text: "X"
                            color: Theme.textSecondary
                            font.pixelSize: Typography.sizeXs
                            Layout.preferredWidth: 14
                        }
                        AcTextField {
                            id: xField
                            Layout.fillWidth: true
                            text: EditorSession.selectedX.toFixed(2)
                            font.family: Typography.familyMono
                            onEditingFinished: commitPos()
                        }
                        Text {
                            text: "Y"
                            color: Theme.textSecondary
                            font.pixelSize: Typography.sizeXs
                            Layout.preferredWidth: 14
                        }
                        AcTextField {
                            id: yField
                            Layout.fillWidth: true
                            text: EditorSession.selectedY.toFixed(2)
                            font.family: Typography.familyMono
                            onEditingFinished: commitPos()
                        }
                    }
                }

                AcPanelHeader {
                    title: "Canvas"
                    Layout.fillWidth: true
                    expanded: false

                    Text {
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.bottomMargin: Metrics.spacingSm
                        text: "Scene settings — coming next"
                        color: Theme.textMuted
                        font.pixelSize: Typography.sizeXs
                    }
                }

                AcPanelHeader {
                    title: "World Settings"
                    Layout.fillWidth: true
                    expanded: false

                    Text {
                        Layout.leftMargin: Metrics.spacingMd
                        Layout.bottomMargin: Metrics.spacingSm
                        text: "Physics / tile size — coming next"
                        color: Theme.textMuted
                        font.pixelSize: Typography.sizeXs
                    }
                }

                AcPanelHeader {
                    title: "Output"
                    Layout.fillWidth: true
                    expanded: false

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
            xField.text = EditorSession.selectedX.toFixed(2)
            yField.text = EditorSession.selectedY.toFixed(2)
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

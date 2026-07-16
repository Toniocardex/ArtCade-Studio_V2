import QtQuick
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.viewport
    property string activeTool: "select"
    property bool gridOn: true
    property bool snapOn: false

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Scene document tabs
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.chrome

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingSm
                spacing: Metrics.spacingXs

                Rectangle {
                    Layout.preferredHeight: parent.height - 6
                    Layout.preferredWidth: sceneTabLabel.implicitWidth + Metrics.spacingLg * 2
                    Layout.alignment: Qt.AlignVCenter
                    radius: Metrics.radiusSmall
                    color: Theme.panelRaised
                    border.color: Theme.borderSubtle
                    border.width: 1

                    Text {
                        id: sceneTabLabel
                        anchors.centerIn: parent
                        text: EditorSession.hasProject ? (EditorSession.projectName + " · scene")
                                                       : "No scene"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeXs
                    }
                }

                AcToolButton {
                    glyph: Icons.add
                    implicitWidth: 26
                    implicitHeight: 26
                    enabled: false
                }

                Item { Layout.fillWidth: true }
            }

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: Theme.borderSubtle
            }
        }

        // Scene toolbar
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.toolbarHeight
            color: Theme.chrome

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingSm
                anchors.rightMargin: Metrics.spacingSm
                spacing: Metrics.spacingXs

                AcToolButton {
                    glyph: Icons.select
                    checkable: true
                    checked: root.activeTool === "select"
                    onClicked: root.activeTool = "select"
                }
                AcToolButton {
                    glyph: Icons.pan
                    checkable: true
                    checked: root.activeTool === "pan"
                    onClicked: root.activeTool = "pan"
                }
                AcToolButton {
                    glyph: Icons.move
                    checkable: true
                    checked: root.activeTool === "move"
                    onClicked: root.activeTool = "move"
                }
                AcToolButton {
                    glyph: Icons.rect
                    checkable: true
                    checked: root.activeTool === "rect"
                    onClicked: root.activeTool = "rect"
                }

                Rectangle {
                    Layout.preferredWidth: 1
                    Layout.preferredHeight: 20
                    color: Theme.borderSubtle
                }

                Text {
                    text: "Local"
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                }

                Text {
                    text: Math.round(sceneView.zoom * 100) + "%"
                    color: Theme.textPrimary
                    font.family: Typography.familyMono
                    font.pixelSize: Typography.sizeXs
                }

                Text {
                    text: EditorSession.activeLayerId.length > 0
                          ? EditorSession.activeLayerId : "Layer"
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                    elide: Text.ElideRight
                    Layout.maximumWidth: 120
                }

                Item { Layout.fillWidth: true }

                AcToolButton {
                    glyph: Icons.grid
                    checkable: true
                    checked: root.gridOn
                    onClicked: root.gridOn = !root.gridOn
                }
                AcToolButton {
                    glyph: Icons.snap
                    checkable: true
                    checked: root.snapOn
                    onClicked: root.snapOn = !root.snapOn
                }
                AcButton {
                    text: "Fit"
                    onClicked: sceneView.fitActiveScene()
                }
            }

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: Theme.borderSubtle
            }
        }

        // Viewport
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            SceneViewItem {
                id: sceneView
                anchors.fill: parent
                visible: EditorSession.activeMode === "canvas" && EditorSession.hasProject
                session: EditorSession
            }

            // Empty / mode placeholders
            Column {
                anchors.centerIn: parent
                spacing: Metrics.spacingMd
                visible: EditorSession.activeMode === "canvas" && !EditorSession.hasProject
                width: parent.width * 0.6

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: Icons.sceneEmpty
                    color: Theme.textMuted
                    font.pixelSize: 36
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: "Your scene is empty. Open a project or load the Fixture to start editing."
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                }
                Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: Metrics.spacingSm
                    AcButton {
                        text: "+ Add Object"
                        primary: true
                        enabled: false
                    }
                    AcButton {
                        text: "Load Fixture"
                        onClicked: EditorSession.openSliceFixture()
                    }
                }
            }

            Column {
                anchors.centerIn: parent
                spacing: Metrics.spacingSm
                visible: EditorSession.activeMode !== "canvas"

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: EditorSession.activeMode === "logic" ? "Logic Board" : "Script Editor"
                    color: Theme.textPrimary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXl
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Coming next on the Qt roadmap"
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeSm
                }
            }
        }
    }
}

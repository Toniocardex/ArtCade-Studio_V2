import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.viewport
    // Tool + snap live on EditorSession (workspace SoT) — no local mirror.

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Scene document tabs (Canvas only)
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.chrome
            visible: EditorSession.activeMode === "canvas"

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
                    iconSource: Icons.add
                    implicitWidth: 26
                    implicitHeight: 26
                    enabled: false
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add scene tab — coming next"
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

        // Scene toolbar (Canvas only)
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.toolbarHeight
            color: Theme.chrome
            visible: EditorSession.activeMode === "canvas"

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingSm
                anchors.rightMargin: Metrics.spacingSm
                spacing: Metrics.spacingXs

                AcToolButton {
                    iconSource: Icons.select
                    checkable: true
                    checked: EditorSession.activeTool === "select"
                    onClicked: EditorSession.activeTool = "select"
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Select — click objects to pick them"
                }
                AcToolButton {
                    iconSource: Icons.pan
                    checkable: true
                    checked: EditorSession.activeTool === "pan"
                    onClicked: EditorSession.activeTool = "pan"
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Pan — drag to move the view\n(also Middle mouse or Alt+Left)"
                }
                AcToolButton {
                    iconSource: Icons.move
                    checkable: true
                    checked: EditorSession.activeTool === "move"
                    onClicked: EditorSession.activeTool = "move"
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Move — drag objects to change position"
                }
                AcToolButton {
                    iconSource: Icons.rect
                    checkable: true
                    checked: EditorSession.activeTool === "rect"
                    onClicked: EditorSession.activeTool = "rect"
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Rectangle select — drag a box; picks topmost hit"
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
                    ToolTip.visible: localSpaceHover.hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Transform space: Local (World coming next)"
                    HoverHandler { id: localSpaceHover }
                }

                Text {
                    text: Math.round(sceneView.zoom * 100) + "%"
                    color: Theme.textPrimary
                    font.family: Typography.familyMono
                    font.pixelSize: Typography.sizeXs
                    ToolTip.visible: zoomHover.hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Zoom — scroll the mouse wheel to zoom"
                    HoverHandler { id: zoomHover }
                }

                Text {
                    text: EditorSession.activeLayerId.length > 0
                          ? EditorSession.activeLayerId : "Layer"
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
                    elide: Text.ElideRight
                    Layout.maximumWidth: 120
                    ToolTip.visible: layerHover.hovered && EditorSession.activeLayerId.length > 0
                    ToolTip.delay: 400
                    ToolTip.text: "Active layer: " + EditorSession.activeLayerId
                    HoverHandler { id: layerHover }
                }

                Item { Layout.fillWidth: true }

                AcToolButton {
                    iconSource: Icons.grid
                    checkable: true
                    checked: sceneView.gridVisible
                    onClicked: sceneView.gridVisible = !sceneView.gridVisible
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: sceneView.gridVisible ? "Hide scene grid" : "Show scene grid"
                }
                AcToolButton {
                    iconSource: Icons.snap
                    checkable: true
                    checked: EditorSession.snapEnabled
                    onClicked: EditorSession.snapEnabled = !EditorSession.snapEnabled
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: EditorSession.snapEnabled
                                 ? "Snap to grid — on"
                                 : "Snap to grid — off"
                }
                AcButton {
                    text: "Fit"
                    onClicked: sceneView.fitActiveScene()
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Fit active scene into the view"
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

                AcIcon {
                    anchors.horizontalCenter: parent.horizontalCenter
                    source: Icons.sceneEmpty
                    size: 36
                    color: Theme.textMuted
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
                        ToolTip.visible: hovered
                        ToolTip.delay: 400
                        ToolTip.text: "Add object — coming next"
                    }
                    AcButton {
                        text: "Load Fixture"
                        onClicked: EditorSession.openSliceFixture()
                        ToolTip.visible: hovered
                        ToolTip.delay: 400
                        ToolTip.text: "Load the Qt slice fixture project (Ctrl+Shift+F)"
                    }
                }
            }

            LogicBoardView {
                anchors.fill: parent
                visible: EditorSession.activeMode === "logic"
            }

            Column {
                anchors.centerIn: parent
                spacing: Metrics.spacingSm
                visible: EditorSession.activeMode === "script"

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Script Editor"
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

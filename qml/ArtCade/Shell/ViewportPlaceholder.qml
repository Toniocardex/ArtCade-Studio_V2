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

        // Single Canvas toolbar: scene chip + tools | view controls
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.toolbarHeight
            color: Theme.chrome
            visible: EditorSession.activeMode === "canvas" && EditorSession.hasProject

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingSm
                anchors.rightMargin: Metrics.spacingSm
                spacing: Metrics.spacingXs

                Rectangle {
                    Layout.preferredHeight: parent.height - 8
                    Layout.preferredWidth: sceneChipLabel.implicitWidth + Metrics.spacingMd * 2
                    Layout.alignment: Qt.AlignVCenter
                    radius: Metrics.radiusControl
                    color: Theme.panelRaised
                    border.color: Theme.borderSubtle
                    border.width: 1

                    Text {
                        id: sceneChipLabel
                        anchors.centerIn: parent
                        text: EditorSession.activeSceneName.length > 0
                              ? EditorSession.activeSceneName
                              : "Main Scene"
                        color: Theme.textPrimary
                        font.family: Typography.family
                        font.pixelSize: Typography.sizeMeta
                    }
                }

                Rectangle {
                    Layout.preferredWidth: 1
                    Layout.preferredHeight: 20
                    color: Theme.borderSubtle
                }

                AcToolButton {
                    iconSource: Icons.select
                    checkable: true
                    checked: EditorSession.activeTool === "select"
                    onClicked: EditorSession.activeTool = "select"
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Select — click to pick, drag to move"
                }
                AcToolButton {
                    iconSource: Icons.pan
                    checkable: true
                    checked: EditorSession.activeTool === "pan"
                    onClicked: EditorSession.activeTool = "pan"
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Pan — drag to move the view\nMiddle mouse, Space+drag, or Alt+Left"
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
                Text {
                    text: Math.round(sceneView.zoom * 100) + "%"
                    color: Theme.textPrimary
                    font.family: Typography.familyMono
                    font.pixelSize: Typography.sizeXs
                    Layout.alignment: Qt.AlignVCenter
                    ToolTip.visible: zoomHover.hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Zoom — scroll the mouse wheel to zoom"
                    HoverHandler { id: zoomHover }
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
                visible: EditorSession.activeMode === "canvas"
                         && EditorSession.hasProject
                         && EditorSession.sceneCount > 0
                session: EditorSession
            }

            // Project Home — true no-project landing
            ProjectHome {
                anchors.fill: parent
                visible: !EditorSession.hasProject
            }

            // Project open, but no scenes authored yet
            Column {
                anchors.centerIn: parent
                spacing: Metrics.spacingMd
                visible: EditorSession.activeMode === "canvas"
                         && EditorSession.hasProject
                         && EditorSession.sceneCount === 0
                width: Math.min(parent.width * 0.6, 360)

                Text {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: "No scenes yet"
                    color: Theme.textPrimary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeObjectTitle
                    font.weight: Font.DemiBold
                }
                Text {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: "This project has no scenes. Add a scene to start laying out objects."
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeBody
                }
            }

            // Active scene without objects
            Column {
                anchors.centerIn: parent
                spacing: Metrics.spacingMd
                visible: EditorSession.activeMode === "canvas"
                         && EditorSession.hasProject
                         && EditorSession.sceneCount > 0
                         && EditorSession.activeSceneInstanceCount === 0
                width: Math.min(parent.width * 0.6, 360)

                AcIcon {
                    anchors.horizontalCenter: parent.horizontalCenter
                    source: Icons.sceneEmpty
                    size: 36
                    color: Theme.textMuted
                }
                Text {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: "Scene is empty"
                    color: Theme.textPrimary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeObjectTitle
                    font.weight: Font.DemiBold
                }
                Text {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.WordWrap
                    text: "Add an object to the scene to start editing."
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeBody
                }
                AcButton {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "+ Add Object"
                    primary: true
                    enabled: false
                    ToolTip.visible: hovered
                    ToolTip.delay: 400
                    ToolTip.text: "Add object — coming next"
                }
            }

            LogicBoardView {
                anchors.fill: parent
                visible: EditorSession.hasProject && EditorSession.activeMode === "logic"
            }

            Column {
                anchors.centerIn: parent
                spacing: Metrics.spacingSm
                visible: EditorSession.hasProject && EditorSession.activeMode === "script"

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "No scripts yet"
                    color: Theme.textPrimary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeObjectTitle
                    font.weight: Font.DemiBold
                }
                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Script Editor is next on the Qt roadmap."
                    color: Theme.textSecondary
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeBody
                }
            }
        }
    }
}

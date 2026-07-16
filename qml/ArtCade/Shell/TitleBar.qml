import QtQuick
import QtQuick.Layouts
import QtQuick.Window
import ArtCade.Ui

Rectangle {
    id: root

    required property var windowTarget

    color: Theme.titleBar
    height: Metrics.titleBarHeight

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 10
        spacing: Metrics.spacingSm

        Rectangle {
            Layout.preferredWidth: 18
            Layout.preferredHeight: 18
            radius: 3
            color: Theme.accent
            Layout.alignment: Qt.AlignVCenter

            Text {
                anchors.centerIn: parent
                text: Icons.app
                color: "#FFFFFF"
                font.family: Typography.family
                font.pixelSize: 11
                font.weight: Font.DemiBold
            }
        }

        Text {
            text: "ArtCade Studio"
            color: Theme.textPrimary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
            font.weight: Font.DemiBold
            Layout.alignment: Qt.AlignVCenter
        }

        Text {
            text: EditorSession.hasProject
                  ? ("— " + EditorSession.projectName + (EditorSession.dirty ? " *" : ""))
                  : "— No project"
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
            elide: Text.ElideRight
            Layout.fillWidth: true
            Layout.maximumWidth: 420
            Layout.alignment: Qt.AlignVCenter
        }

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            TapHandler {
                acceptedButtons: Qt.LeftButton
                gesturePolicy: TapHandler.DragThreshold
                onTapped: function(eventPoint, button) {
                    if (tapCount === 2 && root.windowTarget) {
                        if (root.windowTarget.visibility === Window.Maximized)
                            root.windowTarget.showNormal()
                        else
                            root.windowTarget.showMaximized()
                    }
                }
                onPressedChanged: {
                    if (pressed && root.windowTarget)
                        root.windowTarget.startSystemMove()
                }
            }
        }

        AcWindowButton {
            glyph: Icons.minimize
            onClicked: if (root.windowTarget) root.windowTarget.showMinimized()
        }
        AcWindowButton {
            glyph: root.windowTarget
                   && root.windowTarget.visibility === Window.Maximized
                   ? Icons.restore : Icons.maximize
            onClicked: {
                if (!root.windowTarget)
                    return
                if (root.windowTarget.visibility === Window.Maximized)
                    root.windowTarget.showNormal()
                else
                    root.windowTarget.showMaximized()
            }
        }
        AcWindowButton {
            destructive: true
            glyph: Icons.close
            onClicked: if (root.windowTarget) root.windowTarget.close()
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

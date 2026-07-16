import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

Rectangle {
    id: root

    color: Theme.panel
    property int consoleTab: 0

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.panelHeaderHeight
            color: Theme.panelRaised

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Metrics.spacingSm
                anchors.rightMargin: Metrics.spacingSm
                spacing: Metrics.spacingXs

                AcTabButton {
                    text: "Console"
                    active: root.consoleTab === 0
                    onClicked: root.consoleTab = 0
                }
                AcTabButton {
                    text: "Problems"
                    active: root.consoleTab === 1
                    onClicked: root.consoleTab = 1
                }
                AcTabButton {
                    text: "Search"
                    active: root.consoleTab === 2
                    onClicked: root.consoleTab = 2
                }

                Item { Layout.fillWidth: true }

                AcIconButton {
                    text: "Clear"
                    onClicked: logModel.clear()
                }

                Text {
                    text: "0 Err  ·  0 Warn  ·  " + logModel.count + " Info"
                    color: Theme.info
                    font.family: Typography.family
                    font.pixelSize: Typography.sizeXs
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

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: Metrics.controlHeight
            Layout.leftMargin: Metrics.spacingSm
            Layout.rightMargin: Metrics.spacingSm
            Layout.topMargin: Metrics.spacingXs
            spacing: Metrics.spacingSm

            AcTextField {
                Layout.fillWidth: true
                placeholderText: "Search logs"
            }
        }

        ListView {
            id: logView
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            visible: root.consoleTab === 0
            model: ListModel {
                id: logModel
                ListElement {
                    timestamp: "00:00:00"
                    level: "Info"
                    message: "ArtCade Studio — Qt editor, single ProjectDoc (C++)."
                }
            }

            delegate: RowLayout {
                width: logView.width
                spacing: Metrics.spacingSm
                required property string timestamp
                required property string level
                required property string message

                Text {
                    text: "[" + timestamp + "]"
                    color: Theme.textMuted
                    font.family: Typography.familyMono
                    font.pixelSize: Typography.sizeXs
                    leftPadding: Metrics.spacingMd
                }
                Text {
                    text: "[" + level + "]"
                    color: level === "Error" ? Theme.error
                         : level === "Warn" ? Theme.warning
                         : Theme.info
                    font.family: Typography.familyMono
                    font.pixelSize: Typography.sizeXs
                }
                Text {
                    text: message
                    color: Theme.textPrimary
                    font.family: Typography.familyMono
                    font.pixelSize: Typography.sizeXs
                    Layout.fillWidth: true
                    elide: Text.ElideRight
                    rightPadding: Metrics.spacingMd
                }
            }

            Connections {
                target: EditorSession
                function onStatusMessageChanged() {
                    const d = new Date()
                    const ts = Qt.formatTime(d, "hh:mm:ss")
                    logModel.append({
                        timestamp: ts,
                        level: "Info",
                        message: EditorSession.statusMessage
                    })
                    logView.positionViewAtEnd()
                }
                function onErrorOccurred(message) {
                    const d = new Date()
                    const ts = Qt.formatTime(d, "hh:mm:ss")
                    logModel.append({
                        timestamp: ts,
                        level: "Error",
                        message: message
                    })
                    logView.positionViewAtEnd()
                }
            }
        }

        Text {
            Layout.fillWidth: true
            Layout.fillHeight: true
            visible: root.consoleTab !== 0
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            text: root.consoleTab === 1 ? "No problems" : "Search — coming next"
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeSm
        }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: 1
        color: Theme.border
    }
}

import QtQuick
import ArtCade.Ui

Rectangle {
    id: root

    property var categoryIds: []
    property string selectedCategoryId: "all"
    property var catalog: null

    signal categorySelected(string categoryId)

    color: Theme.panel

    ListView {
        id: categoryList
        anchors.fill: parent
        anchors.margins: Metrics.spacingXs
        clip: true
        model: root.categoryIds

        delegate: Rectangle {
            required property string modelData
            width: categoryList.width
            height: 30
            radius: Metrics.radiusControl
            color: modelData === root.selectedCategoryId ? Theme.panelRaised : "transparent"

            Rectangle {
                anchors.left: parent.left
                anchors.top: parent.top
                anchors.bottom: parent.bottom
                width: 2
                color: Theme.accent
                visible: modelData === root.selectedCategoryId
            }

            Text {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: Metrics.spacingMd
                anchors.rightMargin: Metrics.spacingSm
                text: root.catalog ? root.catalog.categoryLabelFor(modelData) : modelData
                color: modelData === root.selectedCategoryId
                       ? Theme.textPrimary : Theme.textSecondary
                font.family: Typography.family
                font.pixelSize: Typography.sizeToolbar
                elide: Text.ElideRight
            }

            MouseArea {
                anchors.fill: parent
                onClicked: root.categorySelected(modelData)
            }
        }
    }
}

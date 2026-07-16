import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import ArtCade.Ui

/**
 * Collapsible display-section header on the Logic Board.
 * Click toggles collapse (view state — never dirties the project);
 * double-click renames inline; rename/delete route through signals to
 * EditorSession commands. Sections never affect rule execution order.
 */
Rectangle {
    id: root

    property string sectionId: ""
    property string name: ""
    property int ruleCount: 0
    property bool collapsed: false

    signal toggleRequested()
    signal renameCommitted(string newName)
    signal deleteRequested()

    property bool editing: false

    implicitHeight: 26
    radius: Metrics.radiusSmall
    color: headerMa.containsMouse ? Theme.controlHover : "transparent"

    MouseArea {
        id: headerMa
        anchors.fill: parent
        hoverEnabled: true
        enabled: !root.editing
        onClicked: root.toggleRequested()
        onDoubleClicked: {
            // The first click of the pair already toggled — toggle back.
            root.toggleRequested()
            root.editing = true
        }
    }

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Metrics.spacingSm
        anchors.rightMargin: Metrics.spacingXs
        spacing: Metrics.spacingSm

        AcIcon {
            source: Icons.chevron
            size: Metrics.iconSizeSm
            color: Theme.textSecondary
            rotation: root.collapsed ? -90 : 0
        }

        Text {
            visible: !root.editing
            Layout.maximumWidth: 320
            text: root.name.toUpperCase()
            color: Theme.textSecondary
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
            font.weight: Font.DemiBold
            font.letterSpacing: 0.8
            elide: Text.ElideRight
        }

        AcTextField {
            id: nameField
            visible: root.editing
            Layout.preferredWidth: 200
            font.pixelSize: Typography.sizeXs

            function commit() {
                if (!root.editing)
                    return
                root.editing = false
                if (text.trim().length > 0 && text.trim() !== root.name)
                    root.renameCommitted(text)
            }

            onVisibleChanged: {
                if (visible) {
                    text = root.name
                    forceActiveFocus()
                    selectAll()
                }
            }
            onAccepted: commit()
            onEditingFinished: commit()
            Keys.onEscapePressed: root.editing = false
        }

        Text {
            text: root.ruleCount === 1 ? "1 rule" : root.ruleCount + " rules"
            color: Theme.textMuted
            font.family: Typography.family
            font.pixelSize: Typography.sizeXs
        }

        Item { Layout.fillWidth: true }

        AcToolButton {
            iconSource: Icons.close
            implicitWidth: 20
            implicitHeight: 20
            visible: headerMa.containsMouse || hovered
            enabled: !EditorSession.playing
            ToolTip.visible: hovered
            ToolTip.delay: 400
            ToolTip.text: "Remove section — its rules are kept (undoable)"
            onClicked: root.deleteRequested()
        }
    }
}

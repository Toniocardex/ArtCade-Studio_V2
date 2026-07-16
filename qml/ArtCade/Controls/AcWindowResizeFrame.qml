import QtQuick
import QtQuick.Window
import ArtCade.Ui

/**
 * Native frameless resize grips via Window.startSystemResize (Qt 6.8+).
 * Presentation only — does not touch ProjectDoc.
 * Disabled while the window is maximized.
 */
Item {
    id: root

    required property var windowTarget
    property int grip: 6

    readonly property bool canResize: windowTarget
                                      && windowTarget.visibility !== Window.Maximized
                                      && windowTarget.visibility !== Window.FullScreen

    function beginResize(edges) {
        if (!canResize || !windowTarget)
            return
        windowTarget.startSystemResize(edges)
    }

    // Edges — top edge stops short of window controls (title-bar buttons).
    MouseArea {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: root.grip
        enabled: root.canResize
        cursorShape: Qt.SizeHorCursor
        onPressed: root.beginResize(Qt.LeftEdge)
    }
    MouseArea {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.topMargin: Metrics.titleBarHeight
        anchors.bottom: parent.bottom
        width: root.grip
        enabled: root.canResize
        cursorShape: Qt.SizeHorCursor
        onPressed: root.beginResize(Qt.RightEdge)
    }
    MouseArea {
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.rightMargin: 120
        height: root.grip
        enabled: root.canResize
        cursorShape: Qt.SizeVerCursor
        onPressed: root.beginResize(Qt.TopEdge)
    }
    MouseArea {
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        height: root.grip
        enabled: root.canResize
        cursorShape: Qt.SizeVerCursor
        onPressed: root.beginResize(Qt.BottomEdge)
    }

    // Corners — no top-right corner (would cover Close / Maximize).
    MouseArea {
        anchors.left: parent.left
        anchors.top: parent.top
        width: root.grip * 2
        height: root.grip * 2
        enabled: root.canResize
        cursorShape: Qt.SizeFDiagCursor
        z: 1
        onPressed: root.beginResize(Qt.LeftEdge | Qt.TopEdge)
    }
    MouseArea {
        anchors.left: parent.left
        anchors.bottom: parent.bottom
        width: root.grip * 2
        height: root.grip * 2
        enabled: root.canResize
        cursorShape: Qt.SizeBDiagCursor
        z: 1
        onPressed: root.beginResize(Qt.LeftEdge | Qt.BottomEdge)
    }
    MouseArea {
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        width: root.grip * 2
        height: root.grip * 2
        enabled: root.canResize
        cursorShape: Qt.SizeFDiagCursor
        z: 1
        onPressed: root.beginResize(Qt.RightEdge | Qt.BottomEdge)
    }
}

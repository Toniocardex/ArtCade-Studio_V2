import QtQuick
import QtQuick.Effects
import ArtCade.Ui

/**
 * Monochrome SVG icon tinted with @p color (Theme tokens).
 * Source URLs come from Icons.* (qrc assets).
 */
Item {
    id: root

    property url source
    property color color: Theme.textSecondary
    property int size: Metrics.iconSize

    implicitWidth: size
    implicitHeight: size
    width: size
    height: size

    Image {
        id: sourceImage
        anchors.fill: parent
        source: root.source
        sourceSize.width: root.size * 2
        sourceSize.height: root.size * 2
        fillMode: Image.PreserveAspectFit
        visible: false
        asynchronous: true
        smooth: true
    }

    MultiEffect {
        anchors.fill: parent
        source: sourceImage
        colorization: 1.0
        colorizationColor: root.color
        brightness: 0.0
        contrast: 0.0
        visible: root.source.toString().length > 0 && sourceImage.status === Image.Ready
    }
}

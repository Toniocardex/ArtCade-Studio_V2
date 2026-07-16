import QtQuick
import QtQuick.Controls
import ArtCade.Ui

/**
 * Themed popup menu (flat zinc). Use AcMenuItem for explicit rows;
 * the delegate covers submenu title rows.
 */
Menu {
    id: root

    padding: 4

    delegate: AcMenuItem {}

    background: Rectangle {
        implicitWidth: 190
        color: Theme.panelRaised
        border.color: Theme.border
        border.width: 1
        radius: Metrics.radiusSmall
    }
}

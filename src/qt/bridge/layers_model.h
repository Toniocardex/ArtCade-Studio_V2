/**
 * Render-layer rows derived from EditorCoordinator::document().layers.
 * Visibility comes from the active scene's layerSettings.
 * Not a second ProjectDoc — reload after open / layer commands.
 */
#pragma once

#include <QAbstractListModel>
#include <QByteArray>
#include <QHash>
#include <QtQml/qqmlregistration.h>
#include <vector>

namespace ArtCade::EditorCore {
class EditorCoordinator;
}

class LayersModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

public:
    enum Roles {
        DisplayRole = Qt::DisplayRole,
        LayerIdRole = Qt::UserRole + 1,
        VisibleRole,
        LockedRole,
        ActiveRole,
    };

    explicit LayersModel(QObject *parent = nullptr);

    void setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator);
    Q_INVOKABLE void reload();

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

private:
    struct Row {
        QString layerId;
        QString display;
        bool visible = true;
        bool locked = false;
        bool active = false;
    };

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    std::vector<Row> m_rows;
};

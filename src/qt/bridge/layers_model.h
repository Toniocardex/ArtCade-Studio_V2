/**
 * Render-layer rows derived from the active scene's SceneDef.layers.
 * Eye visibility is workspace-only (hiddenLayerIds); lock comes from SceneLayerDef.
 * Not a second ProjectDoc — reload after open / scene change / Command / workspace hide.
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
        IsDefaultRole,
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
        bool isDefault = false;
    };

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    std::vector<Row> m_rows;
};

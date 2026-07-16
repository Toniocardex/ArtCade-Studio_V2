#include "bridge/layers_model.h"

#include "artcade/editor_core/editor_core.h"

LayersModel::LayersModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

void LayersModel::setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator)
{
    m_coordinator = coordinator;
    reload();
}

void LayersModel::reload()
{
    beginResetModel();
    m_rows.clear();
    if (m_coordinator && m_coordinator->hasProject()) {
        const ArtCade::ProjectDoc &doc = m_coordinator->document();
        const QString active_id = QString::fromStdString(m_coordinator->activeLayerId());
        for (const ArtCade::SceneLayerDef &layer : doc.layers) {
            Row row;
            row.layerId = QString::fromStdString(layer.id);
            row.display = layer.name.empty()
                ? row.layerId
                : QString::fromStdString(layer.name);
            row.visible = m_coordinator->layerVisible(layer.id);
            row.locked = layer.locked;
            row.active = row.layerId == active_id;
            m_rows.push_back(row);
        }
    }
    endResetModel();
}

int LayersModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return static_cast<int>(m_rows.size());
}

QVariant LayersModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0
        || index.row() >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &row = m_rows[static_cast<size_t>(index.row())];
    switch (role) {
    case DisplayRole:
        return row.display;
    case LayerIdRole:
        return row.layerId;
    case VisibleRole:
        return row.visible;
    case LockedRole:
        return row.locked;
    case ActiveRole:
        return row.active;
    default:
        return {};
    }
}

QHash<int, QByteArray> LayersModel::roleNames() const
{
    return {
        {Qt::DisplayRole, "display"},
        {LayerIdRole, "layerId"},
        {VisibleRole, "layerVisible"},
        {LockedRole, "locked"},
        {ActiveRole, "active"},
    };
}

/**
 * Render-layer rows derived from the active scene's SceneDef.layers.
 * Not a second ProjectDoc — reload after open / scene change / Command.
 */
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
        const ArtCade::SceneDef *scene = m_coordinator->activeScene();
        if (scene) {
            const QString active_id = QString::fromStdString(m_coordinator->activeLayerId());
            const QString default_id = QString::fromStdString(scene->defaultLayerId);
            for (const ArtCade::SceneLayerDef &layer : scene->layers) {
                Row row;
                row.layerId = QString::fromStdString(layer.id);
                row.display = layer.name.empty()
                    ? row.layerId
                    : QString::fromStdString(layer.name);
                row.visible = !m_coordinator->layerHiddenInEditor(layer.id);
                row.playVisible = m_coordinator->layerVisible(layer.id);
                row.locked = layer.locked;
                row.active = row.layerId == active_id;
                row.isDefault = row.layerId == default_id;
                m_rows.push_back(row);
            }
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
    case PlayVisibleRole:
        return row.playVisible;
    case LockedRole:
        return row.locked;
    case ActiveRole:
        return row.active;
    case IsDefaultRole:
        return row.isDefault;
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
        {PlayVisibleRole, "playVisible"},
        {LockedRole, "locked"},
        {ActiveRole, "active"},
        {IsDefaultRole, "isDefault"},
    };
}

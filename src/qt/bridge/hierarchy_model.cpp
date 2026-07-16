#include "bridge/hierarchy_model.h"

#include "artcade/editor_core/editor_core.h"

HierarchyModel::HierarchyModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

void HierarchyModel::setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator)
{
    m_coordinator = coordinator;
    reload();
}

void HierarchyModel::reload()
{
    beginResetModel();
    m_rows.clear();
    if (m_coordinator && m_coordinator->hasProject()) {
        const ArtCade::ProjectDoc &doc = m_coordinator->document();
        for (const auto &[scene_id, scene] : doc.scenes) {
            Row scene_row;
            scene_row.kind = QStringLiteral("scene");
            scene_row.display =
                QString::fromStdString(scene.name.empty() ? scene_id : scene.name);
            m_rows.push_back(scene_row);

            for (const ArtCade::SceneInstanceDef &inst : scene.instances) {
                Row child;
                child.kind = QStringLiteral("instance");
                child.entityId = inst.id;
                child.display = inst.instanceName.empty()
                    ? QString::fromStdString(inst.objectTypeId)
                    : QString::fromStdString(inst.instanceName);
                m_rows.push_back(child);
            }
        }
    }
    endResetModel();
}

int HierarchyModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return static_cast<int>(m_rows.size());
}

QVariant HierarchyModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0
        || index.row() >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &row = m_rows[static_cast<size_t>(index.row())];
    switch (role) {
    case DisplayRole:
        return row.display;
    case NodeKindRole:
        return row.kind;
    case StableIdRole:
        return row.entityId;
    default:
        return {};
    }
}

QHash<int, QByteArray> HierarchyModel::roleNames() const
{
    return {
        {Qt::DisplayRole, "display"},
        {NodeKindRole, "nodeKind"},
        {StableIdRole, "stableId"},
    };
}

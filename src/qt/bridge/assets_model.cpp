#include "bridge/assets_model.h"

#include "artcade/editor_core/editor_core.h"

AssetsModel::AssetsModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

void AssetsModel::setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator)
{
    m_coordinator = coordinator;
    reload();
}

void AssetsModel::reload()
{
    beginResetModel();
    m_rows.clear();
    if (m_coordinator && m_coordinator->hasProject()) {
        const ArtCade::ProjectDoc &doc = m_coordinator->document();
        for (const ArtCade::ImageAssetDef &asset : doc.imageAssets) {
            Row row;
            row.assetId = QString::fromStdString(asset.assetId);
            row.display = asset.name.empty()
                ? row.assetId
                : QString::fromStdString(asset.name);
            row.sourcePath = QString::fromStdString(asset.sourcePath);
            row.kind = QStringLiteral("image");
            m_rows.push_back(row);
        }
    }
    endResetModel();
}

int AssetsModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return static_cast<int>(m_rows.size());
}

QVariant AssetsModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0
        || index.row() >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &row = m_rows[static_cast<size_t>(index.row())];
    switch (role) {
    case DisplayRole:
        return row.display;
    case AssetIdRole:
        return row.assetId;
    case SourcePathRole:
        return row.sourcePath;
    case KindRole:
        return row.kind;
    default:
        return {};
    }
}

QHash<int, QByteArray> AssetsModel::roleNames() const
{
    return {
        {Qt::DisplayRole, "display"},
        {AssetIdRole, "assetId"},
        {SourcePathRole, "sourcePath"},
        {KindRole, "kind"},
    };
}

bool AssetsModel::lookup(const QString &assetId,
                         QString *displayOut,
                         QString *kindOut,
                         QString *sourcePathOut) const
{
    if (assetId.isEmpty()) {
        return false;
    }
    for (const Row &row : m_rows) {
        if (row.assetId != assetId) {
            continue;
        }
        if (displayOut) {
            *displayOut = row.display;
        }
        if (kindOut) {
            *kindOut = row.kind;
        }
        if (sourcePathOut) {
            *sourcePathOut = row.sourcePath;
        }
        return true;
    }
    return false;
}

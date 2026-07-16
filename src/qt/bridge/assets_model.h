/**
 * Read-only image asset rows from EditorCoordinator::document().imageAssets.
 * Listing only — import/delete come later via commands.
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

class AssetsModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

public:
    enum Roles {
        DisplayRole = Qt::DisplayRole,
        AssetIdRole = Qt::UserRole + 1,
        SourcePathRole,
        KindRole,
    };

    explicit AssetsModel(QObject *parent = nullptr);

    void setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator);
    Q_INVOKABLE void reload();

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

private:
    struct Row {
        QString assetId;
        QString display;
        QString sourcePath;
        QString kind;
    };

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    std::vector<Row> m_rows;
};

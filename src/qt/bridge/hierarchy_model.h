/**
 * Flat hierarchy rows derived from EditorCoordinator::document().
 * Not a second ProjectDoc — reload after open/rename only.
 */
#pragma once

#include <QAbstractListModel>
#include <QHash>
#include <QByteArray>
#include <QtQml/qqmlregistration.h>
#include <vector>

namespace ArtCade::EditorCore {
class EditorCoordinator;
}

class HierarchyModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

public:
    enum Roles {
        DisplayRole = Qt::DisplayRole,
        NodeKindRole = Qt::UserRole + 1,
        StableIdRole,
    };

    explicit HierarchyModel(QObject *parent = nullptr);

    void setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator);
    Q_INVOKABLE void reload();

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

private:
    struct Row {
        QString kind; // "scene" | "instance"
        QString display;
        quint32 entityId = 0;
    };

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    std::vector<Row> m_rows;
};

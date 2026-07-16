/**
 * Hierarchical scene → instance rows derived from EditorCoordinator::document().
 * Not a second ProjectDoc — reload after open/rename only.
 */
#pragma once

#include <QAbstractItemModel>
#include <QByteArray>
#include <QHash>
#include <QModelIndex>
#include <QtQml/qqmlregistration.h>
#include <memory>
#include <vector>

namespace ArtCade::EditorCore {
class EditorCoordinator;
}

class HierarchyModel : public QAbstractItemModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

public:
    enum Roles {
        DisplayRole = Qt::DisplayRole,
        NodeKindRole = Qt::UserRole + 1,
        StableIdRole,
        DepthHintRole,
    };

    explicit HierarchyModel(QObject *parent = nullptr);
    ~HierarchyModel() override;

    void setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator);
    Q_INVOKABLE void reload();

    QModelIndex index(int row, int column, const QModelIndex &parent = QModelIndex()) const override;
    QModelIndex parent(const QModelIndex &index) const override;
    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    int columnCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

private:
    struct Node {
        QString kind; // "scene" | "instance"
        QString display;
        quint32 entityId = 0;
        Node *parent = nullptr;
        std::vector<std::unique_ptr<Node>> children;
    };

    [[nodiscard]] Node *nodeFromIndex(const QModelIndex &index) const;

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    std::unique_ptr<Node> m_root;
};

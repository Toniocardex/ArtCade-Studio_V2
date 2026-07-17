/**
 * Projection of ProjectDoc.globalVariables — not an autonomous store.
 * Reload after Command / DomainChange only (no polling).
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

class VariablesModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

public:
    enum Roles {
        KeyRole = Qt::UserRole + 1,
        TypeRole,
        TypeLabelRole,
        InitialValueRole,
        DescriptionRole,
    };

    /** Creates an empty ProjectDoc-derived model owned by @p parent. */
    explicit VariablesModel(QObject *parent = nullptr);

    /** Assigns the sole ProjectDoc authority and refreshes this derived projection. */
    void setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator);
    /** Rebuilds rows from the current ProjectDoc; never mutates authoring data. */
    Q_INVOKABLE void reload();

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

private:
    struct Row {
        QString key;
        QString typeId;
        QString typeLabel;
        QString initialValue;
        QString description;
    };

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    std::vector<Row> m_rows;
};

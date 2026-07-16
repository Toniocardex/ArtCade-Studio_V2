/**
 * Read-only Logic block catalog rows from ArtCade::Logic::registry().
 * Filtered by kind; availability derived from object-type EntityDef.
 */
#pragma once

#include <QAbstractListModel>
#include <QByteArray>
#include <QHash>
#include <QString>
#include <QStringList>
#include <QVariantMap>
#include <QtGlobal>
#include <QtQml/qqmlregistration.h>
#include <vector>

namespace ArtCade::EditorCore {
class EditorCoordinator;
}

class LogicCatalogModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

    Q_PROPERTY(QString kind READ kind WRITE setKind NOTIFY filterChanged)
    Q_PROPERTY(QString contextObjectTypeId READ contextObjectTypeId
                   WRITE setContextObjectTypeId NOTIFY filterChanged)
    Q_PROPERTY(QString triggerTypeId READ triggerTypeId WRITE setTriggerTypeId
                   NOTIFY filterChanged)
    Q_PROPERTY(QStringList categoryIds READ categoryIds NOTIFY filterChanged)
    Q_PROPERTY(quint64 revision READ revision NOTIFY filterChanged)

public:
    enum Roles {
        TypeIdRole = Qt::UserRole + 1,
        KindRole,
        CategoryIdRole,
        CategoryLabelRole,
        DisplayNameRole,
        DescriptionRole,
        AvailableRole,
        UnavailableReasonRole,
        RequiredComponentsRole,
        RequiredComponentIdsRole,
        MissingComponentIdsRole,
        RequiredContextRole,
        PropertyKeysRole,
        PropertySummaryRole,
        SearchSynonymsRole,
    };

    explicit LogicCatalogModel(QObject *parent = nullptr);

    void setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator);

    [[nodiscard]] QString kind() const;
    void setKind(const QString &kind);
    [[nodiscard]] QString contextObjectTypeId() const;
    void setContextObjectTypeId(const QString &objectTypeId);
    [[nodiscard]] QString triggerTypeId() const;
    void setTriggerTypeId(const QString &typeId);
    /** Returns the categories represented by the current rows, beginning with All. */
    [[nodiscard]] QStringList categoryIds() const;
    /** Monotonically advances whenever reload replaces the catalog rows. */
    [[nodiscard]] quint64 revision() const;

    /** Rebuild rows for the current kind/context filters. */
    Q_INVOKABLE void reload();
    /** Snapshot of row @p row as a QVariantMap for QML filtering (role-name keys). */
    [[nodiscard]] Q_INVOKABLE QVariantMap entryMap(int row) const;
    /** Returns the localized presentation label for @p categoryId. */
    [[nodiscard]] Q_INVOKABLE QString categoryLabelFor(const QString &categoryId) const;

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

signals:
    void filterChanged();

private:
    struct Row {
        QString typeId;
        QString kind;
        QString categoryId;
        QString categoryLabel;
        QString displayName;
        QString description;
        bool available = true;
        QString unavailableReason;
        QStringList requiredComponents;
        QStringList requiredComponentIds;
        QStringList missingComponentIds;
        QStringList requiredContext;
        QStringList propertyKeys;
        QString propertySummary;
        QStringList searchSynonyms;
        int catalogOrder = 0;
    };

    ArtCade::EditorCore::EditorCoordinator *m_coordinator = nullptr;
    QString m_kind{QStringLiteral("action")};
    QString m_contextObjectTypeId;
    QString m_triggerTypeId;
    std::vector<Row> m_rows;
    QStringList m_categoryIds;
    quint64 m_revision = 0;
};

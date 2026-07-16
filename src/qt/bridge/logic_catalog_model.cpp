#include "bridge/logic_catalog_model.h"
#include "bridge/logic_catalog_metadata.h"

#include "artcade/editor_core/editor_core.h"
#include "logic-core.h"

#include <QVariant>
#include <QVariantMap>

LogicCatalogModel::LogicCatalogModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

void LogicCatalogModel::setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator)
{
    m_coordinator = coordinator;
    reload();
}

QString LogicCatalogModel::kind() const
{
    return m_kind;
}

void LogicCatalogModel::setKind(const QString &kind)
{
    QString normalized = kind.toLower();
    if (normalized != QLatin1String("trigger") && normalized != QLatin1String("condition")
        && normalized != QLatin1String("action")) {
        normalized = QStringLiteral("action");
    }
    if (m_kind == normalized) {
        return;
    }
    m_kind = normalized;
    reload();
}

QString LogicCatalogModel::contextObjectTypeId() const
{
    return m_contextObjectTypeId;
}

void LogicCatalogModel::setContextObjectTypeId(const QString &objectTypeId)
{
    if (m_contextObjectTypeId == objectTypeId) {
        return;
    }
    m_contextObjectTypeId = objectTypeId;
    reload();
}

QString LogicCatalogModel::triggerTypeId() const
{
    return m_triggerTypeId;
}

void LogicCatalogModel::setTriggerTypeId(const QString &typeId)
{
    if (m_triggerTypeId == typeId) {
        return;
    }
    m_triggerTypeId = typeId;
    reload();
}

QStringList LogicCatalogModel::categoryIds() const
{
    return m_categoryIds;
}

quint64 LogicCatalogModel::revision() const
{
    return m_revision;
}

void LogicCatalogModel::reload()
{
    beginResetModel();
    m_rows.clear();
    m_categoryIds.clear();

    const ArtCade::Logic::BlockKind want = ArtCade::QtBridge::logic_catalog_parse_kind(m_kind);
    const ArtCade::Logic::LogicBlockDescriptor *trigger_desc = nullptr;
    if (!m_triggerTypeId.isEmpty()) {
        trigger_desc = ArtCade::Logic::findDescriptor(m_triggerTypeId.toStdString());
    }

    const ArtCade::EntityDef *owner = nullptr;
    if (m_coordinator && m_coordinator->hasProject() && !m_contextObjectTypeId.isEmpty()) {
        const auto &types = m_coordinator->document().objectTypes;
        const auto it = types.find(m_contextObjectTypeId.toStdString());
        if (it != types.end()) {
            owner = &it->second;
        }
    }

    QStringList seen_categories;
    for (const ArtCade::Logic::LogicBlockDescriptor &desc : ArtCade::Logic::registry()) {
        if (desc.kind != want) {
            continue;
        }
        Row row;
        row.typeId = QString::fromStdString(desc.typeId);
        row.kind = m_kind;
        row.categoryId = QString::fromStdString(desc.categoryId);
        row.categoryLabel = ArtCade::QtBridge::logic_catalog_category_label(row.categoryId);
        row.displayName = QString::fromStdString(desc.displayName);
        row.description = QString::fromStdString(desc.description);
        for (const auto component : desc.requiredComponents) {
            row.requiredComponents.append(ArtCade::QtBridge::logic_catalog_component_label(component));
        }
        for (const auto capability : desc.requiredContext) {
            row.requiredContext.append(ArtCade::QtBridge::logic_catalog_capability_label(capability));
        }
        QStringList prop_labels;
        for (const auto &property : desc.properties) {
            const QString key = QString::fromStdString(property.key);
            row.propertyKeys.append(key);
            prop_labels.append(key);
        }
        row.propertySummary = prop_labels.join(QStringLiteral(", "));

        if (owner) {
            const ArtCade::Logic::LogicBlockAvailability availability =
                ArtCade::Logic::blockAvailability(*owner, desc, trigger_desc);
            row.available = availability.compatible;
            row.unavailableReason = QString::fromStdString(availability.reason);
        } else {
            row.available = true;
        }

        if (!seen_categories.contains(row.categoryId)) {
            seen_categories.append(row.categoryId);
        }
        m_rows.push_back(std::move(row));
    }

    m_categoryIds.append(QStringLiteral("all"));
    const QStringList preferred = ArtCade::QtBridge::logic_catalog_preferred_category_order(m_kind);
    for (const QString &id : preferred) {
        if (seen_categories.contains(id) && !m_categoryIds.contains(id)) {
            m_categoryIds.append(id);
        }
    }
    for (const QString &id : seen_categories) {
        if (!m_categoryIds.contains(id)) {
            m_categoryIds.append(id);
        }
    }

    endResetModel();
    ++m_revision;
    emit filterChanged();
}

int LogicCatalogModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return static_cast<int>(m_rows.size());
}

QVariant LogicCatalogModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0
        || index.row() >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &row = m_rows[static_cast<size_t>(index.row())];
    switch (role) {
    case TypeIdRole:
        return row.typeId;
    case KindRole:
        return row.kind;
    case CategoryIdRole:
        return row.categoryId;
    case CategoryLabelRole:
        return row.categoryLabel;
    case DisplayNameRole:
        return row.displayName;
    case DescriptionRole:
        return row.description;
    case AvailableRole:
        return row.available;
    case UnavailableReasonRole:
        return row.unavailableReason;
    case RequiredComponentsRole:
        return row.requiredComponents;
    case RequiredContextRole:
        return row.requiredContext;
    case PropertyKeysRole:
        return row.propertyKeys;
    case PropertySummaryRole:
        return row.propertySummary;
    default:
        return {};
    }
}

QHash<int, QByteArray> LogicCatalogModel::roleNames() const
{
    return {
        {TypeIdRole, "typeId"},
        {KindRole, "kind"},
        {CategoryIdRole, "categoryId"},
        {CategoryLabelRole, "categoryLabel"},
        {DisplayNameRole, "displayName"},
        {DescriptionRole, "description"},
        {AvailableRole, "available"},
        {UnavailableReasonRole, "unavailableReason"},
        {RequiredComponentsRole, "requiredComponents"},
        {RequiredContextRole, "requiredContext"},
        {PropertyKeysRole, "propertyKeys"},
        {PropertySummaryRole, "propertySummary"},
    };
}

QVariantMap LogicCatalogModel::entryMap(int row) const
{
    if (row < 0 || row >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &entry = m_rows[static_cast<size_t>(row)];
    return {
        {QStringLiteral("typeId"), entry.typeId},
        {QStringLiteral("kind"), entry.kind},
        {QStringLiteral("categoryId"), entry.categoryId},
        {QStringLiteral("categoryLabel"), entry.categoryLabel},
        {QStringLiteral("displayName"), entry.displayName},
        {QStringLiteral("description"), entry.description},
        {QStringLiteral("available"), entry.available},
        {QStringLiteral("unavailableReason"), entry.unavailableReason},
        {QStringLiteral("requiredComponents"), entry.requiredComponents},
        {QStringLiteral("requiredContext"), entry.requiredContext},
        {QStringLiteral("propertyKeys"), entry.propertyKeys},
        {QStringLiteral("propertySummary"), entry.propertySummary},
    };
}

QString LogicCatalogModel::categoryLabelFor(const QString &categoryId) const
{
    if (categoryId == QLatin1String("all")) {
        return QStringLiteral("All");
    }
    for (const Row &entry : m_rows) {
        if (entry.categoryId == categoryId) {
            return entry.categoryLabel;
        }
    }
    return ArtCade::QtBridge::logic_catalog_category_label(categoryId);
}

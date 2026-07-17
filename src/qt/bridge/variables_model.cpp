#include "bridge/variables_model.h"

#include "artcade/editor_core/editor_core.h"

#include <sstream>
#include <variant>

VariablesModel::VariablesModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

void VariablesModel::setCoordinator(ArtCade::EditorCore::EditorCoordinator *coordinator)
{
    m_coordinator = coordinator;
    reload();
}

void VariablesModel::reload()
{
    beginResetModel();
    m_rows.clear();
    if (!m_coordinator || !m_coordinator->hasProject()) {
        endResetModel();
        return;
    }
    for (const ArtCade::GameVariableDefinition &def :
         m_coordinator->document().globalVariables) {
        Row row;
        row.key = QString::fromStdString(def.key);
        switch (def.type) {
        case ArtCade::GameVariableDefinition::Type::Number:
            row.typeId = QStringLiteral("number");
            row.typeLabel = QStringLiteral("Number");
            break;
        case ArtCade::GameVariableDefinition::Type::Boolean:
            row.typeId = QStringLiteral("boolean");
            row.typeLabel = QStringLiteral("Boolean");
            break;
        case ArtCade::GameVariableDefinition::Type::String:
            row.typeId = QStringLiteral("string");
            row.typeLabel = QStringLiteral("String");
            break;
        }
        if (const auto *number = std::get_if<double>(&def.initialValue)) {
            std::ostringstream oss;
            oss << *number;
            row.initialValue = QString::fromStdString(oss.str());
        } else if (const auto *boolean = std::get_if<bool>(&def.initialValue)) {
            row.initialValue = *boolean ? QStringLiteral("true") : QStringLiteral("false");
        } else if (const auto *string = std::get_if<std::string>(&def.initialValue)) {
            row.initialValue = QString::fromStdString(*string);
        }
        row.description = QString::fromStdString(def.description);
        m_rows.push_back(std::move(row));
    }
    endResetModel();
}

int VariablesModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) return 0;
    return static_cast<int>(m_rows.size());
}

QVariant VariablesModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0
        || index.row() >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &row = m_rows[static_cast<std::size_t>(index.row())];
    switch (role) {
    case KeyRole:
        return row.key;
    case TypeRole:
        return row.typeId;
    case TypeLabelRole:
        return row.typeLabel;
    case InitialValueRole:
        return row.initialValue;
    case DescriptionRole:
        return row.description;
    default:
        return {};
    }
}

QHash<int, QByteArray> VariablesModel::roleNames() const
{
    return {
        {KeyRole, "key"},
        {TypeRole, "typeId"},
        {TypeLabelRole, "typeLabel"},
        {InitialValueRole, "initialValue"},
        {DescriptionRole, "description"},
    };
}

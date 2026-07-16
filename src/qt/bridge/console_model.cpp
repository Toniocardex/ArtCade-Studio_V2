#include "bridge/console_model.h"

#include <QDateTime>

ConsoleModel::ConsoleModel(QObject *parent)
    : QAbstractListModel(parent)
{
    appendInfo(QStringLiteral("ArtCade Studio — Qt editor, single ProjectDoc (C++)."));
}

int ConsoleModel::infoCount() const
{
    return m_info;
}

int ConsoleModel::warnCount() const
{
    return m_warn;
}

int ConsoleModel::errorCount() const
{
    return m_error;
}

void ConsoleModel::clear()
{
    beginResetModel();
    m_rows.clear();
    m_info = 0;
    m_warn = 0;
    m_error = 0;
    endResetModel();
    emit countsChanged();
}

void ConsoleModel::appendInfo(const QString &message)
{
    appendRow(Info, message);
}

void ConsoleModel::appendWarn(const QString &message)
{
    appendRow(Warn, message);
}

void ConsoleModel::appendError(const QString &message)
{
    appendRow(Error, message);
}

void ConsoleModel::appendRow(Level level, const QString &message)
{
    const int row = static_cast<int>(m_rows.size());
    beginInsertRows(QModelIndex(), row, row);
    Row entry;
    entry.timestamp = QDateTime::currentDateTime().toString(QStringLiteral("hh:mm:ss"));
    entry.level = level;
    entry.message = message;
    m_rows.push_back(entry);
    endInsertRows();

    switch (level) {
    case Info:
        ++m_info;
        break;
    case Warn:
        ++m_warn;
        break;
    case Error:
        ++m_error;
        break;
    }
    emit countsChanged();
}

int ConsoleModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) {
        return 0;
    }
    return static_cast<int>(m_rows.size());
}

QVariant ConsoleModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0
        || index.row() >= static_cast<int>(m_rows.size())) {
        return {};
    }
    const Row &row = m_rows[static_cast<size_t>(index.row())];
    switch (role) {
    case TimestampRole:
        return row.timestamp;
    case LevelRole:
        return static_cast<int>(row.level);
    case LevelLabelRole:
        switch (row.level) {
        case Warn:
            return QStringLiteral("Warn");
        case Error:
            return QStringLiteral("Error");
        case Info:
        default:
            return QStringLiteral("Info");
        }
    case MessageRole:
        return row.message;
    default:
        return {};
    }
}

QHash<int, QByteArray> ConsoleModel::roleNames() const
{
    return {
        {TimestampRole, "timestamp"},
        {LevelRole, "level"},
        {LevelLabelRole, "levelLabel"},
        {MessageRole, "message"},
    };
}

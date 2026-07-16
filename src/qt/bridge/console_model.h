/**
 * Append-only console log model for the editor shell.
 * Presentation buffer only — never writes ProjectDoc.
 */
#pragma once

#include <QAbstractListModel>
#include <QByteArray>
#include <QHash>
#include <QString>
#include <QtQml/qqmlregistration.h>
#include <vector>

class ConsoleModel : public QAbstractListModel
{
    Q_OBJECT
    QML_ELEMENT
    QML_UNCREATABLE("Owned by EditorSession")

    Q_PROPERTY(int infoCount READ infoCount NOTIFY countsChanged)
    Q_PROPERTY(int warnCount READ warnCount NOTIFY countsChanged)
    Q_PROPERTY(int errorCount READ errorCount NOTIFY countsChanged)

public:
    enum Level { Info = 0, Warn = 1, Error = 2 };
    Q_ENUM(Level)

    enum Roles {
        TimestampRole = Qt::UserRole + 1,
        LevelRole,
        LevelLabelRole,
        MessageRole,
    };

    explicit ConsoleModel(QObject *parent = nullptr);

    [[nodiscard]] int infoCount() const;
    [[nodiscard]] int warnCount() const;
    [[nodiscard]] int errorCount() const;

    Q_INVOKABLE void clear();
    Q_INVOKABLE void appendInfo(const QString &message);
    Q_INVOKABLE void appendWarn(const QString &message);
    Q_INVOKABLE void appendError(const QString &message);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

signals:
    void countsChanged();

private:
    struct Row {
        QString timestamp;
        Level level = Info;
        QString message;
    };

    void appendRow(Level level, const QString &message);

    std::vector<Row> m_rows;
    int m_info = 0;
    int m_warn = 0;
    int m_error = 0;
};

#include "editor_session.h"

#include "artcade/editor_core/editor_core.h"

#include <cstdint>
#include <string>

bool EditorSession::addGameVariable(const QString &key, const QString &typeId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->addGameVariable(key.toStdString(), typeId.toStdString(), error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    refreshSelectionCache();
    emit dirtyChanged();
    emit projectChanged();
    setStatus(QStringLiteral("Variable added"));
    return true;
}

bool EditorSession::removeGameVariable(const QString &key)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->removeGameVariable(key.toStdString(), error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    refreshSelectionCache();
    emit dirtyChanged();
    emit projectChanged();
    setStatus(QStringLiteral("Variable removed"));
    return true;
}

bool EditorSession::setGameVariableType(const QString &key, const QString &typeId)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->setGameVariableType(key.toStdString(), typeId.toStdString(), error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    refreshSelectionCache();
    emit dirtyChanged();
    emit projectChanged();
    setStatus(QStringLiteral("Variable type updated"));
    return true;
}

bool EditorSession::setGameVariableInitialNumber(const QString &key, double value)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->setGameVariableInitialNumber(key.toStdString(), value, error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    emit dirtyChanged();
    setStatus(QStringLiteral("Initial value updated"));
    return true;
}

bool EditorSession::setGameVariableInitialBoolean(const QString &key, bool value)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->setGameVariableInitialBoolean(key.toStdString(), value, error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    emit dirtyChanged();
    setStatus(QStringLiteral("Initial value updated"));
    return true;
}

bool EditorSession::setGameVariableInitialString(const QString &key, const QString &value)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->setGameVariableInitialString(
            key.toStdString(), value.toStdString(), error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    emit dirtyChanged();
    setStatus(QStringLiteral("Initial value updated"));
    return true;
}

bool EditorSession::setGameVariableDescription(const QString &key, const QString &description)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return false;
    }
    std::string error;
    const std::uint64_t revision_before = m_coordinator->revision();
    if (!m_coordinator->setGameVariableDescription(
            key.toStdString(), description.toStdString(), error)) {
        setStatus(QString::fromStdString(error), false);
        emit errorOccurred(QString::fromStdString(error));
        return false;
    }
    if (m_coordinator->revision() == revision_before) return true;
    m_variables->reload();
    emit dirtyChanged();
    setStatus(QStringLiteral("Description updated"));
    return true;
}

int EditorSession::gameVariableLogicReferenceCount(const QString &key) const
{
    if (!m_coordinator->hasProject()) return 0;
    return static_cast<int>(m_coordinator->logicReferenceCount(key.toStdString()));
}

QString EditorSession::suggestNextGameVariableKey() const
{
    if (!m_coordinator->hasProject()) return QStringLiteral("variable1");
    const auto &variables = m_coordinator->document().globalVariables;
    for (int number = 1; number < 10000; ++number) {
        const std::string candidate = "variable" + std::to_string(number);
        bool used = false;
        for (const auto &definition : variables) {
            if (definition.key == candidate) {
                used = true;
                break;
            }
        }
        if (!used) return QString::fromStdString(candidate);
    }
    return QStringLiteral("variable");
}

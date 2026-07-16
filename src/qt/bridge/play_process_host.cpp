#include "bridge/play_process_host.h"

#include <QFileInfo>
#include <QProcess>

PlayProcessHost::PlayProcessHost(QObject *parent)
    : QObject(parent)
{
}

PlayProcessHost::~PlayProcessHost()
{
    stop();
}

bool PlayProcessHost::isRunning() const
{
    return m_process && m_process->state() != QProcess::NotRunning;
}

bool PlayProcessHost::start(const QString &game_exe,
                            const QString &project_directory,
                            QString &error_message)
{
    if (isRunning()) {
        error_message = QStringLiteral("Play is already running");
        return false;
    }

    const QFileInfo exe_info(game_exe);
    if (!exe_info.exists() || !exe_info.isFile()) {
        error_message = QStringLiteral("game.exe not found: %1").arg(game_exe);
        return false;
    }

    const QFileInfo dir_info(project_directory);
    if (!dir_info.exists() || !dir_info.isDir()) {
        error_message = QStringLiteral("Project directory not found: %1").arg(project_directory);
        return false;
    }

    const QString project_json = dir_info.absoluteFilePath() + QStringLiteral("/project.json");
    if (!QFileInfo::exists(project_json)) {
        error_message = QStringLiteral("project.json missing in %1").arg(project_directory);
        return false;
    }

    m_process.reset();
    m_process = std::make_unique<QProcess>(this);
    connect(m_process.get(),
            QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this,
            [this](int exit_code, QProcess::ExitStatus status) {
                onProcessFinished(exit_code, static_cast<int>(status));
            });
    connect(m_process.get(),
            &QProcess::errorOccurred,
            this,
            [this](QProcess::ProcessError error) { onProcessError(static_cast<int>(error)); });

    m_process->setProgram(exe_info.absoluteFilePath());
    m_process->setArguments({dir_info.absoluteFilePath()});
    m_process->setWorkingDirectory(exe_info.absolutePath());
    m_process->start();

    if (!m_process->waitForStarted(5000)) {
        error_message = QStringLiteral("Failed to start game.exe: %1")
                            .arg(m_process->errorString());
        m_process.reset();
        return false;
    }

    emit started();
    return true;
}

void PlayProcessHost::stop()
{
    if (!m_process) {
        return;
    }
    if (m_process->state() != QProcess::NotRunning) {
        m_process->terminate();
        if (!m_process->waitForFinished(2000)) {
            m_process->kill();
            m_process->waitForFinished(2000);
        }
    }
    // finished handler may have already run; never destroy QProcess from inside that slot.
    m_process.reset();
}

void PlayProcessHost::onProcessFinished(int exit_code, int exit_status)
{
    Q_UNUSED(exit_status);
    emit stopped(exit_code, QStringLiteral("Play finished (exit %1)").arg(exit_code));
}

void PlayProcessHost::onProcessError(int error)
{
    if (error == QProcess::FailedToStart) {
        return;
    }
}

/**
 * Launches the native Raylib runtime (game.exe) as a separate OS process.
 *
 * Guardrails:
 * - Does not touch ProjectDoc / EditorCoordinator revision.
 * - Play reads on-disk project directory only (caller must save first).
 * - No Raylib embedding in the Qt window; Qt owns authoring UI only.
 */
#pragma once

#include <QObject>
#include <QString>
#include <memory>

class QProcess;

class PlayProcessHost : public QObject
{
    Q_OBJECT

public:
    explicit PlayProcessHost(QObject *parent = nullptr);
    ~PlayProcessHost() override;

    /**
     * Starts @p game_exe with @p project_directory as argv[1] (AssetLoader directory root).
     * @returns false and sets @p error_message on failure (already running, missing paths, spawn error)
     */
    bool start(const QString &game_exe,
               const QString &project_directory,
               QString &error_message);

    /** Terminates the play process if running (kill if needed). */
    void stop();

    [[nodiscard]] bool isRunning() const;

signals:
    void started();
    void stopped(int exit_code, QString status_message);

private:
    void onProcessFinished(int exit_code, int exit_status);
    void onProcessError(int error);

    std::unique_ptr<QProcess> m_process;
};

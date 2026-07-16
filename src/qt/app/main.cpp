#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QUrl>

/**
 * artcade-editor-qt entry — Qt owns the main window and event loop.
 * Raylib must not share this window (see docs/qt-migration/).
 */
int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName(QStringLiteral("ArtCade Studio"));
    QGuiApplication::setOrganizationName(QStringLiteral("ArtCade"));
    QGuiApplication::setApplicationVersion(QStringLiteral("2.0.0-qt-shell"));

    // ArtCadeStyle overrides shared controls (ToolTip, ScrollBar); Basic
    // backs everything else — the Ac* controls own the visual look.
    QQuickStyle::setStyle(QStringLiteral("ArtCadeStyle"));
    QQuickStyle::setFallbackStyle(QStringLiteral("Basic"));

    QQmlApplicationEngine engine;
    const QUrl url(QStringLiteral("qrc:/qt/qml/ArtCade/Ui/Main.qml"));

    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);

    engine.load(url);
    if (engine.rootObjects().isEmpty()) {
        return -1;
    }

    // Frameless QML windows often ignore visibility: Maximized at construct time.
    if (auto *win = qobject_cast<QQuickWindow *>(engine.rootObjects().constFirst())) {
        win->showMaximized();
    }

    return app.exec();
}

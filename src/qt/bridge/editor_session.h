/**
 * Qt adapter over ArtCade::EditorCore::EditorCoordinator.
 * QML sends IDs/intents only — no ProjectDocument copy in QML.
 */
#pragma once

#include "bridge/assets_model.h"
#include "bridge/console_model.h"
#include "bridge/hierarchy_model.h"
#include "bridge/layers_model.h"

#include <QObject>
#include <QString>
#include <QtQml/qqmlregistration.h>
#include <memory>

class QJSEngine;
class QPainter;
class QQmlEngine;
class SceneViewItem;
class PlayProcessHost;

namespace ArtCade::EditorCore {
class EditorCoordinator;
}

class EditorSession : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    Q_PROPERTY(QString projectName READ projectName NOTIFY projectNameChanged)
    Q_PROPERTY(bool dirty READ isDirty NOTIFY dirtyChanged)
    Q_PROPERTY(bool playing READ isPlaying NOTIFY playingChanged)
    Q_PROPERTY(QString activeMode READ activeMode WRITE setActiveMode NOTIFY activeModeChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusMessageChanged)
    Q_PROPERTY(HierarchyModel *hierarchyModel READ hierarchyModel CONSTANT)
    Q_PROPERTY(LayersModel *layersModel READ layersModel CONSTANT)
    Q_PROPERTY(AssetsModel *assetsModel READ assetsModel CONSTANT)
    Q_PROPERTY(ConsoleModel *consoleModel READ consoleModel CONSTANT)
    Q_PROPERTY(bool hasProject READ hasProject NOTIFY hasProjectChanged)
    Q_PROPERTY(quint32 selectedEntityId READ selectedEntityId NOTIFY selectionChanged)
    Q_PROPERTY(QString selectedName READ selectedName NOTIFY selectionChanged)
    Q_PROPERTY(double selectedX READ selectedX NOTIFY selectionChanged)
    Q_PROPERTY(double selectedY READ selectedY NOTIFY selectionChanged)
    Q_PROPERTY(bool hasSelection READ hasSelection NOTIFY selectionChanged)
    Q_PROPERTY(QString activeLayerId READ activeLayerId NOTIFY activeLayerChanged)
    Q_PROPERTY(QString activeSceneName READ activeSceneName NOTIFY projectChanged)
    Q_PROPERTY(double activeSceneWidth READ activeSceneWidth NOTIFY projectChanged)
    Q_PROPERTY(double activeSceneHeight READ activeSceneHeight NOTIFY projectChanged)
    Q_PROPERTY(double worldGravity READ worldGravity NOTIFY projectChanged)
    Q_PROPERTY(double worldPixelsPerMeter READ worldPixelsPerMeter NOTIFY projectChanged)
    /** Workspace: scene interaction tool — select | pan | move | rect (does not dirty). */
    Q_PROPERTY(QString activeTool READ activeTool WRITE setActiveTool NOTIFY activeToolChanged)
    /** Workspace: snap Move commits to scene grid (does not dirty). */
    Q_PROPERTY(bool snapEnabled READ snapEnabled WRITE setSnapEnabled NOTIFY snapEnabledChanged)

public:
    explicit EditorSession(QObject *parent = nullptr);
    ~EditorSession() override;

    static EditorSession *create(QQmlEngine *engine, QJSEngine *scriptEngine);

    [[nodiscard]] QString projectName() const;
    [[nodiscard]] bool isDirty() const;
    [[nodiscard]] bool isPlaying() const;
    [[nodiscard]] QString activeMode() const;
    [[nodiscard]] QString statusMessage() const;
    [[nodiscard]] HierarchyModel *hierarchyModel() const;
    [[nodiscard]] LayersModel *layersModel() const;
    [[nodiscard]] AssetsModel *assetsModel() const;
    [[nodiscard]] ConsoleModel *consoleModel() const;
    [[nodiscard]] bool hasProject() const;
    [[nodiscard]] quint32 selectedEntityId() const;
    [[nodiscard]] QString selectedName() const;
    [[nodiscard]] double selectedX() const;
    [[nodiscard]] double selectedY() const;
    [[nodiscard]] bool hasSelection() const;
    [[nodiscard]] QString activeLayerId() const;
    [[nodiscard]] QString activeSceneName() const;
    [[nodiscard]] double activeSceneWidth() const;
    [[nodiscard]] double activeSceneHeight() const;
    [[nodiscard]] double worldGravity() const;
    [[nodiscard]] double worldPixelsPerMeter() const;
    [[nodiscard]] QString activeTool() const;
    [[nodiscard]] bool snapEnabled() const;

    void setActiveMode(const QString &mode);
    void setActiveTool(const QString &tool);
    void setSnapEnabled(bool enabled);

    Q_INVOKABLE void openProject(const QString &pathOrUrl);
    /** Opens the W2 slice fixture (formatVersion 5). No-ops with status if missing. */
    Q_INVOKABLE void openSliceFixture();
    [[nodiscard]] Q_INVOKABLE QString sliceFixturePath() const;
    /**
     * Returns true if the window may close now.
     * If dirty, emits closeBlockedByDirty so QML can show Save/Discard/Cancel.
     */
    Q_INVOKABLE bool requestClose();
    Q_INVOKABLE void discardAndClose();
    Q_INVOKABLE void undo();
    Q_INVOKABLE void redo();
    Q_INVOKABLE void saveProject();
    Q_INVOKABLE void selectEntity(quint32 entityId);
    Q_INVOKABLE void clearSelection();
    Q_INVOKABLE void commitRename(const QString &newName);
    Q_INVOKABLE void commitPosition(double x, double y);
    Q_INVOKABLE void setActiveLayer(const QString &layerId);
    Q_INVOKABLE void setLayerVisible(const QString &layerId, bool visible);
    Q_INVOKABLE quint32 pickEntityAt(double worldX, double worldY);
    /**
     * Selects the topmost instance whose placeholder AABB intersects the world rect.
     * Clears selection when none hit. Workspace-only (no dirty).
     */
    Q_INVOKABLE void selectInWorldRect(double x0, double y0, double x1, double y1);
    /** Grid step used for snap + scene grid paint (matches placeholder extent). */
    [[nodiscard]] Q_INVOKABLE double sceneGridStep() const;
    Q_INVOKABLE void startPlay();
    Q_INVOKABLE void stopPlay();

    /** Paints active-scene placeholders into @p view (called from SceneViewItem::paint). */
    void paintSceneView(QPainter *painter, const SceneViewItem *view) const;
    /** Fits @p view pan/zoom to the active scene world size. */
    void fitSceneView(SceneViewItem *view) const;

signals:
    void projectNameChanged();
    void dirtyChanged();
    void playingChanged();
    void activeModeChanged();
    void statusMessageChanged();
    void hasProjectChanged();
    void selectionChanged();
    void activeLayerChanged();
    void projectChanged();
    void activeToolChanged();
    void snapEnabledChanged();
    void errorOccurred(const QString &message);
    void closeBlockedByDirty();
    void closeAccepted();

private:
    void setStatus(const QString &message, bool logToConsole = true);
    [[nodiscard]] bool guardAuthoring(QString *errorOut = nullptr) const;
    void emitProjectSignals();
    void refreshSelectionCache();
    void reloadDerivedModels();
    void onPlayProcessStopped(int exit_code, const QString &status_message);
    [[nodiscard]] QString normalizePath(const QString &pathOrUrl) const;
    [[nodiscard]] QString resolveGameExecutable() const;
    [[nodiscard]] QString projectDirectory() const;

    std::unique_ptr<ArtCade::EditorCore::EditorCoordinator> m_coordinator;
    HierarchyModel *m_hierarchy = nullptr;
    LayersModel *m_layers = nullptr;
    AssetsModel *m_assets = nullptr;
    ConsoleModel *m_console = nullptr;
    PlayProcessHost *m_play = nullptr;
    QString m_activeMode;
    QString m_statusMessage;
    bool m_playing = false;
    QString m_activeTool{QStringLiteral("select")};
    bool m_snap_enabled = false;
    QString m_selectedName;
    double m_selectedX = 0.0;
    double m_selectedY = 0.0;
};

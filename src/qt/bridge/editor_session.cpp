#include "bridge/editor_session.h"

#include "bridge/play_process_host.h"
#include "bridge/scene_view_item.h"

#include "artcade/editor_core/editor_core.h"

#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QJSEngine>
#include <QFont>
#include <QPainter>
#include <QPen>
#include <QQmlEngine>
#include <QUrl>
#include <QtGlobal>
#include <cmath>

#ifndef ARTCADE_QT_SLICE_FIXTURE_PATH
#define ARTCADE_QT_SLICE_FIXTURE_PATH ""
#endif

namespace {

QColor instance_fill(quint32 entity_id, bool selected)
{
    if (selected) {
        return QColor(79, 142, 232, 200);
    }
    const int hue = static_cast<int>((entity_id * 47u) % 360u);
    return QColor::fromHsv(hue, 110, 170, 150);
}

} // namespace

EditorSession::EditorSession(QObject *parent)
    : QObject(parent)
    , m_coordinator(std::make_unique<ArtCade::EditorCore::EditorCoordinator>())
    , m_hierarchy(new HierarchyModel(this))
    , m_layers(new LayersModel(this))
    , m_assets(new AssetsModel(this))
    , m_console(new ConsoleModel(this))
    , m_play(new PlayProcessHost(this))
    , m_activeMode(QStringLiteral("canvas"))
    , m_statusMessage(QStringLiteral("Open formatVersion 5 project.json, or use Fixture"))
{
    m_hierarchy->setCoordinator(m_coordinator.get());
    m_layers->setCoordinator(m_coordinator.get());
    m_assets->setCoordinator(m_coordinator.get());
    connect(m_play, &PlayProcessHost::stopped, this, &EditorSession::onPlayProcessStopped);
}

EditorSession::~EditorSession() = default;

EditorSession *EditorSession::create(QQmlEngine *engine, QJSEngine *scriptEngine)
{
    Q_UNUSED(engine);
    Q_UNUSED(scriptEngine);
    return new EditorSession;
}

QString EditorSession::projectName() const
{
    if (!m_coordinator->hasProject()) {
        return QStringLiteral("No project");
    }
    return QString::fromStdString(m_coordinator->document().projectName);
}

bool EditorSession::isDirty() const
{
    return m_coordinator->isDirty();
}

bool EditorSession::isPlaying() const
{
    return m_playing;
}

QString EditorSession::activeMode() const
{
    return m_activeMode;
}

QString EditorSession::statusMessage() const
{
    return m_statusMessage;
}

HierarchyModel *EditorSession::hierarchyModel() const
{
    return m_hierarchy;
}

LayersModel *EditorSession::layersModel() const
{
    return m_layers;
}

AssetsModel *EditorSession::assetsModel() const
{
    return m_assets;
}

ConsoleModel *EditorSession::consoleModel() const
{
    return m_console;
}

bool EditorSession::hasProject() const
{
    return m_coordinator->hasProject();
}

quint32 EditorSession::selectedEntityId() const
{
    return m_coordinator->selectedEntityId();
}

QString EditorSession::selectedName() const
{
    return m_selectedName;
}

double EditorSession::selectedX() const
{
    return m_selectedX;
}

double EditorSession::selectedY() const
{
    return m_selectedY;
}

bool EditorSession::hasSelection() const
{
    return m_coordinator->selectedEntityId() != 0;
}

QString EditorSession::activeLayerId() const
{
    return QString::fromStdString(m_coordinator->activeLayerId());
}

namespace {

const ArtCade::SceneDef *session_active_scene(const ArtCade::EditorCore::EditorCoordinator &coord)
{
    if (!coord.hasProject()) {
        return nullptr;
    }
    const ArtCade::ProjectDoc &doc = coord.document();
    auto it = doc.scenes.find(doc.activeSceneId);
    if (it != doc.scenes.end()) {
        return &it->second;
    }
    if (!doc.scenes.empty()) {
        return &doc.scenes.begin()->second;
    }
    return nullptr;
}

} // namespace

QString EditorSession::activeSceneName() const
{
    const ArtCade::SceneDef *scene = session_active_scene(*m_coordinator);
    if (!scene) {
        return {};
    }
    return QString::fromStdString(scene->name.empty() ? scene->id : scene->name);
}

double EditorSession::activeSceneWidth() const
{
    const ArtCade::SceneDef *scene = session_active_scene(*m_coordinator);
    return scene ? scene->worldSize.x : 0.0;
}

double EditorSession::activeSceneHeight() const
{
    const ArtCade::SceneDef *scene = session_active_scene(*m_coordinator);
    return scene ? scene->worldSize.y : 0.0;
}

double EditorSession::worldGravity() const
{
    if (!m_coordinator->hasProject()) {
        return 0.0;
    }
    return m_coordinator->document().world.gravity;
}

double EditorSession::worldPixelsPerMeter() const
{
    if (!m_coordinator->hasProject()) {
        return 0.0;
    }
    return m_coordinator->document().world.pixelsPerMeter;
}

void EditorSession::setActiveMode(const QString &mode)
{
    if (m_activeMode == mode) {
        return;
    }
    m_activeMode = mode;
    emit activeModeChanged();
}

QString EditorSession::activeTool() const
{
    return m_activeTool;
}

void EditorSession::setActiveTool(const QString &tool)
{
    QString normalized = tool;
    if (normalized != QLatin1String("select") && normalized != QLatin1String("pan")
        && normalized != QLatin1String("move") && normalized != QLatin1String("rect")) {
        normalized = QStringLiteral("select");
    }
    if (m_activeTool == normalized) {
        return;
    }
    m_activeTool = normalized;
    emit activeToolChanged();
}

bool EditorSession::snapEnabled() const
{
    return m_snap_enabled;
}

void EditorSession::setSnapEnabled(bool enabled)
{
    if (m_snap_enabled == enabled) {
        return;
    }
    m_snap_enabled = enabled;
    emit snapEnabledChanged();
}

double EditorSession::sceneGridStep() const
{
    return static_cast<double>(ArtCade::EditorCore::EditorCoordinator::kSceneViewPlaceholderExtent);
}

QString EditorSession::normalizePath(const QString &pathOrUrl) const
{
    const QUrl url(pathOrUrl);
    if (url.isLocalFile()) {
        return url.toLocalFile();
    }
    return pathOrUrl;
}

void EditorSession::setStatus(const QString &message, bool logToConsole)
{
    if (m_statusMessage != message) {
        m_statusMessage = message;
        emit statusMessageChanged();
    }
    if (logToConsole && m_console) {
        m_console->appendInfo(message);
    }
}

bool EditorSession::guardAuthoring(QString *errorOut) const
{
    if (m_playing || (m_play && m_play->isRunning())) {
        if (errorOut) {
            *errorOut = QStringLiteral("Stop Play before editing");
        }
        return false;
    }
    return true;
}

void EditorSession::emitProjectSignals()
{
    emit projectNameChanged();
    emit dirtyChanged();
    emit hasProjectChanged();
    emit activeLayerChanged();
    emit projectChanged();
}

void EditorSession::reloadDerivedModels()
{
    m_hierarchy->reload();
    m_layers->reload();
    m_assets->reload();
}

void EditorSession::refreshSelectionCache()
{
    m_selectedName.clear();
    m_selectedX = 0.0;
    m_selectedY = 0.0;
    const auto id = m_coordinator->selectedEntityId();
    if (id != 0) {
        if (const auto *inst =
                ArtCade::EditorCore::project_doc_find_instance(m_coordinator->document(), id)) {
            m_selectedName = QString::fromStdString(inst->instanceName);
            m_selectedX = inst->transform.position.x;
            m_selectedY = inst->transform.position.y;
        }
    }
    emit selectionChanged();
}

QString EditorSession::sliceFixturePath() const
{
    return QString::fromUtf8(ARTCADE_QT_SLICE_FIXTURE_PATH);
}

void EditorSession::openSliceFixture()
{
    const QString path = sliceFixturePath();
    if (path.isEmpty() || !QFileInfo::exists(path)) {
        const QString msg =
            QStringLiteral("Slice fixture not found. Rebuild with ARTCADE_QT_SLICE_FIXTURE_PATH.");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    openProject(path);
}

bool EditorSession::requestClose()
{
    stopPlay();
    if (!m_coordinator->isDirty()) {
        emit closeAccepted();
        return true;
    }
    emit closeBlockedByDirty();
    return false;
}

void EditorSession::discardAndClose()
{
    if (m_coordinator->hasProject() && !m_coordinator->projectPath().empty()) {
        std::string error;
        const std::string path = m_coordinator->projectPath();
        if (m_coordinator->openProject(path, error)) {
            reloadDerivedModels();
            refreshSelectionCache();
            emitProjectSignals();
        }
    }
    emit closeAccepted();
}

void EditorSession::openProject(const QString &pathOrUrl)
{
    stopPlay();
    const QString path = normalizePath(pathOrUrl);
    std::string error;
    if (!m_coordinator->openProject(path.toStdString(), error)) {
        const QString msg = QString::fromStdString(error);
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    reloadDerivedModels();
    refreshSelectionCache();
    emitProjectSignals();
    setStatus(QStringLiteral("Opened %1").arg(path));
}

void EditorSession::undo()
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (!m_coordinator->canUndo()) {
        setStatus(QStringLiteral("Nothing to undo"));
        return;
    }
    m_coordinator->undo();
    reloadDerivedModels();
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Undo"));
}

void EditorSession::redo()
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (!m_coordinator->canRedo()) {
        setStatus(QStringLiteral("Nothing to redo"));
        return;
    }
    m_coordinator->redo();
    reloadDerivedModels();
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Redo"));
}

void EditorSession::saveProject()
{
    std::string error;
    if (!m_coordinator->saveProject(error)) {
        const QString msg = QString::fromStdString(error);
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    emit dirtyChanged();
    setStatus(QStringLiteral("Saved"));
}

void EditorSession::selectEntity(quint32 entityId)
{
    m_coordinator->selectEntity(entityId);
    refreshSelectionCache();
}

void EditorSession::clearSelection()
{
    m_coordinator->clearSelection();
    refreshSelectionCache();
}

void EditorSession::commitRename(const QString &newName)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (newName == m_selectedName) {
        return;
    }
    std::string error;
    if (!m_coordinator->renameSelected(newName.toStdString(), error)) {
        setStatus(QString::fromStdString(error));
        return;
    }
    m_hierarchy->reload();
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Renamed"));
}

void EditorSession::commitPosition(double x, double y)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    if (qFuzzyCompare(static_cast<float>(x), static_cast<float>(m_selectedX))
        && qFuzzyCompare(static_cast<float>(y), static_cast<float>(m_selectedY))) {
        return;
    }
    std::string error;
    if (!m_coordinator->setSelectedPosition(static_cast<float>(x), static_cast<float>(y), error)) {
        setStatus(QString::fromStdString(error));
        return;
    }
    refreshSelectionCache();
    emit dirtyChanged();
    setStatus(QStringLiteral("Position updated"));
}

void EditorSession::setActiveLayer(const QString &layerId)
{
    const std::string id = layerId.toStdString();
    if (m_coordinator->activeLayerId() == id) {
        return;
    }
    m_coordinator->setActiveLayerId(id);
    m_layers->reload();
    emit activeLayerChanged();
    setStatus(QStringLiteral("Active layer: %1").arg(layerId));
}

void EditorSession::setLayerVisible(const QString &layerId, bool visible)
{
    QString guard_error;
    if (!guardAuthoring(&guard_error)) {
        setStatus(guard_error, false);
        emit errorOccurred(guard_error);
        return;
    }
    std::string error;
    if (!m_coordinator->setLayerVisible(layerId.toStdString(), visible, error)) {
        setStatus(QString::fromStdString(error));
        return;
    }
    m_layers->reload();
    emit dirtyChanged();
    setStatus(visible ? QStringLiteral("Layer shown") : QStringLiteral("Layer hidden"));
}

quint32 EditorSession::pickEntityAt(double worldX, double worldY)
{
    return m_coordinator->pickEntityAt(static_cast<float>(worldX), static_cast<float>(worldY));
}

void EditorSession::selectInWorldRect(double x0, double y0, double x1, double y1)
{
    const auto id = m_coordinator->pickEntityInRect(static_cast<float>(x0),
                                                    static_cast<float>(y0),
                                                    static_cast<float>(x1),
                                                    static_cast<float>(y1));
    if (id == 0) {
        clearSelection();
        return;
    }
    selectEntity(id);
}

void EditorSession::fitSceneView(SceneViewItem *view) const
{
    if (!view || !m_coordinator->hasProject()) {
        return;
    }
    const ArtCade::ProjectDoc &doc = m_coordinator->document();
    auto it = doc.scenes.find(doc.activeSceneId);
    if (it == doc.scenes.end()) {
        if (doc.scenes.empty()) {
            view->resetView();
            return;
        }
        it = doc.scenes.begin();
    }
    view->applyFit(it->second.worldSize.x, it->second.worldSize.y);
}

void EditorSession::paintSceneView(QPainter *painter, const SceneViewItem *view) const
{
    if (!painter || !view || !m_coordinator->hasProject()) {
        return;
    }

    const ArtCade::ProjectDoc &doc = m_coordinator->document();
    auto it = doc.scenes.find(doc.activeSceneId);
    if (it == doc.scenes.end()) {
        if (doc.scenes.empty()) {
            return;
        }
        it = doc.scenes.begin();
    }
    const ArtCade::SceneDef &scene = it->second;

    const qreal ruler = view->rulerSize();
    if (ruler > 0.0) {
        painter->fillRect(QRectF(0, 0, view->width(), ruler), QColor(0x13, 0x19, 0x22));
        painter->fillRect(QRectF(0, 0, ruler, view->height()), QColor(0x13, 0x19, 0x22));
        painter->fillRect(QRectF(0, 0, ruler, ruler), QColor(0x11, 0x16, 0x1e));
        painter->setPen(QPen(QColor(0x29, 0x32, 0x40), 1));
        painter->drawLine(QPointF(ruler, 0), QPointF(ruler, view->height()));
        painter->drawLine(QPointF(0, ruler), QPointF(view->width(), ruler));

        painter->setPen(QColor(0x68, 0x74, 0x86));
        painter->setFont(QFont(QStringLiteral("Consolas"), 8));
        const qreal world_left = view->screenToWorld(QPointF(ruler, ruler)).x();
        const qreal world_top = view->screenToWorld(QPointF(ruler, ruler)).y();
        const qreal world_right = view->screenToWorld(QPointF(view->width(), ruler)).x();
        const qreal world_bottom = view->screenToWorld(QPointF(ruler, view->height())).y();
        const qreal step = 32.0;
        const qreal start_x = std::floor(world_left / step) * step;
        for (qreal wx = start_x; wx <= world_right; wx += step) {
            const qreal sx = view->worldToScreen(QPointF(wx, 0)).x();
            if (sx < ruler) {
                continue;
            }
            painter->drawLine(QPointF(sx, ruler - 4), QPointF(sx, ruler));
            if (std::fmod(std::abs(wx), 128.0) < 0.01) {
                painter->drawText(QPointF(sx + 2, ruler - 6), QString::number(static_cast<int>(wx)));
            }
        }
        const qreal start_y = std::floor(world_top / step) * step;
        for (qreal wy = start_y; wy <= world_bottom; wy += step) {
            const qreal sy = view->worldToScreen(QPointF(0, wy)).y();
            if (sy < ruler) {
                continue;
            }
            painter->drawLine(QPointF(ruler - 4, sy), QPointF(ruler, sy));
            if (std::fmod(std::abs(wy), 128.0) < 0.01) {
                painter->drawText(QPointF(2, sy - 2), QString::number(static_cast<int>(wy)));
            }
        }
    }

    const QRectF world_rect(0.0, 0.0, scene.worldSize.x, scene.worldSize.y);
    const QPointF tl = view->worldToScreen(world_rect.topLeft());
    const QPointF br = view->worldToScreen(world_rect.bottomRight());
    const QRectF screen_world(tl, br);

    QColor bg(static_cast<int>(scene.backgroundColor.r * 255.f),
              static_cast<int>(scene.backgroundColor.g * 255.f),
              static_cast<int>(scene.backgroundColor.b * 255.f),
              255);
    painter->fillRect(screen_world, bg);
    painter->setPen(QPen(QColor(0x29, 0x2d, 0x35), 1));
    painter->drawRect(screen_world);

    if (view->gridVisible()) {
        painter->setPen(QPen(QColor(0x1e, 0x22, 0x29), 1));
        const float step = 32.f;
        for (float x = 0.f; x <= scene.worldSize.x + 0.01f; x += step) {
            const QPointF a = view->worldToScreen(QPointF(x, 0.0));
            const QPointF b = view->worldToScreen(QPointF(x, scene.worldSize.y));
            painter->drawLine(a, b);
        }
        for (float y = 0.f; y <= scene.worldSize.y + 0.01f; y += step) {
            const QPointF a = view->worldToScreen(QPointF(0.0, y));
            const QPointF b = view->worldToScreen(QPointF(scene.worldSize.x, y));
            painter->drawLine(a, b);
        }
    }

    const quint32 selected = m_coordinator->selectedEntityId();
    const float extent = ArtCade::EditorCore::EditorCoordinator::kSceneViewPlaceholderExtent;

    for (const ArtCade::SceneInstanceDef &inst : scene.instances) {
        if (!inst.visible) {
            continue;
        }
        if (!inst.layerId.empty() && !m_coordinator->layerVisible(inst.layerId)) {
            continue;
        }

        QPointF pos(inst.transform.position.x, inst.transform.position.y);
        if (view->hasDragPreview() && view->dragEntityId() == inst.id) {
            pos = view->dragPreviewWorld();
        }

        const qreal w = extent * inst.transform.scale.x * view->zoom();
        const qreal h = extent * inst.transform.scale.y * view->zoom();
        const QPointF screen = view->worldToScreen(pos);
        const QRectF box(screen.x(), screen.y(), w, h);

        const bool is_selected = inst.id == selected;
        painter->fillRect(box, instance_fill(inst.id, is_selected));
        painter->setPen(QPen(is_selected ? QColor(0x4f, 0x8e, 0xe8) : QColor(0xd9, 0xdd, 0xe5),
                             is_selected ? 2 : 1));
        painter->drawRect(box);

        const QString label = inst.instanceName.empty()
            ? QString::fromStdString(inst.objectTypeId)
            : QString::fromStdString(inst.instanceName);
        painter->setPen(QColor(0xd9, 0xdd, 0xe5));
        painter->drawText(box.adjusted(4, 2, -2, -2), Qt::AlignLeft | Qt::AlignTop, label);
    }
}

void EditorSession::startPlay()
{
    if (m_playing || m_play->isRunning()) {
        setStatus(QStringLiteral("Play is already running"));
        return;
    }
    if (!m_coordinator->hasProject()) {
        const QString msg = QStringLiteral("Open a project before Play");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }
    // Play reads on-disk files only — never a live ProjectDoc mutation path.
    if (m_coordinator->isDirty()) {
        const QString msg = QStringLiteral("Save the project before Play");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }

    const QString game_exe = resolveGameExecutable();
    if (game_exe.isEmpty()) {
        const QString msg = QStringLiteral(
            "game.exe not found. Build target `game`, or set ARTCADE_GAME_EXE.");
        setStatus(msg, false);
        emit errorOccurred(msg);
        return;
    }

    const QString project_dir = projectDirectory();
    QString error;
    if (!m_play->start(game_exe, project_dir, error)) {
        setStatus(error, false);
        emit errorOccurred(error);
        return;
    }

    m_playing = true;
    emit playingChanged();
    setStatus(QStringLiteral("Play — %1").arg(QFileInfo(game_exe).fileName()));
}

void EditorSession::stopPlay()
{
    if (!m_playing && !m_play->isRunning()) {
        return;
    }
    m_play->stop();
    if (m_playing) {
        m_playing = false;
        emit playingChanged();
        setStatus(QStringLiteral("Play stopped"));
    }
}

void EditorSession::onPlayProcessStopped(int exit_code, const QString &status_message)
{
    Q_UNUSED(exit_code);
    if (m_playing) {
        m_playing = false;
        emit playingChanged();
    }
    setStatus(status_message);
}

QString EditorSession::projectDirectory() const
{
    if (!m_coordinator->hasProject()) {
        return {};
    }
    return QFileInfo(QString::fromStdString(m_coordinator->projectPath())).absolutePath();
}

QString EditorSession::resolveGameExecutable() const
{
    const QByteArray env = qgetenv("ARTCADE_GAME_EXE");
    if (!env.isEmpty()) {
        const QString from_env = QString::fromLocal8Bit(env);
        if (QFileInfo::exists(from_env)) {
            return QFileInfo(from_env).absoluteFilePath();
        }
    }

    const QDir app_dir(QCoreApplication::applicationDirPath());
    const QString sibling = app_dir.filePath(QStringLiteral("game.exe"));
    if (QFileInfo::exists(sibling)) {
        return QFileInfo(sibling).absoluteFilePath();
    }

    return {};
}

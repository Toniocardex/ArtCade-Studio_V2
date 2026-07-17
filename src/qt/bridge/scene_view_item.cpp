#include "bridge/scene_view_item.h"

#include "bridge/editor_session.h"

#include <QPainter>
#include <QPen>
#include <QString>
#include <algorithm>
#include <cmath>

namespace {

constexpr qreal kMinZoom = 0.15;
constexpr qreal kMaxZoom = 8.0;

} // namespace

SceneViewItem::SceneViewItem(QQuickItem *parent)
    : QQuickPaintedItem(parent)
{
    setAcceptedMouseButtons(Qt::LeftButton | Qt::MiddleButton | Qt::RightButton);
    setAcceptHoverEvents(true);
    setOpaquePainting(true);
    setAntialiasing(true);
    setFlag(ItemIsFocusScope, true);
    setActiveFocusOnTab(true);
}

EditorSession *SceneViewItem::session() const
{
    return m_session;
}

void SceneViewItem::setSession(EditorSession *session)
{
    if (m_session == session) {
        return;
    }
    cancelActiveGesture();
    if (m_session) {
        disconnect(m_session, nullptr, this, nullptr);
    }
    m_session = session;
    bindSessionSignals();
    emit sessionChanged();
    update();
}

void SceneViewItem::bindSessionSignals()
{
    if (!m_session) {
        return;
    }
    connect(m_session, &EditorSession::projectChanged, this, &SceneViewItem::onSessionDocumentChanged);
    connect(m_session, &EditorSession::selectionChanged, this, [this]() { update(); });
    connect(m_session, &EditorSession::dirtyChanged, this, [this]() { update(); });
    connect(m_session, &EditorSession::activeLayerChanged, this, [this]() { update(); });
    connect(m_session, &EditorSession::activeToolChanged, this, [this]() {
        updateHoverCursor(m_last_screen);
        update();
    });
    connect(m_session, &EditorSession::snapEnabledChanged, this, [this]() { update(); });
}

void SceneViewItem::onSessionDocumentChanged()
{
    cancelActiveGesture();
    fitActiveScene();
    update();
}

QString SceneViewItem::activeTool() const
{
    return m_session ? m_session->activeTool() : QStringLiteral("select");
}

QPointF SceneViewItem::snapWorld(const QPointF &world) const
{
    if (!m_session || !m_session->snapEnabled()) {
        return world;
    }
    const qreal step = m_session->sceneGridStep();
    if (step <= 0.0) {
        return world;
    }
    return QPointF(std::round(world.x() / step) * step,
                   std::round(world.y() / step) * step);
}

qreal SceneViewItem::panX() const
{
    return m_pan_x;
}

void SceneViewItem::setPanX(qreal value)
{
    if (qFuzzyCompare(m_pan_x, value)) {
        return;
    }
    m_pan_x = value;
    emit viewChanged();
    update();
}

qreal SceneViewItem::panY() const
{
    return m_pan_y;
}

void SceneViewItem::setPanY(qreal value)
{
    if (qFuzzyCompare(m_pan_y, value)) {
        return;
    }
    m_pan_y = value;
    emit viewChanged();
    update();
}

qreal SceneViewItem::zoom() const
{
    return m_zoom;
}

void SceneViewItem::setZoom(qreal value)
{
    const qreal clamped = std::clamp(value, kMinZoom, kMaxZoom);
    if (qFuzzyCompare(m_zoom, clamped)) {
        return;
    }
    m_zoom = clamped;
    emit viewChanged();
    update();
}

bool SceneViewItem::gridVisible() const
{
    return m_grid_visible;
}

void SceneViewItem::setGridVisible(bool visible)
{
    if (m_grid_visible == visible) {
        return;
    }
    m_grid_visible = visible;
    emit viewChanged();
    update();
}

bool SceneViewItem::rulersVisible() const
{
    return m_rulers_visible;
}

void SceneViewItem::setRulersVisible(bool visible)
{
    if (m_rulers_visible == visible) {
        return;
    }
    m_rulers_visible = visible;
    emit viewChanged();
    update();
}

qreal SceneViewItem::rulerSize() const
{
    return m_rulers_visible ? 22.0 : 0.0;
}

void SceneViewItem::resetView()
{
    m_pan_x = 0.0;
    m_pan_y = 0.0;
    m_zoom = 1.0;
    emit viewChanged();
    update();
}

void SceneViewItem::applyFit(qreal world_w, qreal world_h)
{
    if (world_w <= 0.0 || world_h <= 0.0 || width() <= 1.0 || height() <= 1.0) {
        resetView();
        return;
    }
    const qreal pad = 24.0;
    const qreal r = rulerSize();
    const qreal avail_w = width() - r - pad * 2.0;
    const qreal avail_h = height() - r - pad * 2.0;
    if (avail_w <= 1.0 || avail_h <= 1.0) {
        resetView();
        return;
    }
    m_zoom = std::clamp(std::min(avail_w / world_w, avail_h / world_h), kMinZoom, kMaxZoom);
    m_pan_x = -pad / m_zoom;
    m_pan_y = -pad / m_zoom;
    emit viewChanged();
    update();
}

void SceneViewItem::fitActiveScene()
{
    if (!m_session || !m_session->hasProject()) {
        resetView();
        return;
    }
    m_session->fitSceneView(this);
}

QPointF SceneViewItem::screenToWorld(const QPointF &screen) const
{
    const qreal r = rulerSize();
    return QPointF(m_pan_x + (screen.x() - r) / m_zoom,
                   m_pan_y + (screen.y() - r) / m_zoom);
}

QPointF SceneViewItem::worldToScreen(const QPointF &world) const
{
    const qreal r = rulerSize();
    return QPointF((world.x() - m_pan_x) * m_zoom + r,
                   (world.y() - m_pan_y) * m_zoom + r);
}

bool SceneViewItem::hasDragPreview() const
{
    return m_has_drag_preview;
}

quint32 SceneViewItem::dragEntityId() const
{
    return m_drag_entity_id;
}

QPointF SceneViewItem::dragPreviewWorld() const
{
    return m_drag_preview_world;
}

void SceneViewItem::paint(QPainter *painter)
{
    painter->fillRect(boundingRect(), QColor(0x0a, 0x0c, 0x10));

    if (!m_session || !m_session->hasProject()) {
        painter->setPen(QColor(0x5c, 0x63, 0x70));
        painter->drawText(boundingRect(),
                          Qt::AlignCenter,
                          QStringLiteral("Open a project to edit the scene"));
        return;
    }

    m_session->paintSceneView(painter, this);

    if (m_marquee) {
        const QPointF a = worldToScreen(m_marquee_start_world);
        const QPointF b = worldToScreen(m_marquee_end_world);
        QRectF box = QRectF(a, b).normalized();
        painter->fillRect(box, QColor(75, 143, 247, 40));
        painter->setPen(QPen(QColor(75, 143, 247), 1, Qt::DashLine));
        painter->drawRect(box);
    }
}

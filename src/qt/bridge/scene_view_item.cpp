#include "bridge/scene_view_item.h"

#include "bridge/editor_session.h"

#include <QMouseEvent>
#include <QPainter>
#include <QCursor>
#include <QWheelEvent>
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
}

void SceneViewItem::onSessionDocumentChanged()
{
    fitActiveScene();
    update();
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
    const qreal zx = (width() - pad * 2.0) / world_w;
    const qreal zy = (height() - pad * 2.0) / world_h;
    m_zoom = std::clamp(std::min(zx, zy), kMinZoom, kMaxZoom);
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
    return QPointF(m_pan_x + screen.x() / m_zoom, m_pan_y + screen.y() / m_zoom);
}

QPointF SceneViewItem::worldToScreen(const QPointF &world) const
{
    return QPointF((world.x() - m_pan_x) * m_zoom, (world.y() - m_pan_y) * m_zoom);
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
}

void SceneViewItem::mousePressEvent(QMouseEvent *event)
{
    if (!m_session || !m_session->hasProject()) {
        event->ignore();
        return;
    }

    m_last_screen = event->position();

    if (event->button() == Qt::MiddleButton || event->button() == Qt::RightButton
        || (event->button() == Qt::LeftButton && (event->modifiers() & Qt::AltModifier))) {
        m_panning = true;
        setCursor(Qt::ClosedHandCursor);
        event->accept();
        return;
    }

    if (event->button() != Qt::LeftButton) {
        event->ignore();
        return;
    }

    const QPointF world = screenToWorld(event->position());
    const quint32 hit = m_session->pickEntityAt(world.x(), world.y());
    if (hit == 0) {
        m_session->clearSelection();
        event->accept();
        return;
    }

    m_session->selectEntity(hit);
    m_dragging = true;
    m_drag_entity_id = hit;
    m_drag_start_world = world;
    m_drag_origin_world = QPointF(m_session->selectedX(), m_session->selectedY());
    m_drag_preview_world = m_drag_origin_world;
    m_has_drag_preview = true;
    event->accept();
    update();
}

void SceneViewItem::mouseMoveEvent(QMouseEvent *event)
{
    if (m_panning) {
        const QPointF delta = event->position() - m_last_screen;
        m_last_screen = event->position();
        m_pan_x -= delta.x() / m_zoom;
        m_pan_y -= delta.y() / m_zoom;
        emit viewChanged();
        update();
        event->accept();
        return;
    }

    if (m_dragging && m_has_drag_preview) {
        const QPointF world = screenToWorld(event->position());
        const QPointF delta = world - m_drag_start_world;
        m_drag_preview_world = m_drag_origin_world + delta;
        update();
        event->accept();
        return;
    }

    event->ignore();
}

void SceneViewItem::mouseReleaseEvent(QMouseEvent *event)
{
    if (m_panning
        && (event->button() == Qt::MiddleButton || event->button() == Qt::RightButton
            || event->button() == Qt::LeftButton)) {
        m_panning = false;
        unsetCursor();
        event->accept();
        return;
    }

    if (m_dragging && event->button() == Qt::LeftButton) {
        m_dragging = false;
        if (m_has_drag_preview && m_drag_entity_id != 0) {
            const qreal dx = m_drag_preview_world.x() - m_drag_origin_world.x();
            const qreal dy = m_drag_preview_world.y() - m_drag_origin_world.y();
            if (std::abs(dx) > 0.001 || std::abs(dy) > 0.001) {
                m_session->commitPosition(m_drag_preview_world.x(), m_drag_preview_world.y());
            }
        }
        m_has_drag_preview = false;
        m_drag_entity_id = 0;
        event->accept();
        update();
        return;
    }

    event->ignore();
}

void SceneViewItem::wheelEvent(QWheelEvent *event)
{
    const QPointF before = screenToWorld(event->position());
    const qreal factor = event->angleDelta().y() > 0 ? 1.1 : (1.0 / 1.1);
    setZoom(m_zoom * factor);
    const QPointF after = screenToWorld(event->position());
    m_pan_x += before.x() - after.x();
    m_pan_y += before.y() - after.y();
    emit viewChanged();
    update();
    event->accept();
}

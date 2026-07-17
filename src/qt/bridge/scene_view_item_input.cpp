#include "bridge/scene_view_item.h"

#include "bridge/editor_session.h"

#include <QCursor>
#include <QHoverEvent>
#include <QMouseEvent>
#include <cmath>

namespace {

constexpr qreal kDragThresholdPx = 4.0;

} // namespace

void SceneViewItem::beginPan()
{
    m_panning = true;
    setCursor(Qt::ClosedHandCursor);
}

void SceneViewItem::endPan()
{
    if (!m_panning) {
        return;
    }
    m_panning = false;
    updateHoverCursor(m_last_screen);
}

void SceneViewItem::cancelEntityDrag()
{
    m_pending_entity_drag = false;
    m_dragging = false;
    m_has_drag_preview = false;
    m_drag_entity_id = 0;
    updateHoverCursor(m_last_screen);
    update();
}

void SceneViewItem::cancelActiveGesture()
{
    const bool needs_update = m_panning || m_marquee || m_pending_entity_drag
        || m_dragging || m_has_drag_preview;
    m_panning = false;
    m_marquee = false;
    m_pending_entity_drag = false;
    m_dragging = false;
    m_has_drag_preview = false;
    m_drag_entity_id = 0;
    updateHoverCursor(m_last_screen);
    if (needs_update) {
        update();
    }
}

void SceneViewItem::updateHoverCursor(const QPointF &screen)
{
    if (m_panning) {
        setCursor(Qt::ClosedHandCursor);
        return;
    }
    if (m_dragging) {
        setCursor(Qt::SizeAllCursor);
        return;
    }
    if (m_space_held || activeTool() == QLatin1String("pan")) {
        setCursor(Qt::OpenHandCursor);
        return;
    }
    if (!m_session || !m_session->hasProject() || m_session->isPlaying()) {
        unsetCursor();
        return;
    }
    const qreal r = rulerSize();
    if (screen.x() < r || screen.y() < r) {
        unsetCursor();
        return;
    }
    const QPointF world = screenToWorld(screen);
    const quint32 hit = m_session->pickEntityAt(world.x(), world.y());
    if (hit != 0 && activeTool() == QLatin1String("select")) {
        setCursor(Qt::PointingHandCursor);
    } else {
        unsetCursor();
    }
}

void SceneViewItem::nudgeSelection(qreal dx, qreal dy)
{
    if (!m_session || m_session->isPlaying() || !m_session->hasSelection()) {
        return;
    }
    const quint32 id = m_session->selectedEntityId();
    if (id == 0) {
        return;
    }
    const qreal next_x = m_session->selectedX() + dx;
    const qreal next_y = m_session->selectedY() + dy;
    if (std::abs(dx) <= 0.001 && std::abs(dy) <= 0.001) {
        return;
    }
    m_session->commitPosition(id, next_x, next_y);
}

void SceneViewItem::mousePressEvent(QMouseEvent *event)
{
    if (!m_session || !m_session->hasProject()) {
        event->ignore();
        return;
    }

    forceActiveFocus(Qt::MouseFocusReason);

    const bool playing = m_session->isPlaying();
    const QString tool = activeTool();

    m_last_screen = event->position();
    m_press_screen = event->position();

    const bool pan_gesture =
        event->button() == Qt::MiddleButton || event->button() == Qt::RightButton
        || (event->button() == Qt::LeftButton
            && (m_space_held || (event->modifiers() & Qt::AltModifier)
                || tool == QLatin1String("pan")));

    if (pan_gesture) {
        beginPan();
        event->accept();
        return;
    }

    if (event->button() != Qt::LeftButton) {
        event->ignore();
        return;
    }

    const qreal r = rulerSize();
    if (event->position().x() < r || event->position().y() < r) {
        event->accept();
        return;
    }

    if (playing) {
        event->accept();
        return;
    }

    const QPointF world = screenToWorld(event->position());

    if (tool == QLatin1String("rect")) {
        m_marquee = true;
        m_marquee_start_world = world;
        m_marquee_end_world = world;
        event->accept();
        update();
        return;
    }

    const quint32 hit = m_session->pickEntityAt(world.x(), world.y());
    if (hit == 0) {
        m_session->clearSelection();
        cancelEntityDrag();
        event->accept();
        return;
    }

    m_session->selectEntity(hit);
    m_pending_entity_drag = true;
    m_dragging = false;
    m_drag_entity_id = hit;
    m_drag_start_world = world;
    m_drag_origin_world = QPointF(m_session->selectedX(), m_session->selectedY());
    m_drag_preview_world = m_drag_origin_world;
    m_has_drag_preview = false;
    event->accept();
    update();
}

void SceneViewItem::mouseMoveEvent(QMouseEvent *event)
{
    const QPointF previous = m_last_screen;
    m_last_screen = event->position();

    if (m_panning) {
        const QPointF delta = m_last_screen - previous;
        m_pan_x -= delta.x() / m_zoom;
        m_pan_y -= delta.y() / m_zoom;
        emit viewChanged();
        update();
        event->accept();
        return;
    }

    if (m_marquee) {
        m_marquee_end_world = screenToWorld(event->position());
        update();
        event->accept();
        return;
    }

    if (m_pending_entity_drag && !m_dragging) {
        const QPointF delta = event->position() - m_press_screen;
        const qreal distance = std::hypot(delta.x(), delta.y());
        if (distance >= kDragThresholdPx) {
            m_dragging = true;
            m_pending_entity_drag = false;
            m_has_drag_preview = true;
            setCursor(Qt::SizeAllCursor);
        } else {
            event->accept();
            return;
        }
    }

    if (m_dragging && m_has_drag_preview && m_drag_entity_id != 0) {
        const QPointF world = screenToWorld(event->position());
        const QPointF delta = world - m_drag_start_world;
        m_drag_preview_world = snapWorld(m_drag_origin_world + delta);
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
        endPan();
        event->accept();
        return;
    }

    if (m_marquee && event->button() == Qt::LeftButton) {
        m_marquee = false;
        m_marquee_end_world = screenToWorld(event->position());
        m_session->selectInWorldRect(m_marquee_start_world.x(),
                                     m_marquee_start_world.y(),
                                     m_marquee_end_world.x(),
                                     m_marquee_end_world.y());
        event->accept();
        update();
        return;
    }

    if (event->button() == Qt::LeftButton
        && (m_pending_entity_drag || m_dragging)) {
        const bool did_drag = m_dragging && m_has_drag_preview && m_drag_entity_id != 0;
        const quint32 entity_id = m_drag_entity_id;
        const QPointF origin = m_drag_origin_world;
        const QPointF preview = m_drag_preview_world;

        m_pending_entity_drag = false;
        m_dragging = false;
        m_has_drag_preview = false;
        m_drag_entity_id = 0;

        if (did_drag) {
            const QPointF snapped = snapWorld(preview);
            const qreal dx = snapped.x() - origin.x();
            const qreal dy = snapped.y() - origin.y();
            if (std::abs(dx) > 0.001 || std::abs(dy) > 0.001) {
                m_session->commitCapturedScenePosition(entity_id, snapped.x(), snapped.y());
            }
        }

        updateHoverCursor(event->position());
        event->accept();
        update();
        return;
    }

    event->ignore();
}

void SceneViewItem::hoverMoveEvent(QHoverEvent *event)
{
    m_last_screen = event->position();
    if (!m_panning && !m_dragging && !m_pending_entity_drag) {
        updateHoverCursor(event->position());
    }
    event->accept();
}

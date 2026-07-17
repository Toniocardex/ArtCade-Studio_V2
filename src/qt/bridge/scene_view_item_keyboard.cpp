#include "bridge/scene_view_item.h"

#include "bridge/editor_session.h"

#include <QCursor>
#include <QFocusEvent>
#include <QKeyEvent>
#include <QWheelEvent>

namespace {

constexpr qreal kNudgeStepPx = 1.0;

} // namespace

void SceneViewItem::keyPressEvent(QKeyEvent *event)
{
    if (event->key() == Qt::Key_Space && !event->isAutoRepeat()) {
        m_space_held = true;
        if (!m_panning && !m_dragging) {
            setCursor(Qt::OpenHandCursor);
        }
        event->accept();
        return;
    }

    if (event->key() == Qt::Key_Escape
        && (m_dragging || m_pending_entity_drag || m_has_drag_preview)) {
        cancelEntityDrag();
        event->accept();
        return;
    }

    if (!m_session || m_session->isPlaying() || !m_session->hasSelection()) {
        QQuickPaintedItem::keyPressEvent(event);
        return;
    }

    const qreal step = (event->modifiers() & Qt::ShiftModifier)
                           ? m_session->sceneGridStep()
                           : kNudgeStepPx;
    switch (event->key()) {
    case Qt::Key_Left:
        nudgeSelection(-step, 0.0);
        event->accept();
        return;
    case Qt::Key_Right:
        nudgeSelection(step, 0.0);
        event->accept();
        return;
    case Qt::Key_Up:
        nudgeSelection(0.0, -step);
        event->accept();
        return;
    case Qt::Key_Down:
        nudgeSelection(0.0, step);
        event->accept();
        return;
    default:
        break;
    }
    QQuickPaintedItem::keyPressEvent(event);
}

void SceneViewItem::keyReleaseEvent(QKeyEvent *event)
{
    if (event->key() == Qt::Key_Space && !event->isAutoRepeat()) {
        m_space_held = false;
        if (!m_panning) {
            updateHoverCursor(m_last_screen);
        }
        event->accept();
        return;
    }
    QQuickPaintedItem::keyReleaseEvent(event);
}

void SceneViewItem::focusOutEvent(QFocusEvent *event)
{
    m_space_held = false;
    cancelActiveGesture();
    unsetCursor();
    QQuickPaintedItem::focusOutEvent(event);
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

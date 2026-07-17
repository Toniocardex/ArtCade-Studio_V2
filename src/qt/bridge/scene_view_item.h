/**
 * Authoring scene canvas: pan/zoom (workspace), pick, select-drag move, marquee via EditorSession.
 * Select click-selects and drag-moves (threshold); Space/MMB/RMB/Alt pan without changing tool.
 * Tool + snap are session workspace SoT — this view does not own a second copy.
 * Draws placeholder AABBs from ProjectDoc — not a second document authority.
 */
#pragma once

#include <QPointF>
#include <QQuickPaintedItem>
#include <QtQml/qqmlregistration.h>

class EditorSession;

class SceneViewItem : public QQuickPaintedItem
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(EditorSession *session READ session WRITE setSession NOTIFY sessionChanged)
    Q_PROPERTY(qreal panX READ panX WRITE setPanX NOTIFY viewChanged)
    Q_PROPERTY(qreal panY READ panY WRITE setPanY NOTIFY viewChanged)
    Q_PROPERTY(qreal zoom READ zoom WRITE setZoom NOTIFY viewChanged)
    Q_PROPERTY(bool gridVisible READ gridVisible WRITE setGridVisible NOTIFY viewChanged)
    Q_PROPERTY(bool rulersVisible READ rulersVisible WRITE setRulersVisible NOTIFY viewChanged)

public:
    explicit SceneViewItem(QQuickItem *parent = nullptr);

    [[nodiscard]] EditorSession *session() const;
    void setSession(EditorSession *session);

    [[nodiscard]] qreal panX() const;
    void setPanX(qreal value);
    [[nodiscard]] qreal panY() const;
    void setPanY(qreal value);
    [[nodiscard]] qreal zoom() const;
    void setZoom(qreal value);
    [[nodiscard]] bool gridVisible() const;
    void setGridVisible(bool visible);
    [[nodiscard]] bool rulersVisible() const;
    void setRulersVisible(bool visible);

    /** Screen-space ruler thickness (0 when rulers hidden). */
    [[nodiscard]] qreal rulerSize() const;

    /** Applies pan/zoom so the active scene world rect fits the item. */
    void applyFit(qreal world_w, qreal world_h);

    [[nodiscard]] QPointF screenToWorld(const QPointF &screen) const;
    [[nodiscard]] QPointF worldToScreen(const QPointF &world) const;

    [[nodiscard]] bool hasDragPreview() const;
    [[nodiscard]] quint32 dragEntityId() const;
    [[nodiscard]] QPointF dragPreviewWorld() const;

    Q_INVOKABLE void resetView();
    Q_INVOKABLE void fitActiveScene();

    void paint(QPainter *painter) override;

signals:
    void sessionChanged();
    void viewChanged();

protected:
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void hoverMoveEvent(QHoverEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;
    void keyReleaseEvent(QKeyEvent *event) override;
    void focusOutEvent(QFocusEvent *event) override;
    void wheelEvent(QWheelEvent *event) override;

private:
    void bindSessionSignals();
    void onSessionDocumentChanged();
    [[nodiscard]] QString activeTool() const;
    [[nodiscard]] QPointF snapWorld(const QPointF &world) const;
    void beginPan();
    void endPan();
    void cancelEntityDrag();
    void cancelActiveGesture();
    void updateHoverCursor(const QPointF &screen);
    void nudgeSelection(qreal dx, qreal dy);

    EditorSession *m_session = nullptr;
    qreal m_pan_x = 0.0;
    qreal m_pan_y = 0.0;
    qreal m_zoom = 1.0;
    bool m_grid_visible = true;
    bool m_rulers_visible = true;

    bool m_panning = false;
    bool m_space_held = false;
    bool m_pending_entity_drag = false;
    bool m_dragging = false;
    bool m_marquee = false;
    QPointF m_last_screen;
    QPointF m_press_screen;
    QPointF m_drag_start_world;
    QPointF m_drag_origin_world;
    quint32 m_drag_entity_id = 0;
    QPointF m_drag_preview_world;
    bool m_has_drag_preview = false;
    QPointF m_marquee_start_world;
    QPointF m_marquee_end_world;
};

#include "bridge/editor_session.h"
#include "bridge/scene_view_item.h"

#include <QFocusEvent>
#include <QGuiApplication>
#include <QMouseEvent>

#include <cmath>
#include <cstdio>
#include <cstdlib>

#ifndef ARTCADE_QT_SLICE_FIXTURE_PATH
#error ARTCADE_QT_SLICE_FIXTURE_PATH must be defined
#endif

namespace {

void expect(bool condition, const char *message)
{
    if (!condition) {
        std::fprintf(stderr, "FAIL: %s\n", message);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", message);
}

class TestSceneViewItem final : public SceneViewItem
{
public:
    void press(const QPointF &position)
    {
        QMouseEvent event(QEvent::MouseButtonPress, position, Qt::LeftButton,
                          Qt::LeftButton, Qt::NoModifier);
        mousePressEvent(&event);
    }

    void release(const QPointF &position)
    {
        QMouseEvent event(QEvent::MouseButtonRelease, position, Qt::LeftButton,
                          Qt::NoButton, Qt::NoModifier);
        mouseReleaseEvent(&event);
    }

    void loseFocus()
    {
        QFocusEvent event(QEvent::FocusOut, Qt::OtherFocusReason);
        focusOutEvent(&event);
    }
};

bool nearlyEqual(double lhs, double rhs)
{
    return std::abs(lhs - rhs) < 0.001;
}

} // namespace

int main(int argc, char *argv[])
{
    QGuiApplication application(argc, argv);

    EditorSession session;
    session.openProject(QStringLiteral(ARTCADE_QT_SLICE_FIXTURE_PATH));
    expect(session.hasProject(), "open scene fixture");

    session.selectEntity(1);
    const double hero_x = session.selectedX();
    const double hero_y = session.selectedY();
    session.clearSelection();
    session.commitPosition(1, hero_x + 30.0, hero_y + 30.0);
    session.selectEntity(1);
    expect(nearlyEqual(session.selectedX(), hero_x), "Inspector commit rejects stale selection");

    session.commitCapturedScenePosition(1, hero_x + 30.0, hero_y + 30.0);
    expect(nearlyEqual(session.selectedX(), hero_x + 30.0),
           "captured Scene View position commits by stable id");

    TestSceneViewItem view;
    view.setWidth(1280.0);
    view.setHeight(720.0);
    view.setSession(&session);
    view.applyFit(session.activeSceneWidth(), session.activeSceneHeight());

    session.selectEntity(1);
    session.setActiveTool(QStringLiteral("rect"));
    const QPointF empty_start = view.worldToScreen(QPointF(900.0, 600.0));
    const QPointF empty_end = view.worldToScreen(QPointF(1100.0, 650.0));
    view.press(empty_start);
    view.loseFocus();
    view.release(empty_end);
    expect(session.selectedEntityId() == 1, "focus loss cancels marquee selection");

    return 0;
}

#include "editor-overlay-renderer.h"

#include "../../modules/renderer/include/renderer.h"

#include <algorithm>
#include <cmath>

namespace ArtCade::EditorOverlayRenderer {

namespace {

struct EntityOutlineBounds {
    float x = 0.f;
    float y = 0.f;
    float w = 0.f;
    float h = 0.f;
};

EntityOutlineBounds entityOutlineBounds(const Transform& transform,
                                        const PhysicsComponent& physics) {
    const float w = physics.collider.size.x > 2.f
        ? physics.collider.size.x
        : 40.f * transform.scale.x;
    const float h = physics.collider.size.y > 2.f
        ? physics.collider.size.y
        : 40.f * transform.scale.y;
    return {
        transform.position.x - w * 0.5f,
        transform.position.y - h * 0.5f,
        w,
        h,
    };
}

// Rectangle outline drawn as four 2-world-pixel-thick filled rects, fully
// contained inside [x,y]-[x+w,y+h]. Rationale:
//
//   • drawLine() in raylib renders 1px lines that sit on the framebuffer
//     boundary when called at y=h / x=w — they get clipped by the WebGL
//     viewport on Emscripten. Same quirk that drawSelection() documents.
//
//   • A 1px-thick drawRect inset by 1 covers row h-1, but at low CSS zoom
//     (canvas internal 1280x640 displayed e.g. at 80% = 0.8 CSS px / world
//     px) a single-pixel line becomes sub-pixel and can blend with the
//     surrounding container border, looking "missing" on the bottom/right.
//
//   • 2 world-pixels thick is the same value drawSelection uses; renders
//     reliably from 25% to 400% zoom and on both native + WASM, with no
//     framebuffer edge clip and no sub-pixel disappearance.
void drawRectOutline(Modules::Renderer& renderer,
                     float x, float y, float w, float h,
                     const Vec4& color) {
    const float t = 2.f;
    renderer.drawRect(x,         y,         w, t, color); // top
    renderer.drawRect(x,         y + h - t, w, t, color); // bottom
    renderer.drawRect(x,         y,         t, h, color); // left
    renderer.drawRect(x + w - t, y,         t, h, color); // right
}

void drawThickLine(Modules::Renderer& renderer,
                   float x1, float y1, float x2, float y2,
                   const Vec4& color,
                   float halfWidth = 1.25f) {
    const float dx = x2 - x1;
    const float dy = y2 - y1;
    const float len = std::sqrt(dx * dx + dy * dy);
    if (len < 0.001f) return;
    const float nx = -dy / len * halfWidth;
    const float ny =  dx / len * halfWidth;
    for (int i = -1; i <= 1; ++i) {
        const float ox = nx * static_cast<float>(i);
        const float oy = ny * static_cast<float>(i);
        renderer.drawLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, color);
    }
}

} // namespace

void drawBackdrop(Modules::Renderer& renderer,
                  const SceneDef& scene,
                  const EditorOverlayState& state) {
    if (!state.inEditMode) return;
    const Vec2 cam     = renderer.getCameraPosition();
    const Vec2 visible = renderer.visibleWorldSize();
    renderer.drawRectImmediate(
        cam.x, cam.y,
        std::max(1.f, visible.x),
        std::max(1.f, visible.y),
        scene.backgroundColor);
}

void drawGuides(Modules::Renderer& renderer,
                const SceneDef& scene,
                const EditorOverlayState& state) {
    if (!state.inEditMode || !state.guidesEnabled) return;

    const float w = std::max(1.f, scene.worldSize.x);
    const float h = std::max(1.f, scene.worldSize.y);

    // Grid — only when the user picked a reasonable cell size. Very small
    // values would produce a flood of drawLine calls.
    const Vec4  grid{0.f, 0.85f, 1.f, 0.16f};
    const float step = state.gridSize > 0.f ? state.gridSize : 32.f;
    if (step >= 4.f) {
        for (float x = step; x < w; x += step)
            renderer.drawLine(x, 0.f, x, h, grid);
        for (float y = step; y < h; y += step)
            renderer.drawLine(0.f, y, w, y, grid);
    }

    // World bounds outline is no longer drawn inside the canvas.
    //
    // It used to be `drawRectOutline(0, 0, w, h, cyan)` here, but inside the
    // WebGL framebuffer a 2-world-pixel border becomes < 1 device pixel at
    // low CSS zoom (e.g. 25% on a 4096-wide platformer level). Sub-pixel
    // antialiasing + alpha 0.9 made the line look grey and incomplete on
    // the bottom / right edges, regardless of how we authored it. The fix
    // is structural: the world-bounds outline is an EDITOR UI concern, not
    // a rendering concern — PreviewPanel now draws a CSS border on the
    // canvas wrapper (sized to worldSize * zoom), which the browser renders
    // pixel-perfect on all four sides at any zoom level. The grid below and
    // the viewport overlay further down stay world-space because they ARE
    // world data that must stay aligned to the scene coordinates.
    //
    // Camera viewport preview (amber) — the rectangle the player will see
    // in PLAY mode. Centred inside the world so the designer immediately
    // grasps the "camera lens" relative to the level. Drawn only when the
    // viewport differs from the world (otherwise it would double the cyan
    // outline above).
    const float vw = std::max(1.f, scene.viewportSize.x);
    const float vh = std::max(1.f, scene.viewportSize.y);
    if (vw < w - 0.5f || vh < h - 0.5f) {
        const float vx = (w - vw) * 0.5f;
        const float vy = (h - vh) * 0.5f;
        drawRectOutline(renderer, vx, vy, vw, vh, Vec4{1.f, 0.8f, 0.1f, 0.9f});
    }
}

void drawSelection(Modules::Renderer& renderer,
                   const Transform& transform,
                   const PhysicsComponent& physics,
                   const std::optional<SensorComponent>& sensor,
                   const EditorOverlayState& state) {
    if (!state.inEditMode || state.selectedId == 0u) return;

    const Vec2 p = transform.position;

    // Sensor area first (under the box), shape-aware, translucent cyan.
    if (sensor) {
        const Vec4 sc{0.f, 1.f, 1.f, 0.35f};
        if (sensor->shape == "Rectangle") {
            const float sw = sensor->width;
            const float sh = sensor->height;
            renderer.drawRect(p.x - sw * 0.5f, p.y - sh * 0.5f, sw, sh, sc);
        } else {
            renderer.drawCircle(p.x, p.y, sensor->radius, sc);
        }
    }

    const EntityOutlineBounds bounds = entityOutlineBounds(transform, physics);
    const float t = 2.f;
    const Vec4  g{1.f, 1.f, 0.f, 1.f};

    // Four thin filled rects = outline. drawLine in raylib does not honour
    // line width consistently across native/WASM, drawRect does.
    renderer.drawRect(bounds.x,              bounds.y,              bounds.w, t, g);
    renderer.drawRect(bounds.x,              bounds.y + bounds.h - t, bounds.w, t, g);
    renderer.drawRect(bounds.x,              bounds.y,              t, bounds.h, g);
    renderer.drawRect(bounds.x + bounds.w - t, bounds.y,            t, bounds.h, g);
}

void drawHiddenInGameBadge(Modules::Renderer& renderer,
                           const Transform& transform,
                           const PhysicsComponent& physics) {
    const EntityOutlineBounds bounds = entityOutlineBounds(transform, physics);

    // Badge sits just above the entity outline top-left corner.
    const float badge = 24.f;
    const float bx = bounds.x;
    const float by = bounds.y - badge - 4.f;

    const Vec4 bg{0.06f, 0.07f, 0.09f, 0.92f};
    const Vec4 border{1.f, 0.55f, 0.1f, 1.f};
    const Vec4 eyeWhite{0.95f, 0.95f, 0.95f, 1.f};
    const Vec4 eyePupil{0.06f, 0.07f, 0.09f, 1.f};
    const Vec4 slash{1.f, 0.4f, 0.12f, 1.f};

    renderer.drawRect(bx, by, badge, badge, bg);
    drawRectOutline(renderer, bx, by, badge, badge, border);

    const float cx = bx + badge * 0.5f;
    const float cy = by + badge * 0.54f;
    renderer.drawCircle(cx, cy, 5.f, eyeWhite);
    renderer.drawCircle(cx, cy, 2.2f, eyePupil);

    // Eye-off slash — thick enough to read at editor zoom levels.
    drawThickLine(renderer,
                  bx + 4.f, by + 4.f,
                  bx + badge - 4.f, by + badge - 4.f,
                  slash, 1.4f);
}

} // namespace ArtCade::EditorOverlayRenderer

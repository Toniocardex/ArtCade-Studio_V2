#include "editor-overlay-renderer.h"

#include "../../modules/renderer/include/renderer.h"

#include <algorithm>

namespace ArtCade::EditorOverlayRenderer {

namespace {

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
                   const EntityDef* selected,
                   const Transform& transform,
                   const EditorOverlayState& state) {
    if (!state.inEditMode || state.selectedId == 0u || selected == nullptr) return;

    const Vec2 p = transform.position;

    // Sensor area first (under the box), shape-aware, translucent cyan.
    if (selected->sensor) {
        const Vec4 sc{0.f, 1.f, 1.f, 0.35f};
        if (selected->sensor->shape == "Rectangle") {
            const float sw = selected->sensor->width;
            const float sh = selected->sensor->height;
            renderer.drawRect(p.x - sw * 0.5f, p.y - sh * 0.5f, sw, sh, sc);
        } else {
            renderer.drawCircle(p.x, p.y, selected->sensor->radius, sc);
        }
    }

    // Selection box — collider size when available, fall back to 40px scaled.
    float w = selected->physics.collider.size.x > 2.f
        ? selected->physics.collider.size.x
        : 40.f * transform.scale.x;
    float h = selected->physics.collider.size.y > 2.f
        ? selected->physics.collider.size.y
        : 40.f * transform.scale.y;

    const float x = p.x - w * 0.5f;
    const float y = p.y - h * 0.5f;
    const float t = 2.f;
    const Vec4  g{1.f, 1.f, 0.f, 1.f};

    // Four thin filled rects = outline. drawLine in raylib does not honour
    // line width consistently across native/WASM, drawRect does.
    renderer.drawRect(x,         y,         w, t, g); // top
    renderer.drawRect(x,         y + h - t, w, t, g); // bottom
    renderer.drawRect(x,         y,         t, h, g); // left
    renderer.drawRect(x + w - t, y,         t, h, g); // right
}

} // namespace ArtCade::EditorOverlayRenderer

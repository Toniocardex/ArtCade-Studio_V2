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
        : 40.f * std::abs(transform.scale.x);
    const float h = physics.collider.size.y > 2.f
        ? physics.collider.size.y
        : 40.f * std::abs(transform.scale.y);
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

void drawEntityOutline(Modules::Renderer& renderer,
                       const EntityOutlineBounds& bounds,
                       const Vec4& color) {
    drawRectOutline(renderer, bounds.x, bounds.y, bounds.w, bounds.h, color);
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

    // Avorio Leggero (#EAEAEA) — engineering grid, no neon glow.
    // 0.22 alpha: visible on dark bg (0.082) without dominating the scene.
    const Vec4  grid{0.918f, 0.918f, 0.918f, 0.22f};
    const float step = state.gridSize > 0.f ? state.gridSize : 32.f;
    if (step >= 4.f) {
        for (float x = step; x < w; x += step)
            renderer.drawLine(x, 0.f, x, h, grid);
        for (float y = step; y < h; y += step)
            renderer.drawLine(0.f, y, w, y, grid);
    }

    const float vw = std::max(1.f, scene.viewportSize.x);
    const float vh = std::max(1.f, scene.viewportSize.y);
    if (vw < w - 0.5f || vh < h - 0.5f) {
        const float vx = (w - vw) * 0.5f;
        const float vy = (h - vh) * 0.5f;
        // Sage Green (#7A9C7E) — camera/viewport preview outline.
        drawRectOutline(renderer, vx, vy, vw, vh, Vec4{0.478f, 0.612f, 0.494f, 0.9f});
    }
}

void drawSelection(Modules::Renderer& renderer,
                   const Transform& transform,
                   const PhysicsComponent& physics,
                   const std::optional<SensorComponent>& sensor,
                   const EditorOverlayState& state,
                   bool hiddenInGame) {
    if (!state.inEditMode || state.selectedId == 0u) return;

    const Vec2 p = transform.position;

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
    const Vec4 sel = hiddenInGame
        ? Vec4{1.f, 0.55f, 0.1f, 1.f}
        : Vec4{1.f, 1.f, 0.f, 1.f};
    drawEntityOutline(renderer, bounds, sel);
}

void drawHiddenInGameOutline(Modules::Renderer& renderer,
                             const Transform& transform,
                             const PhysicsComponent& physics) {
    const EntityOutlineBounds bounds = entityOutlineBounds(transform, physics);
    const Vec4 amber{1.f, 0.55f, 0.1f, 0.75f};
    drawEntityOutline(renderer, bounds, amber);
}

} // namespace ArtCade::EditorOverlayRenderer

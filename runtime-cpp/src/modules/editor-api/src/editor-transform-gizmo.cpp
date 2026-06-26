#include "../include/editor-transform-gizmo.h"

#include "../../../modules/renderer/include/renderer.h"
#include "../../../core/sprite-draw-math.h"

#include <algorithm>
#include <cmath>

namespace ArtCade::EditorTransformGizmo {

namespace {

constexpr float kMinVisualDimWorld = 4.f;

void draw_rect_outline(Modules::Renderer& renderer,
                       float x, float y, float w, float h,
                       const Vec4& color) {
    const float t = 2.f;
    renderer.drawRect(x,         y,         w, t, color);
    renderer.drawRect(x,         y + h - t, w, t, color);
    renderer.drawRect(x,         y,         t, h, color);
    renderer.drawRect(x + w - t, y,         t, h, color);
}

void draw_resize_handle(Modules::Renderer& renderer,
                        float x,
                        float y,
                        float size) {
    const float half = size * 0.5f;
    const float left = x - half;
    const float top = y - half;
    renderer.drawRect(left, top, size, size, Vec4{1.f, 1.f, 1.f, 1.f});
    draw_rect_outline(renderer, left, top, size, size, Vec4{0.1f, 0.1f, 0.1f, 1.f});
}

float abs_scale(float value) {
    return std::abs(value) > 1e-6f ? std::abs(value) : 1.f;
}

bool point_in_handle(float worldX,
                     float worldY,
                     float handleX,
                     float handleY,
                     float handleSizeWorld) {
    const float half = handleSizeWorld * 0.5f;
    return worldX >= handleX - half && worldX <= handleX + half
        && worldY >= handleY - half && worldY <= handleY + half;
}

} // namespace

EntityVisualBounds entity_visual_bounds(
    Modules::Renderer& renderer,
    const Transform& transform,
    const SpriteComponent& sprite,
    const std::optional<Vec2>& visualSize) {
    const Vec2 size = visualSize.value_or(
        renderer.spriteDestinationSize(sprite.spriteAssetId, transform.scale));
    const Vec2 topLeft = SpriteDrawMath::placeholderTopLeft(
        transform.position, sprite.pivot, size.x, size.y);
    return { topLeft.x, topLeft.y, size.x, size.y };
}

float resize_handle_world_size(Modules::Renderer& renderer, float screenPx) {
    float zoom = 1.f;
    renderer.editorGetView(nullptr, nullptr, &zoom);
    if (!(zoom > 1e-6f)) zoom = 1.f;
    return screenPx / zoom;
}

void draw_resize_handles(Modules::Renderer& renderer,
                         const EntityVisualBounds& bounds,
                         float handleSizeWorld) {
    if (handleSizeWorld <= 0.f) return;
    const float left = bounds.x;
    const float top = bounds.y;
    const float right = bounds.x + bounds.w;
    const float bottom = bounds.y + bounds.h;

    draw_resize_handle(renderer, left,   top,    handleSizeWorld);
    draw_resize_handle(renderer, right,  top,    handleSizeWorld);
    draw_resize_handle(renderer, left,   bottom, handleSizeWorld);
    draw_resize_handle(renderer, right,  bottom, handleSizeWorld);
}

ResizeHandle hit_test_resize_handle(
    float worldX,
    float worldY,
    const EntityVisualBounds& bounds,
    float handleSizeWorld) {
    if (handleSizeWorld <= 0.f) return ResizeHandle::None;

    const float left = bounds.x;
    const float top = bounds.y;
    const float right = bounds.x + bounds.w;
    const float bottom = bounds.y + bounds.h;

    const struct Candidate { ResizeHandle handle; float x; float y; } candidates[] = {
        { ResizeHandle::TopRight,    right,  top    },
        { ResizeHandle::BottomRight, right,  bottom },
        { ResizeHandle::BottomLeft,  left,   bottom },
        { ResizeHandle::TopLeft,     left,   top    },
    };

    for (const Candidate& candidate : candidates) {
        if (point_in_handle(worldX, worldY, candidate.x, candidate.y, handleSizeWorld))
            return candidate.handle;
    }
    return ResizeHandle::None;
}

Vec2 calculate_scale_from_handle(
    ResizeHandle handle,
    float worldX,
    float worldY,
    const Transform& dragStartTransform,
    const EntityVisualBounds& dragStartBounds) {
    const float startAbsScaleX = abs_scale(dragStartTransform.scale.x);
    const float startAbsScaleY = abs_scale(dragStartTransform.scale.y);
    const float baseW = dragStartBounds.w / startAbsScaleX;
    const float baseH = dragStartBounds.h / startAbsScaleY;
    if (baseW <= 1e-6f || baseH <= 1e-6f) {
        return dragStartTransform.scale;
    }

    const float left = dragStartBounds.x;
    const float top = dragStartBounds.y;
    const float right = dragStartBounds.x + dragStartBounds.w;
    const float bottom = dragStartBounds.y + dragStartBounds.h;

    float newW = dragStartBounds.w;
    float newH = dragStartBounds.h;

    switch (handle) {
    case ResizeHandle::TopLeft:
        newW = right - worldX;
        newH = bottom - worldY;
        break;
    case ResizeHandle::TopRight:
        newW = worldX - left;
        newH = bottom - worldY;
        break;
    case ResizeHandle::BottomLeft:
        newW = right - worldX;
        newH = worldY - top;
        break;
    case ResizeHandle::BottomRight:
        newW = worldX - left;
        newH = worldY - top;
        break;
    case ResizeHandle::None:
        return dragStartTransform.scale;
    }

    newW = std::max(kMinVisualDimWorld, newW);
    newH = std::max(kMinVisualDimWorld, newH);

    const float signX = dragStartTransform.scale.x < 0.f ? -1.f : 1.f;
    const float signY = dragStartTransform.scale.y < 0.f ? -1.f : 1.f;
    return {
        signX * (newW / baseW),
        signY * (newH / baseH),
    };
}

} // namespace ArtCade::EditorTransformGizmo

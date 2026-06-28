#include "editor-native/view/scene_view.h"

#include "editor-native/view/texture_cache.h"

#include <raylib.h>

namespace ArtCade::EditorNative {

namespace {

Color toColor(const Vec4& c) {
    return Color{
        static_cast<unsigned char>(c.r * 255.f),
        static_cast<unsigned char>(c.g * 255.f),
        static_cast<unsigned char>(c.b * 255.f),
        static_cast<unsigned char>(c.a * 255.f),
    };
}

Color toColor(const Vec3& c, float alpha = 1.f) {
    return toColor(Vec4{c.x, c.y, c.z, alpha});
}

Rectangle toRectangle(const SceneFrameRect& rect) {
    return Rectangle{rect.x, rect.y, rect.width, rect.height};
}

constexpr float kGridStep = 48.f;

bool hasVisibleSprite(const SceneFrameSnapshot& frame, EntityId entityId) {
    for (const SceneFrameSprite& sprite : frame.sprites) {
        if (sprite.entityId == entityId && sprite.visible && !sprite.assetId.empty()) return true;
    }
    return false;
}

void drawMissingSprite(const SceneFrameSprite& sprite, float zoom) {
    const Rectangle bounds = toRectangle(sprite.destination);
    DrawRectangleRec(bounds, Color{70, 44, 58, 200});
    DrawRectangleLinesEx(bounds, 1.5f / zoom, Color{230, 90, 120, 230});
    DrawLineEx({bounds.x, bounds.y},
               {bounds.x + bounds.width, bounds.y + bounds.height},
               1.2f / zoom, Color{230, 90, 120, 230});
    DrawLineEx({bounds.x + bounds.width, bounds.y},
               {bounds.x, bounds.y + bounds.height},
               1.2f / zoom, Color{230, 90, 120, 230});
}

} // namespace

void SceneView::render(const SceneFrameSnapshot& frame,
                       const EditorSceneViewState& view,
                       const ViewportRect& rect,
                       const TextureCache& textures) const {
    if (!rect.valid()) return;

    BeginScissorMode(rect.x, rect.y, rect.width, rect.height);

    DrawRectangle(rect.x, rect.y, rect.width, rect.height, Color{14, 14, 16, 255});

    if (!frame.hasScene) {
        DrawText("No active scene", rect.x + 16, rect.y + 16, 18, Color{120, 128, 140, 255});
        EndScissorMode();
        return;
    }

    const Vector2 world{frame.worldSize.x, frame.worldSize.y};
    Camera2D cam{};
    cam.offset = Vector2{rect.x + rect.width * 0.5f, rect.y + rect.height * 0.5f};
    cam.target = Vector2{world.x * 0.5f + view.pan.x, world.y * 0.5f + view.pan.y};
    cam.zoom = view.zoom;
    cam.rotation = 0.f;

    BeginMode2D(cam);

    DrawRectangle(0, 0, static_cast<int>(world.x), static_cast<int>(world.y),
                  toColor(frame.backgroundColor));

    // Zinc grid: faint minor lines, slightly stronger majors every 4 cells.
    const Color gridMinor{120, 120, 130, 16};
    const Color gridMajor{120, 120, 130, 30};
    int ix = 0;
    for (float gx = 0.f; gx <= world.x; gx += kGridStep, ++ix)
        DrawLineV({gx, 0.f}, {gx, world.y}, (ix % 4 == 0) ? gridMajor : gridMinor);
    int iy = 0;
    for (float gy = 0.f; gy <= world.y; gy += kGridStep, ++iy)
        DrawLineV({0.f, gy}, {world.x, gy}, (iy % 4 == 0) ? gridMajor : gridMinor);

    // Subtle neutral world frame, so the accent selection stands out against it.
    const float linePx = 1.5f / cam.zoom;
    DrawRectangleLinesEx(Rectangle{0, 0, world.x, world.y}, linePx, Color{63, 63, 70, 200});

    for (const SceneFrameEntity& entity : frame.entities) {
        if (hasVisibleSprite(frame, entity.entityId)) continue;
        const Rectangle box = toRectangle(entity.bounds);
        DrawRectangleRec(box, toColor(entity.fillColor, 0.92f));
        DrawRectangleLinesEx(box, 1.f / cam.zoom, Color{12, 14, 18, 200});
    }

    for (const SceneFrameSprite& sprite : frame.sprites) {
        if (!sprite.visible) continue;
        const TextureResource* resource = textures.find(sprite.assetId);
        if (!resource || !resource->loaded) {
            drawMissingSprite(sprite, cam.zoom);
            continue;
        }

        const Rectangle source{
            0.f,
            0.f,
            static_cast<float>(resource->texture.width),
            static_cast<float>(resource->texture.height),
        };
        DrawTexturePro(resource->texture, source, toRectangle(sprite.destination),
                       Vector2{0.f, 0.f}, 0.f, WHITE);
    }

    for (const SceneFrameEntity& entity : frame.entities) {
        for (const SceneFrameCollider& collider : frame.colliders) {
            if (collider.entityId != entity.entityId) continue;
            const Rectangle bounds{
                collider.worldBounds.x,
                collider.worldBounds.y,
                collider.worldBounds.width,
                collider.worldBounds.height,
            };
            const Color color = collider.isTrigger
                ? Color{86, 180, 235, 210}
                : Color{88, 220, 140, 210};
            DrawRectangleLinesEx(bounds, (collider.selected ? 2.2f : 1.5f) / cam.zoom, color);
            break;
        }

        if (entity.selected) {
            const Rectangle box = toRectangle(entity.bounds);
            const Rectangle sel{box.x - 3.f, box.y - 3.f, box.width + 6.f, box.height + 6.f};
            DrawRectangleLinesEx(sel, 2.f / cam.zoom, Color{59, 130, 246, 255});
        }
    }

    EndMode2D();

    // Scene name — subtle rounded chip in the top-left corner of the viewport.
    const char* label = frame.sceneName.c_str();
    const int fontSize = 14;
    const float textW = static_cast<float>(MeasureText(label, fontSize));
    const Rectangle chip{static_cast<float>(rect.x) + 10.f, static_cast<float>(rect.y) + 8.f,
                         textW + 22.f, 25.f};
    DrawRectangleRounded(chip, 0.35f, 6, Color{17, 17, 19, 215});
    DrawText(label, rect.x + 21, rect.y + 13, fontSize, Color{96, 148, 240, 255});

    EndScissorMode();
}

} // namespace ArtCade::EditorNative

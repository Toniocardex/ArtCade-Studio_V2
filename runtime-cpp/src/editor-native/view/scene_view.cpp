#include "editor-native/view/scene_view.h"

#include "editor-native/model/project_document.h"
#include "editor-native/model/sprite_render_view.h"

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
Color toColor(const Vec3& c, float a = 1.f) {
    return toColor(Vec4{c.x, c.y, c.z, a});
}

constexpr float kGridStep = 48.f;

const Vec3* fillFor(const ProjectDocument& document, const std::string& typeId) {
    const auto& types = document.data().objectTypes;
    const auto it = types.find(typeId);
    return it == types.end() ? nullptr : &it->second.sprite.fillColor;
}

} // namespace

void SceneView::render(const ProjectDocument& document,
                       const SceneId& sceneId,
                       const EditorSceneViewState& view,
                       const SelectionState& selection,
                       const ViewportRect& rect) const {
    if (!rect.valid()) return;

    const SceneDef* scene = document.findScene(sceneId);

    BeginScissorMode(rect.x, rect.y, rect.width, rect.height);

    // Workspace recess behind the scene (slightly darker than the panels).
    DrawRectangle(rect.x, rect.y, rect.width, rect.height, Color{18, 20, 24, 255});

    if (!scene) {
        DrawText("No active scene", rect.x + 16, rect.y + 16, 18, Color{120, 128, 140, 255});
        EndScissorMode();
        return;
    }

    const Vector2 world{scene->worldSize.x, scene->worldSize.y};
    Camera2D cam{};
    cam.offset = Vector2{rect.x + rect.width * 0.5f, rect.y + rect.height * 0.5f};
    cam.target = Vector2{world.x * 0.5f + view.pan.x, world.y * 0.5f + view.pan.y};
    cam.zoom = view.zoom;
    cam.rotation = 0.f;

    BeginMode2D(cam);

    // Scene background fill.
    DrawRectangle(0, 0, static_cast<int>(world.x), static_cast<int>(world.y),
                  toColor(scene->backgroundColor));

    // Alignment grid (ivory, low alpha), under entities.
    const Color grid{225, 222, 210, 18};
    for (float gx = 0.f; gx <= world.x; gx += kGridStep)
        DrawLineV({gx, 0.f}, {gx, world.y}, grid);
    for (float gy = 0.f; gy <= world.y; gy += kGridStep)
        DrawLineV({0.f, gy}, {world.x, gy}, grid);

    // Scene world boundary (always drawn — the "scene is mounted" signal).
    const float linePx = 1.5f / cam.zoom;
    DrawRectangleLinesEx(Rectangle{0, 0, world.x, world.y}, linePx, Color{86, 134, 214, 220});

    // Instances as placeholder quads, coloured by object type.
    for (const SceneInstanceDef& inst : scene->instances) {
        const Vec2 pos = inst.transform.position;
        const Vec2 scl = inst.transform.scale;
        const float w = 48.f * (scl.x == 0.f ? 1.f : scl.x);
        const float h = 48.f * (scl.y == 0.f ? 1.f : scl.y);
        const Rectangle box{pos.x - w * 0.5f, pos.y - h * 0.5f, w, h};

        // A hidden sprite renderer dims the placeholder; an assigned image asset
        // adds an inner accent — so the viewport visibly reflects the component.
        // Resolved (override > object type) so inherited sprites also show.
        const SpriteRenderView sprite = resolveSpriteRenderer(document, sceneId, inst.id);
        const float alpha = (sprite.present && !sprite.visible) ? 0.28f : 0.92f;
        const auto a8 = static_cast<unsigned char>(alpha * 255.f);

        const Vec3* fill = fillFor(document, inst.objectTypeId);
        DrawRectangleRec(box, fill ? toColor(*fill, alpha) : Color{120, 124, 132, a8});
        DrawRectangleLinesEx(box, 1.f / cam.zoom, Color{12, 14, 18, 200});

        if (sprite.present && !sprite.assetId.empty()) {
            const Rectangle inner{box.x + w * 0.3f, box.y + h * 0.3f, w * 0.4f, h * 0.4f};
            DrawRectangleRec(inner, Color{86, 134, 214, a8});
        }

        if (inst.id == selection.primaryEntity) {
            const Rectangle sel = Rectangle{box.x - 3.f, box.y - 3.f, box.width + 6.f, box.height + 6.f};
            DrawRectangleLinesEx(sel, 2.f / cam.zoom, Color{240, 196, 72, 255});
        }
    }

    EndMode2D();

    // Scene label in screen space (top-left of the viewport).
    DrawText(scene->name.c_str(), rect.x + 12, rect.y + 10, 16, Color{150, 200, 255, 230});

    EndScissorMode();
}

} // namespace ArtCade::EditorNative

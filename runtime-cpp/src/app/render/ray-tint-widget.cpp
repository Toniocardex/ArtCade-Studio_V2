#include "ray-tint-widget.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <raylib.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include <algorithm>
#include <cmath>

namespace ArtCade::RayTintWidget {

namespace {

struct Rgb { float r = 1.f, g = 1.f, b = 1.f; };
struct Hsv { float h = 0.f, s = 0.f, v = 1.f; };

enum class DragTarget { None, Hue, SatVal, Apply, Cancel };

Modules::RuntimeEntityGateway* s_gateway = nullptr;
bool     s_active     = false;
EntityId s_entityId   = 0u;
Rgb      s_working    {};
Rgb      s_snapshot   {};
DragTarget s_drag     = DragTarget::None;

constexpr float kPanelW = 220.f;
constexpr float kPanelH = 148.f;
constexpr float kMargin = 12.f;

struct PanelLayout {
    float x = 0.f, y = 0.f;
    Rectangle preview{};
    Rectangle hueBar{};
    Rectangle svBox{};
    Rectangle applyBtn{};
    Rectangle cancelBtn{};
};

PanelLayout layout() {
    const float sw = static_cast<float>(GetScreenWidth());
    PanelLayout L;
    L.x = sw - kPanelW - kMargin;
    L.y = kMargin;
    const float px = L.x + 10.f;
    const float py = L.y + 10.f;
    L.preview   = { px, py, 48.f, 28.f };
    L.hueBar    = { px, py + 34.f, kPanelW - 20.f, 14.f };
    L.svBox     = { px, py + 52.f, kPanelW - 20.f, 72.f };
    L.applyBtn  = { px, py + 128.f, 88.f, 22.f };
    L.cancelBtn = { px + 98.f, py + 128.f, 88.f, 22.f };
    return L;
}

bool hit(const Rectangle& r, float x, float y) {
    return CheckCollisionPointRec({ x, y }, r);
}

Rgb rgbFromHsv(const Hsv& hsv) {
    const float h6 = hsv.h * 6.f;
    const int   i  = static_cast<int>(std::floor(h6)) % 6;
    const float f  = h6 - std::floor(h6);
    const float p  = hsv.v * (1.f - hsv.s);
    const float q  = hsv.v * (1.f - f * hsv.s);
    const float t  = hsv.v * (1.f - (1.f - f) * hsv.s);
    switch (i) {
    case 0: return { hsv.v, t, p };
    case 1: return { q, hsv.v, p };
    case 2: return { p, hsv.v, t };
    case 3: return { p, q, hsv.v };
    case 4: return { t, p, hsv.v };
    default: return { hsv.v, p, q };
    }
}

Hsv hsvFromRgb(const Rgb& rgb) {
    const float maxC = std::max({ rgb.r, rgb.g, rgb.b });
    const float minC = std::min({ rgb.r, rgb.g, rgb.b });
    const float d    = maxC - minC;
    Hsv out;
    out.v = maxC;
    if (maxC <= 1e-5f) {
        out.h = 0.f;
        out.s = 0.f;
        return out;
    }
    out.s = d / maxC;
    if (d <= 1e-5f) {
        out.h = 0.f;
        return out;
    }
    if (maxC == rgb.r)
        out.h = (rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6.f : 0.f);
    else if (maxC == rgb.g)
        out.h = (rgb.b - rgb.r) / d + 2.f;
    else
        out.h = (rgb.r - rgb.g) / d + 4.f;
    out.h /= 6.f;
    if (out.h < 0.f) out.h += 1.f;
    return out;
}

void pushWorkingToGateway() {
    if (!s_gateway || s_entityId == 0u) return;
    s_gateway->setSpriteFillColor(s_entityId, s_working.r, s_working.g, s_working.b);
}

void setWorkingRgb(const Rgb& rgb) {
    s_working.r = std::clamp(rgb.r, 0.f, 1.f);
    s_working.g = std::clamp(rgb.g, 0.f, 1.f);
    s_working.b = std::clamp(rgb.b, 0.f, 1.f);
    pushWorkingToGateway();
}

void drawHueBar(const Rectangle& bar) {
    const int steps = static_cast<int>(bar.width);
    for (int i = 0; i < steps; ++i) {
        const float t = static_cast<float>(i) / static_cast<float>(std::max(1, steps - 1));
        const Color c = ColorFromHSV(t * 360.f, 1.f, 1.f);
        DrawRectangle(static_cast<int>(bar.x) + i, static_cast<int>(bar.y),
                      1, static_cast<int>(bar.height), c);
    }
}

void drawSvBox(const Rectangle& box, float hue) {
    const int gw = static_cast<int>(box.width);
    const int gh = static_cast<int>(box.height);
    for (int y = 0; y < gh; ++y) {
        const float v = 1.f - static_cast<float>(y) / static_cast<float>(std::max(1, gh - 1));
        for (int x = 0; x < gw; ++x) {
            const float s = static_cast<float>(x) / static_cast<float>(std::max(1, gw - 1));
            const Color c = ColorFromHSV(hue * 360.f, s, v);
            DrawPixel(static_cast<int>(box.x) + x, static_cast<int>(box.y) + y, c);
        }
    }
}

void drawButton(const Rectangle& r, const char* label, bool accent) {
    const Color bg = accent ? Color{ 90, 140, 100, 255 } : Color{ 55, 58, 64, 255 };
    DrawRectangleRec(r, bg);
    DrawRectangleLinesEx(r, 1.f, Color{ 180, 185, 195, 255 });
    const int tw = MeasureText(label, 14);
    DrawText(label,
             static_cast<int>(r.x + (r.width - tw) * 0.5f),
             static_cast<int>(r.y + (r.height - 14) * 0.5f),
             14, RAYWHITE);
}

} // namespace

bool isActive() { return s_active; }

bool open(Modules::RuntimeEntityGateway* gateway, EntityId entityId) {
    if (!gateway || entityId == 0u) return false;
    SpriteComponent sprite{};
    if (!gateway->getSprite(entityId, sprite)) return false;
    if (!sprite.spriteAssetId.empty()) return false;

    s_gateway   = gateway;
    s_entityId  = entityId;
    s_snapshot  = { sprite.fillColor.x, sprite.fillColor.y, sprite.fillColor.z };
    s_working   = s_snapshot;
    s_drag      = DragTarget::None;
    s_active    = true;
    return true;
}

void close(bool apply) {
    if (!s_active) return;
    if (!apply && s_gateway && s_entityId != 0u)
        s_gateway->setSpriteFillColor(s_entityId, s_snapshot.r, s_snapshot.g, s_snapshot.b);
    if (apply && s_entityId != 0u)
        EditorAPI::notifySpriteFillColor(s_entityId, s_working.r, s_working.g, s_working.b);

    s_active   = false;
    s_entityId = 0u;
    s_gateway  = nullptr;
    s_drag     = DragTarget::None;
}

bool onMouseDown(float screenX, float screenY) {
    if (!s_active) return false;
    const PanelLayout L = layout();
    if (hit(L.applyBtn, screenX, screenY)) {
        close(true);
        return true;
    }
    if (hit(L.cancelBtn, screenX, screenY)) {
        close(false);
        return true;
    }
    if (hit(L.hueBar, screenX, screenY)) {
        s_drag = DragTarget::Hue;
        onMouseMove(screenX, screenY);
        return true;
    }
    if (hit(L.svBox, screenX, screenY)) {
        s_drag = DragTarget::SatVal;
        onMouseMove(screenX, screenY);
        return true;
    }
    // Consume clicks inside panel chrome so scene does not pick through.
    const Rectangle panel = { L.x, L.y, kPanelW, kPanelH };
    return hit(panel, screenX, screenY);
}

bool onMouseMove(float screenX, float screenY) {
    if (!s_active || s_drag == DragTarget::None) return s_active;
    const PanelLayout L = layout();
    Hsv hsv = hsvFromRgb(s_working);

    if (s_drag == DragTarget::Hue) {
        const float t = (screenX - L.hueBar.x) / std::max(1.f, L.hueBar.width);
        hsv.h = std::clamp(t, 0.f, 1.f);
        setWorkingRgb(rgbFromHsv(hsv));
        return true;
    }
    if (s_drag == DragTarget::SatVal) {
        const float s = (screenX - L.svBox.x) / std::max(1.f, L.svBox.width);
        const float v = 1.f - (screenY - L.svBox.y) / std::max(1.f, L.svBox.height);
        hsv.s = std::clamp(s, 0.f, 1.f);
        hsv.v = std::clamp(v, 0.f, 1.f);
        setWorkingRgb(rgbFromHsv(hsv));
        return true;
    }
    return false;
}

bool onMouseUp(float screenX, float screenY) {
    (void)screenX;
    (void)screenY;
    if (!s_active) return false;
    s_drag = DragTarget::None;
    return true;
}

void draw() {
    if (!s_active) return;

    const PanelLayout L = layout();
    const Hsv hsv = hsvFromRgb(s_working);

    DrawRectangle(static_cast<int>(L.x), static_cast<int>(L.y),
                  static_cast<int>(kPanelW), static_cast<int>(kPanelH),
                  Color{ 32, 34, 38, 245 });
    DrawRectangleLines(static_cast<int>(L.x), static_cast<int>(L.y),
                       static_cast<int>(kPanelW), static_cast<int>(kPanelH),
                       Color{ 120, 125, 135, 255 });

    const Color preview = Color{
        static_cast<unsigned char>(s_working.r * 255.f),
        static_cast<unsigned char>(s_working.g * 255.f),
        static_cast<unsigned char>(s_working.b * 255.f),
        255 };
    DrawRectangleRec(L.preview, preview);
    DrawRectangleLinesEx(L.preview, 1.f, Color{ 180, 185, 195, 255 });

    drawHueBar(L.hueBar);
    DrawRectangleLinesEx(L.hueBar, 1.f, Color{ 180, 185, 195, 255 });
    const float hueX = L.hueBar.x + hsv.h * L.hueBar.width;
    DrawRectangle(static_cast<int>(hueX) - 1, static_cast<int>(L.hueBar.y) - 2,
                  3, static_cast<int>(L.hueBar.height) + 4, RAYWHITE);

    drawSvBox(L.svBox, hsv.h);
    DrawRectangleLinesEx(L.svBox, 1.f, Color{ 180, 185, 195, 255 });
    const float svX = L.svBox.x + hsv.s * L.svBox.width;
    const float svY = L.svBox.y + (1.f - hsv.v) * L.svBox.height;
    DrawCircleV({ svX, svY }, 4.f, RAYWHITE);
    DrawCircleV({ svX, svY }, 3.f, BLACK);

    drawButton(L.applyBtn, "Apply", true);
    drawButton(L.cancelBtn, "Cancel", false);
}

} // namespace ArtCade::RayTintWidget

#ifdef __EMSCRIPTEN__
extern "C" {

EMSCRIPTEN_KEEPALIVE void editor_open_raytint(uint32_t entityId) {
    ArtCade::RayTintWidget::open(ArtCade::EditorAPI::s_entityGateway, entityId);
}

EMSCRIPTEN_KEEPALIVE void editor_close_raytint(int apply) {
    ArtCade::RayTintWidget::close(apply != 0);
}

} // extern "C"
#endif

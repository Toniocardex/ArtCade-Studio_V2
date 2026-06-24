#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"
#include "../../modules/sprite-animator/include/sprite-animator.h"
#include "../../modules/time/include/time-manager.h"
#include "../render/editor-overlay-renderer.h"
#include "../render/parallax-renderer.h"
#include "../render/physics_debug_renderer.h"
#include "../render/ray-tint-widget.h"
#include "../render/text_value_formatter.h"
#include "../render/tilemap-renderer.h"

#include <algorithm>
#include <cmath>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade {

namespace {

// C++ source of truth for the Text label 3×3 anchor grid. Mirrors
// editor/src/utils/text-anchor.ts.
//
// Convention: anchor = the direction the text FLOWS from the entity position.
//   "bottom-right" → text flows down-right  → entity at top-left of text
//   "top-left"     → text flows up-left     → entity at bottom-right of text
//   "center"       → text centered on entity
//
//   hOut: 0 = left-align (text to the right), 1 = centred, 2 = right-align (text to the left)
//   vOut: 0 = top-align (text below),         1 = middle,  2 = bottom-align (text above)
void textAnchorAlign(const std::string& a, int& hOut, int& vOut) {
    // "left" → text flows LEFT  → entity at right edge  → hAlign=2 (right-align at pos)
    // "right"→ text flows RIGHT → entity at left edge   → hAlign=0 (left-align at pos)
    if (a.find("left") != std::string::npos)        hOut = 2;
    else if (a.find("right") != std::string::npos)  hOut = 0;
    else                                            hOut = 1;

    // "top"   → text flows UP   → entity at bottom edge → vAlign=2 (bottom-align at pos)
    // "bottom"→ text flows DOWN → entity at top edge    → vAlign=0 (top-align at pos)
    // New 9-anchor values always have a hyphen or are exactly "center".
    // Legacy bare "left"/"right" (no hyphen) → vAlign=0 (text below, old behaviour).
    const bool isNewAnchor = a.find('-') != std::string::npos || a == "center";
    if (a.find("top") != std::string::npos)         vOut = 2;
    else if (a.find("bottom") != std::string::npos) vOut = 0;
    else if (isNewAnchor)                           vOut = 1; // center-left/right/"center"
    else                                            vOut = 0; // legacy left/right
}

bool hasSpriteFrame(const Modules::SpriteAnimator::Frame& frame) {
    return frame.w > 0 && frame.h > 0;
}

/** Frame to draw plus the sheet it belongs to. A clip's frame rects are valid
 *  only on the clip's own sheet, so while a clip is active the renderer must
 *  follow `assetId` rather than the entity's static sprite — this is what lets
 *  one object animate across sheets. Empty `assetId` → use the entity's sprite. */
struct ResolvedSpriteDraw {
    Modules::SpriteAnimator::Frame frame{};
    std::string assetId;
};

ResolvedSpriteDraw resolveSpriteFrame(
    const Modules::SpriteAnimator* animator,
    EntityId id,
    const SpriteComponent& sprite,
    bool inEditMode)
{
    if (!animator) return {};

    const auto current = animator->currentFrame(id);
    if (hasSpriteFrame(current))
        return { current, animator->currentClipAssetId(id) };

    if (inEditMode && !sprite.defaultClip.empty())
        return { animator->clipFrame(sprite.defaultClip, 0),
                 animator->clipAssetId(sprite.defaultClip) };

    if (!sprite.spriteAssetId.empty())
        return { animator->firstFrameForAsset(sprite.spriteAssetId),
                 sprite.spriteAssetId };

    return {};
}

std::optional<Vec2> visualSizeForFrame(
    const Modules::SpriteAnimator::Frame& frame,
    const Vec2& scale)
{
    if (!hasSpriteFrame(frame)) return std::nullopt;
    return Vec2{
        static_cast<float>(frame.w) * std::abs(scale.x),
        static_cast<float>(frame.h) * std::abs(scale.y),
    };
}

} // namespace

void Application::renderActiveScene() {
    const SceneDef* activeScene = mod_->sceneManager->activeScene();
    const Vec4 clearColor = {0.015f, 0.018f, 0.025f, 1.f};

    mod_->renderer->setRenderShakeOffset(mod_->cameraManager->shakeOffset());

#ifdef ARTCADE_WASM
    const EditorOverlayState overlay{
        EditorAPI::s_mode == 0,
        EditorAPI::s_editorGuidesEnabled,
        EditorAPI::s_editorGridSize,
        EditorAPI::s_selectedEntityId,
    };
    std::vector<EntityId> selectedEntityIds = EditorAPI::s_selectedEntityIds;
    if (selectedEntityIds.empty() && EditorAPI::s_selectedEntityId != 0u)
        selectedEntityIds.push_back(EditorAPI::s_selectedEntityId);
#else
    const EditorOverlayState overlay{false, false, 0.f, 0u};
    std::vector<EntityId> selectedEntityIds;
#endif

    mod_->renderer->beginFrame(clearColor);

    if (activeScene) {
        EditorOverlayRenderer::drawBackdrop(*mod_->renderer, *activeScene, overlay);
        mod_->renderer->drawRectImmediate(
            0.f, 0.f,
            std::max(1.f, activeScene->worldSize.x),
            std::max(1.f, activeScene->worldSize.y),
            activeScene->backgroundColor);
        ParallaxRenderer::draw(
            *mod_->renderer,
            mod_->sceneManager->sceneLayers(),
            mod_->renderer->getCameraPosition(),
            mod_->renderer->visibleWorldSize(),
            mod_->timeManager ? mod_->timeManager->now() : 0.f);
        TilemapRenderer::draw(
            *mod_->renderer, *activeScene, mod_->sceneManager->sceneLayers(),
            mod_->sceneManager->tilesets(), tilesets_, tileColors_);
        EditorOverlayRenderer::drawGrid(*mod_->renderer, *activeScene, overlay);
    }

    const bool inEditMode = overlay.inEditMode;

    // Per-layer parallax offset (play mode only): entities on a layer whose
    // factor ≠ 1 are drawn shifted so they scroll slower/faster than the world,
    // mirroring ParallaxRenderer's math under the single world Camera2D. Edit
    // mode keeps true positions so picking/dragging stay aligned.
    std::unordered_map<std::string, SceneLayerDef> layerByName;
    std::unordered_map<std::string, Vec2> parallaxByLayer;
    if (activeScene) {
        for (const auto& layer : mod_->sceneManager->sceneLayers()) {
            layerByName.emplace(layer.name, layer);
            if (layer.parallax.x != 1.f || layer.parallax.y != 1.f)
                parallaxByLayer.emplace(layer.name, Vec2{ layer.parallax.x, layer.parallax.y });
        }
    }
    const Vec2 cameraTopLeft = mod_->renderer->getCameraPosition();
    const auto layerDrawPos =
        [&parallaxByLayer, cameraTopLeft, inEditMode]
        (const std::string& layer, const Vec2& worldPos) -> Vec2 {
            if (inEditMode || layer.empty()) return worldPos;
            const auto it = parallaxByLayer.find(layer);
            if (it == parallaxByLayer.end()) return worldPos;
            return {
                worldPos.x + cameraTopLeft.x * (1.f - it->second.x),
                worldPos.y + cameraTopLeft.y * (1.f - it->second.y),
            };
        };

    mod_->entityGateway->forEachActiveRenderable(
        [renderer = mod_->renderer.get(),
         animator = mod_->spriteAnimator.get(),
         inEditMode,
         gateway = mod_->entityGateway.get(),
         variables = mod_->variableManager.get(),
         &layerByName,
         &layerDrawPos]
        (EntityId id, const Transform& transform, const SpriteComponent& sprite) {
            if (!inEditMode && sprite.alpha <= 0.001f) return;
            const auto layerIt = layerByName.find(sprite.layer);
            const SceneLayerDef* layer = layerIt != layerByName.end() ? &layerIt->second : nullptr;
            if (layer && (!layer->visible || layer->opacity <= 0.f)) return;

            const Vec2 pos = layerDrawPos(sprite.layer, transform.position);

            float alpha = sprite.alpha;
            if (layer) alpha *= layer->opacity;
            const bool placeholderFill = sprite.spriteAssetId.empty();
            if (inEditMode && !placeholderFill && !gateway->visibleInGame(id)) {
                alpha *= 0.45f;
            }
            if (inEditMode && placeholderFill) alpha = layer ? layer->opacity : 1.f;

            TextComponent text{};
            const bool hasText = gateway->getText(id, text)
                && (!text.text.empty() || !text.bindKey.empty());

            // An entity that carries its own visual (text label or gauge bar)
            // shouldn't also paint the default placeholder square — in the editor
            // the opaque square sits over the text/gauge and makes HUD layout
            // impossible, and in game it's just clutter. Suppress it in BOTH
            // modes when there's no real sprite. (Picking uses a fixed hit box,
            // not the drawn square, so the entity stays selectable/draggable.)
            GaugeComponent gaugeProbe{};
            const bool hasGauge = gateway->getGauge(id, gaugeProbe)
                && gaugeProbe.width > 0.f && gaugeProbe.height > 0.f;
            const bool visualOnly = placeholderFill && (hasText || hasGauge);

            const auto draw = resolveSpriteFrame(animator, id, sprite, inEditMode);
            if (hasSpriteFrame(draw.frame)) {
                const std::string& sheet =
                    draw.assetId.empty() ? sprite.spriteAssetId : draw.assetId;
                renderer->drawSpriteFrame(
                    sheet,
                    static_cast<float>(draw.frame.x),
                    static_cast<float>(draw.frame.y),
                    static_cast<float>(draw.frame.w),
                    static_cast<float>(draw.frame.h),
                    pos, transform.rotation, transform.scale,
                    sprite.tint, alpha, sprite.pivot, sprite.flipX, sprite.flipY);
            } else if (!visualOnly) {
                renderer->drawSprite(
                    sprite.spriteAssetId,
                    pos, transform.rotation, transform.scale,
                    sprite.tint, sprite.fillColor, alpha,
                    sprite.shaderEffect, sprite.pivot, sprite.flipX, sprite.flipY);
            }

            if (!hasText) return;
            std::string display = text.text;
            const bool hasBoundValue = !text.bindKey.empty() && variables
                && (text.bindScope == "local"
                    ? variables->entityExists(id, text.bindKey)
                    : variables->exists(text.bindKey));
            if (hasBoundValue) {
                const auto boundValue = text.bindScope == "local"
                    ? variables->getEntity(id, text.bindKey)
                    : variables->get(text.bindKey);
                display = text.prefix
                    + AppRender::formatTextValue(
                        boundValue, text.format, text.digits)
                    + text.suffix;
            } else if (!text.bindKey.empty()) {
                display = text.prefix + text.text + text.suffix;
            }

            Vec4 color = text.color;
            if (layer) color.a *= layer->opacity;
            if (inEditMode && !gateway->visibleInGame(id)) color.a *= 0.45f;
            int hAlign = 0, vAlign = 0;
            textAnchorAlign(text.align, hAlign, vAlign);
            renderer->drawText(
                display,
                pos.x + text.offsetX,
                pos.y + text.offsetY,
                text.size, color, text.fontPath, hAlign, text.screenSpace,
                vAlign);
        });

    // Gauges (health / progress). Drawn after sprites; fill tracks the
    // bound variable. When the variable is absent (edit mode) the bar is full.
    mod_->entityGateway->forEachActiveRenderable(
        [renderer = mod_->renderer.get(),
         inEditMode,
         gateway = mod_->entityGateway.get(),
         variables = mod_->variableManager.get(),
         &layerByName,
         &layerDrawPos]
        (EntityId id, const Transform& transform, const SpriteComponent& sprite) {
            const auto layerIt = layerByName.find(sprite.layer);
            const SceneLayerDef* layer = layerIt != layerByName.end() ? &layerIt->second : nullptr;
            if (layer && (!layer->visible || layer->opacity <= 0.f)) return;
            GaugeComponent gauge{};
            if (!gateway->getGauge(id, gauge)) return;
            if (gauge.width <= 0.f || gauge.height <= 0.f) return;

            float value = gauge.maxValue;
            const bool hasBoundValue = !gauge.bindKey.empty() && variables
                && (gauge.bindScope == "local"
                    ? variables->entityExists(id, gauge.bindKey)
                    : variables->exists(gauge.bindKey));
            if (hasBoundValue) {
                const auto boundValue = gauge.bindScope == "local"
                    ? variables->getEntity(id, gauge.bindKey)
                    : variables->get(gauge.bindKey);
                value = static_cast<float>(
                    AppRender::variableToNumber(boundValue));
            }
            float ratio = gauge.maxValue > 0.f ? value / gauge.maxValue : 0.f;
            ratio = std::clamp(ratio, 0.f, 1.f);

            Vec4 bg = gauge.bgColor;
            Vec4 fill = gauge.fillColor;
            if (layer) {
                bg.a *= layer->opacity;
                fill.a *= layer->opacity;
            }
            if (inEditMode && !gateway->visibleInGame(id)) {
                bg.a *= 0.45f;
                fill.a *= 0.45f;
            }
            const Vec2 gpos = layerDrawPos(sprite.layer, transform.position);
            const float gx = gpos.x + gauge.offsetX;
            const float gy = gpos.y + gauge.offsetY;
            renderer->drawRect(gx, gy, gauge.width, gauge.height, bg, gauge.screenSpace);
            if (gauge.direction == "vertical") {
                const float fh = gauge.height * ratio;
                renderer->drawRect(gx, gy + (gauge.height - fh), gauge.width, fh,
                                   fill, gauge.screenSpace);
            } else {
                renderer->drawRect(gx, gy, gauge.width * ratio, gauge.height,
                                   fill, gauge.screenSpace);
            }
        });

    const float fade = mod_->entityGateway->sceneFadeAlpha();
    if (fade > 0.f) mod_->renderer->drawFadeOverlay(fade);

    // The camera viewport outline is owned by the editor (dashed DOM overlay in
    // CameraFrameOverlay.tsx), not the runtime: a DOM rectangle stays crisp and
    // exactly scaled at every zoom, where a framebuffer outline went sub-pixel.

    if (overlay.inEditMode) {
        mod_->entityGateway->forEachActiveHiddenInGame(
            [renderer = mod_->renderer.get(),
             gateway = mod_->entityGateway.get(),
             animator = mod_->spriteAnimator.get(),
             &selectedEntityIds]
            (EntityId id, const Transform& transform, const PhysicsComponent&) {
                if (std::find(selectedEntityIds.begin(), selectedEntityIds.end(), id)
                    != selectedEntityIds.end()) return;
                SpriteComponent sprite{};
                if (!gateway->getSprite(id, sprite)) return;
                const auto draw = resolveSpriteFrame(animator, id, sprite, true);
                EditorOverlayRenderer::drawHiddenInGameOutline(
                    *renderer, transform, sprite,
                    visualSizeForFrame(draw.frame, transform.scale));
            });
    }

    for (const EntityId selectedId : selectedEntityIds) {
        Transform transform{};
        SpriteComponent sprite{};
        SensorComponent sensorValue{};
        std::optional<SensorComponent> sensor;
        if (mod_->entityGateway->getSensor(selectedId, sensorValue)) {
            sensor = sensorValue;
        }
        if (mod_->entityGateway->getTransform(selectedId, transform)
            && mod_->entityGateway->getSprite(selectedId, sprite)) {
            const bool hiddenInGame =
                !mod_->entityGateway->visibleInGame(selectedId);
            const auto draw = resolveSpriteFrame(
                mod_->spriteAnimator.get(), selectedId, sprite, overlay.inEditMode);
            EditorOverlayState itemOverlay = overlay;
            itemOverlay.selectedId = selectedId;
            EditorOverlayRenderer::drawSelection(
                *mod_->renderer, transform, sprite, sensor, itemOverlay, hiddenInGame,
                visualSizeForFrame(draw.frame, transform.scale));
        }
    }

    if (splash_) {
        splash_->render(
            static_cast<int>(mod_->renderer->windowWidth()),
            static_cast<int>(mod_->renderer->windowHeight()));
    }
    if (mod_->dialogManager && mod_->dialogManager->isActive()) {
        mod_->dialogManager->render();
    }
    if (EditorAPI::s_physicsDebugDraw && !overlay.inEditMode && mod_->physics) {
        AppRender::drawPhysicsDebug(
            *mod_->renderer, *mod_->entityGateway, *mod_->physics);
    }

    mod_->renderer->endWorldPass();
    mod_->renderer->endScreenPass();
    RayTintWidget::draw();
    mod_->renderer->presentScreen();
    mod_->renderer->setRenderShakeOffset({0.f, 0.f});
}

} // namespace ArtCade

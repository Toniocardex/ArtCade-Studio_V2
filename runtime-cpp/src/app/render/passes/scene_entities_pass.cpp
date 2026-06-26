#include "scene_entities_pass.h"

#include "../sprite_frame_resolve.h"
#include "../text_value_formatter.h"
#include "../../../modules/renderer/include/renderer.h"
#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/scene-system/include/scene-manager.h"
#include "../../../modules/sprite-animator/include/sprite-animator.h"
#include "../../../modules/variable-manager/include/variable-manager.h"

#include <algorithm>
#include <cmath>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::AppRenderPasses {

namespace {

using Modules::SpriteAnimator;

void textAnchorAlign(const std::string& a, int& hOut, int& vOut) {
    if (a.find("left") != std::string::npos)        hOut = 2;
    else if (a.find("right") != std::string::npos)  hOut = 0;
    else                                            hOut = 1;

    const bool isNewAnchor = a.find('-') != std::string::npos || a == "center";
    if (a.find("top") != std::string::npos)         vOut = 2;
    else if (a.find("bottom") != std::string::npos) vOut = 0;
    else if (isNewAnchor)                           vOut = 1;
    else                                            vOut = 0;
}

struct LayeredRenderable {
    EntityId id = 0;
    Transform transform{};
    SpriteComponent sprite{};
    int layerPriority = 0;
    size_t insertionIndex = 0u;
};

} // namespace

void execute_scene_entities_pass(SceneFrameContext& ctx) {
    if (!ctx.activeScene || !ctx.entityGateway || !ctx.sceneManager
        || !ctx.renderer)
        return;

    const bool inEditMode = ctx.overlay.inEditMode;
    std::unordered_map<std::string, SceneLayerSettings> settingsById;
    std::unordered_map<std::string, int> layerRankById;
    std::unordered_map<std::string, Vec2> parallaxById;

    const auto& layers = ctx.sceneManager->sceneLayers();
    const int layerCount = static_cast<int>(layers.size());
    for (size_t i = 0; i < layers.size(); ++i) {
        const auto& layer = layers[i];
        SceneLayerSettings settings;
        const auto sit = ctx.activeScene->layerSettings.find(layer.id);
        if (sit != ctx.activeScene->layerSettings.end())
            settings = sit->second;
        settingsById.emplace(layer.id, settings);
        layerRankById.emplace(layer.id, layerCount - static_cast<int>(i));
        if (settings.parallax.x != 1.f || settings.parallax.y != 1.f)
            parallaxById.emplace(
                layer.id, Vec2{ settings.parallax.x, settings.parallax.y });
    }

    const Vec2 cameraTopLeft = ctx.renderer->getCameraPosition();
    const auto layerDrawPos =
        [&parallaxById, cameraTopLeft, inEditMode]
        (const std::string& layerId, const Vec2& worldPos) -> Vec2 {
            if (inEditMode || layerId.empty()) return worldPos;
            const auto it = parallaxById.find(layerId);
            if (it == parallaxById.end()) return worldPos;
            return {
                worldPos.x + cameraTopLeft.x * (1.f - it->second.x),
                worldPos.y + cameraTopLeft.y * (1.f - it->second.y),
            };
        };

    std::vector<LayeredRenderable> renderables;
    size_t renderableIndex = 0u;
    ctx.entityGateway->forEachActiveRenderable(
        [&renderables, &layerRankById, &renderableIndex]
        (EntityId id, const Transform& transform, const SpriteComponent& sprite) {
            const auto rankIt = layerRankById.find(sprite.layerId);
            renderables.push_back(LayeredRenderable{
                id,
                transform,
                sprite,
                rankIt != layerRankById.end() ? rankIt->second : 0,
                renderableIndex++,
            });
        });
    std::stable_sort(
        renderables.begin(),
        renderables.end(),
        [](const LayeredRenderable& a, const LayeredRenderable& b) {
            if (a.layerPriority != b.layerPriority)
                return a.layerPriority < b.layerPriority;
            if (a.sprite.renderOrder != b.sprite.renderOrder)
                return a.sprite.renderOrder < b.sprite.renderOrder;
            return a.insertionIndex < b.insertionIndex;
        });

    for (const LayeredRenderable& item : renderables) {
        const EntityId id = item.id;
        const Transform& transform = item.transform;
        const SpriteComponent& sprite = item.sprite;
        [renderer = ctx.renderer,
         animator = ctx.spriteAnimator,
         inEditMode,
         gateway = ctx.entityGateway,
         variables = ctx.variableManager,
         &settingsById,
         &layerDrawPos]
        (EntityId id, const Transform& transform, const SpriteComponent& sprite) {
            if (!inEditMode && sprite.alpha <= 0.001f) return;
            const auto layerIt = settingsById.find(sprite.layerId);
            const SceneLayerSettings* layer =
                layerIt != settingsById.end() ? &layerIt->second : nullptr;
            if (layer && (!layer->visible || layer->opacity <= 0.f)) return;

            const Vec2 pos = layerDrawPos(sprite.layerId, transform.position);

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

            GaugeComponent gaugeProbe{};
            const bool hasGauge = gateway->getGauge(id, gaugeProbe)
                && gaugeProbe.width > 0.f && gaugeProbe.height > 0.f;
            const bool visualOnly = placeholderFill && (hasText || hasGauge);

            const auto draw = AppRender::sprite_frame_resolve(animator, id, sprite, inEditMode);
            if (AppRender::sprite_frame_has_pixels(draw.frame)) {
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
        }(id, transform, sprite);
    }

    for (const LayeredRenderable& item : renderables) {
        const EntityId id = item.id;
        const Transform& transform = item.transform;
        const SpriteComponent& sprite = item.sprite;
        [renderer = ctx.renderer,
         inEditMode,
         gateway = ctx.entityGateway,
         variables = ctx.variableManager,
         &settingsById,
         &layerDrawPos]
        (EntityId id, const Transform& transform, const SpriteComponent& sprite) {
            const auto layerIt = settingsById.find(sprite.layerId);
            const SceneLayerSettings* layer =
                layerIt != settingsById.end() ? &layerIt->second : nullptr;
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
            const Vec2 gpos = layerDrawPos(sprite.layerId, transform.position);
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
        }(id, transform, sprite);
    }

    if (ctx.sceneFadeAlpha > 0.f)
        ctx.renderer->drawFadeOverlay(ctx.sceneFadeAlpha);
}

} // namespace ArtCade::AppRenderPasses

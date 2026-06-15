#include "../include/app.h"

#include "app_modules.h"

#include "../../modules/editor-api/include/editor-api.h"
#include "../../modules/game-state/include/splash-state.h"
#include "../render/editor-overlay-renderer.h"
#include "../render/physics_debug_renderer.h"
#include "../render/ray-tint-widget.h"
#include "../render/text_value_formatter.h"
#include "../render/tilemap-renderer.h"

#include <algorithm>
#include <optional>
#include <string>

namespace ArtCade {

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
#else
    const EditorOverlayState overlay{false, false, 0.f, 0u};
#endif

    mod_->renderer->beginFrame(clearColor);

    if (activeScene) {
        EditorOverlayRenderer::drawBackdrop(*mod_->renderer, *activeScene, overlay);
        mod_->renderer->drawRectImmediate(
            0.f, 0.f,
            std::max(1.f, activeScene->worldSize.x),
            std::max(1.f, activeScene->worldSize.y),
            activeScene->backgroundColor);
        TilemapRenderer::draw(
            *mod_->renderer, *activeScene, mod_->sceneManager->tilesets(),
            tilesets_, tileColors_);
        EditorOverlayRenderer::drawGrid(*mod_->renderer, *activeScene, overlay);
    }

    const bool inEditMode = overlay.inEditMode;
    mod_->entityGateway->forEachActiveRenderable(
        [renderer = mod_->renderer.get(),
         animator = mod_->spriteAnimator.get(),
         inEditMode,
         gateway = mod_->entityGateway.get(),
         variables = mod_->variableManager.get()]
        (EntityId id, const Transform& transform, const SpriteComponent& sprite) {
            if (!inEditMode && sprite.alpha <= 0.001f) return;

            float alpha = sprite.alpha;
            const bool placeholderFill = sprite.spriteAssetId.empty();
            if (inEditMode && !placeholderFill && !gateway->visibleInGame(id)) {
                alpha *= 0.45f;
            }
            if (inEditMode && placeholderFill) alpha = 1.f;

            TextComponent text{};
            const bool hasText = gateway->getText(id, text)
                && (!text.text.empty() || !text.bindKey.empty());
            const bool textOnly = hasText && placeholderFill;

            const auto frame = animator
                ? animator->currentFrame(id)
                : ::ArtCade::Modules::SpriteAnimator::Frame{};
            if (frame.w > 0 && frame.h > 0) {
                renderer->drawSpriteFrame(
                    sprite.spriteAssetId,
                    static_cast<float>(frame.x),
                    static_cast<float>(frame.y),
                    static_cast<float>(frame.w),
                    static_cast<float>(frame.h),
                    transform.position, transform.rotation, transform.scale,
                    sprite.tint, alpha, sprite.pivot);
            } else if (!textOnly || inEditMode) {
                renderer->drawSprite(
                    sprite.spriteAssetId,
                    transform.position, transform.rotation, transform.scale,
                    sprite.tint, sprite.fillColor, alpha,
                    sprite.shaderEffect, sprite.pivot);
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
            if (inEditMode && !gateway->visibleInGame(id)) color.a *= 0.45f;
            const int alignment = text.align == "center" ? 1
                : text.align == "right" ? 2
                : 0;
            renderer->drawText(
                display,
                transform.position.x + text.offsetX,
                transform.position.y + text.offsetY,
                text.size, color, text.fontPath, alignment, text.screenSpace);
        });

    // Gauges (health / progress). Drawn after sprites; fill tracks the
    // bound variable. When the variable is absent (edit mode) the bar is full.
    mod_->entityGateway->forEachActiveRenderable(
        [renderer = mod_->renderer.get(),
         inEditMode,
         gateway = mod_->entityGateway.get(),
         variables = mod_->variableManager.get()]
        (EntityId id, const Transform& transform, const SpriteComponent&) {
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
            if (inEditMode && !gateway->visibleInGame(id)) {
                bg.a *= 0.45f;
                fill.a *= 0.45f;
            }
            const float gx = transform.position.x + gauge.offsetX;
            const float gy = transform.position.y + gauge.offsetY;
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
             selectedId = overlay.selectedId]
            (EntityId id, const Transform& transform, const PhysicsComponent&) {
                if (id == selectedId) return;
                SpriteComponent sprite{};
                if (!gateway->getSprite(id, sprite)) return;
                EditorOverlayRenderer::drawHiddenInGameOutline(
                    *renderer, transform, sprite);
            });
    }

    if (overlay.selectedId != 0u) {
        Transform transform{};
        SpriteComponent sprite{};
        SensorComponent sensorValue{};
        std::optional<SensorComponent> sensor;
        if (mod_->entityGateway->getSensor(overlay.selectedId, sensorValue)) {
            sensor = sensorValue;
        }
        if (mod_->entityGateway->getTransform(overlay.selectedId, transform)
            && mod_->entityGateway->getSprite(overlay.selectedId, sprite)) {
            const bool hiddenInGame =
                !mod_->entityGateway->visibleInGame(overlay.selectedId);
            EditorOverlayRenderer::drawSelection(
                *mod_->renderer, transform, sprite, sensor, overlay, hiddenInGame);
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

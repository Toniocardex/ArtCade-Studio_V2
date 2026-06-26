#include "gizmo_pass.h"

#include "../editor-overlay-renderer.h"
#include "../../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../../modules/sprite-animator/include/sprite-animator.h"

#include <algorithm>
#include <optional>

namespace ArtCade::AppRenderPasses {

namespace {

using Modules::SpriteAnimator;

bool hasSpriteFrame(const SpriteAnimator::Frame& frame) {
    return frame.w > 0 && frame.h > 0;
}

struct ResolvedSpriteDraw {
    SpriteAnimator::Frame frame{};
    std::string assetId;
};

ResolvedSpriteDraw resolveSpriteFrame(
    const SpriteAnimator* animator,
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
    const SpriteAnimator::Frame& frame,
    const Vec2& scale)
{
    if (!hasSpriteFrame(frame)) return std::nullopt;
    return Vec2{
        static_cast<float>(frame.w) * std::abs(scale.x),
        static_cast<float>(frame.h) * std::abs(scale.y),
    };
}

} // namespace

void execute_gizmo_pass(SceneFrameContext& ctx) {
    if (!ctx.overlay.inEditMode || !ctx.entityGateway || !ctx.selectedEntityIds
        || !ctx.renderer)
        return;

    const bool inEditMode = ctx.overlay.inEditMode;
    auto* renderer = ctx.renderer;
    auto* gateway = ctx.entityGateway;
    auto* animator = ctx.spriteAnimator;
    const auto& selectedEntityIds = *ctx.selectedEntityIds;

    if (inEditMode) {
        ctx.entityGateway->forEachActiveHiddenInGame(
            [renderer, gateway, animator, &selectedEntityIds]
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
        if (!ctx.entityGateway->getTransform(selectedId, transform)
            || !ctx.entityGateway->getSprite(selectedId, sprite)) {
            continue;
        }
        const bool hiddenInGame =
            !ctx.entityGateway->visibleInGame(selectedId);
        CollisionBodyComponent collisionBody{};
        std::optional<CollisionBodyComponent> collisionOverlay;
        if (ctx.entityGateway->getResolvedCollisionBody(selectedId, collisionBody))
            collisionOverlay = collisionBody;
        const auto draw = resolveSpriteFrame(
            ctx.spriteAnimator, selectedId, sprite, ctx.overlay.inEditMode);
        EditorOverlayState itemOverlay = ctx.overlay;
        itemOverlay.selectedId = selectedId;
        EditorOverlayRenderer::drawSelection(
            *ctx.renderer, transform, sprite, itemOverlay, hiddenInGame,
            visualSizeForFrame(draw.frame, transform.scale),
            collisionOverlay);
    }
}

} // namespace ArtCade::AppRenderPasses

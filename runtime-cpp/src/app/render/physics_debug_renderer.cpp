#include "physics_debug_renderer.h"

#include "../../core/types.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/renderer/include/renderer.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <algorithm>
#include <cmath>

namespace ArtCade::AppRender {

void drawPhysicsDebug(Modules::Renderer& renderer,
                      Modules::RuntimeEntityGateway& gateway,
                      Modules::Physics& physics) {
    gateway.forEachActivePhysicsBody(
        [&](EntityId id, uint32_t handle, Transform& transform) {
            PhysicsComponent component{};
            if (!gateway.getPhysicsComponent(id, component)) return;

            const Vec2 position = physics.getPosition(handle);
            const Vec2 velocity = physics.getLinearVelocity(handle);
            const Collider& collider = component.collider;
            const float scaleX = std::abs(transform.scale.x);
            const float scaleY = std::abs(transform.scale.y);
            const float offsetX = collider.offset.x * scaleX;
            const float offsetY = collider.offset.y * scaleY;

            Vec4 color{0.2f, 1.f, 0.35f, 0.55f};
            if (component.bodyType == BodyType::Static) {
                color = {0.5f, 0.7f, 1.f, 0.5f};
            }

            if (collider.shape == ColliderShape::Circle) {
                const float radius = collider.size.x * std::max(scaleX, scaleY);
                renderer.drawCircle(position.x + offsetX, position.y + offsetY, radius, color);
            } else {
                const float width = collider.size.x * scaleX;
                const float height = collider.size.y * scaleY;
                renderer.drawRect(
                    position.x + offsetX - width * 0.5f,
                    position.y + offsetY - height * 0.5f,
                    width, height, color);
            }

            const float velocityLengthSquared =
                velocity.x * velocity.x + velocity.y * velocity.y;
            if (velocityLengthSquared <= 4.f) return;
            const float scale = 0.05f / std::sqrt(velocityLengthSquared);
            renderer.drawLine(
                position.x, position.y,
                position.x + velocity.x * scale,
                position.y + velocity.y * scale,
                {0.2f, 1.f, 0.2f, 0.85f});
        });
}

} // namespace ArtCade::AppRender

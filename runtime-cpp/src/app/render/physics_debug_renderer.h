#pragma once

namespace ArtCade::Modules {
class Physics;
class Renderer;
class RuntimeEntityGateway;
}

namespace ArtCade::AppRender {

/** Draw active physics colliders and velocity vectors. */
void drawPhysicsDebug(Modules::Renderer& renderer,
                      Modules::RuntimeEntityGateway& gateway,
                      Modules::Physics& physics);

} // namespace ArtCade::AppRender

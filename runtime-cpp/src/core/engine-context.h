#pragma once

/**
 * EngineContext — lightweight dependency container.
 *
 * Instead of passing N pointers into every constructor, modules receive a
 * const reference to this struct and pull only what they need.
 *
 * Rules:
 *  - All pointers are non-owning (lifetime managed by Application).
 *  - A nullptr means the subsystem has not been initialised yet.
 *  - Modules must NOT store the EngineContext beyond init().
 */

namespace ArtCade {

// Forward declarations (no headers pulled in here)
namespace Modules {
    class Renderer;
    class Physics;
    class Input;
    class Audio;
    class LuaHost;
    class EntityManager;
    class SceneManager;
    class AssetLoader;
    class GameAPI;
}
class World;

struct EngineContext {
    Modules::Renderer*      renderer      = nullptr;
    Modules::Physics*       physics       = nullptr;
    Modules::Input*         input         = nullptr;
    Modules::Audio*         audio         = nullptr;
    Modules::LuaHost*       luaHost       = nullptr;
    Modules::EntityManager* entityManager = nullptr;
    Modules::SceneManager*  sceneManager  = nullptr;
    Modules::AssetLoader*   assetLoader   = nullptr;
    Modules::GameAPI*       gameAPI       = nullptr;
    World*                  world         = nullptr;
};

} // namespace ArtCade

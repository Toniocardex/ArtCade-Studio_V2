#pragma once

#include "types.h"
#include <glm/glm.hpp>
#include <vector>
#include <sol/sol.hpp>

namespace ArtCade {

class Renderer;
class Physics;
class World;

/**
 * GameAPI: Lua binding layer for game logic
 *
 * Exposes all game engine functionality to Lua scripts.
 * Every function here is callable from the main.luac bytecode.
 */
class GameAPI {
public:
    GameAPI(Renderer* renderer, Physics* physics, World* world);

    // Register all Lua bindings
    void registerLuaBindings(sol::state& lua);

    // ========================================================================
    // Entity & Pool API
    // ========================================================================

    glm::vec2 entityGetPosition(EntityId id) const;
    void entitySetPosition(EntityId id, float x, float y);

    glm::vec2 entityGetVelocity(EntityId id) const;
    void entitySetVelocity(EntityId id, float vx, float vy);

    void entityDestroy(EntityId id);

    std::vector<EntityId> poolGetAll(const std::string& className) const;
    size_t poolCount(const std::string& className) const;

    // ========================================================================
    // Collision API
    // ========================================================================

    bool collisionOverlap(EntityId id1, EntityId id2) const;
    bool collisionTouchingClass(EntityId id, const std::string& className) const;

    struct RaycastResult {
        bool hit = false;
        EntityId entityId = INVALID_ENTITY;
        glm::vec2 hitPoint = {0.0f, 0.0f};
        float distance = 0.0f;
    };
    RaycastResult collisionRaycast(float x1, float y1, float x2, float y2) const;

    // ========================================================================
    // Input API
    // ========================================================================

    bool inputIsKeyDown(const std::string& keyCode) const;
    bool inputWasKeyPressed(const std::string& keyCode) const;
    bool inputWasKeyReleased(const std::string& keyCode) const;

    glm::vec2 inputGetMousePosition() const;

    // ========================================================================
    // Audio API
    // ========================================================================

    void audioPlaySound(const std::string& assetPath, float volume = 1.0f, float pitch = 1.0f);
    void audioPlayMusic(const std::string& assetPath, bool loop = true);
    void audioStopAll();
    void audioSetVolume(float master, float music, float sfx);

    // ========================================================================
    // State API
    // ========================================================================

    sol::object stateGet(const std::string& key);
    void stateSet(const std::string& key, const sol::object& value);
    int32_t stateAdd(const std::string& key, int32_t amount);

    // ========================================================================
    // Debug API
    // ========================================================================

    void debugLog(const std::string& message);
    void debugDrawLine(float x1, float y1, float x2, float y2, const std::string& color);

private:
    Renderer* renderer_;
    Physics* physics_;
    World* world_;

    // Convert key code string (e.g., "KeyW", "Space") to internal KeyCode
    KeyCode stringToKeyCode(const std::string& keyStr) const;
    std::string keyCodeToString(KeyCode code) const;
};

} // namespace ArtCade

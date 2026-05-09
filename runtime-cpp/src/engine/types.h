#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <unordered_map>
#include <glm/glm.hpp>

namespace ArtCade {

// ============================================================================
// Core Types
// ============================================================================

using EntityId = uint32_t;
using SceneId = std::string;
using AssetId = std::string;

constexpr EntityId INVALID_ENTITY = 0;

// ============================================================================
// Transform
// ============================================================================

struct Transform {
    glm::vec2 position = {0.0f, 0.0f};
    glm::vec2 scale = {1.0f, 1.0f};
    float rotation = 0.0f;          // radians

    glm::vec2 velocity = {0.0f, 0.0f};
    float angularVelocity = 0.0f;
};

// ============================================================================
// Physics
// ============================================================================

enum class BodyType {
    Dynamic,                        // Affected by gravity, velocity, collisions
    Static,                         // Immovable, collides
    Kinematic,                      // Moves via velocity, not affected by gravity
};

enum class ColliderShape {
    Rectangle,                      // AABB
    Circle,
    Capsule,                        // Future
};

struct Collider {
    ColliderShape shape = ColliderShape::Rectangle;
    glm::vec2 size = {1.0f, 1.0f}; // For rectangle: width, height
                                    // For circle: radius in x
    glm::vec2 offset = {0.0f, 0.0f};
    float density = 1.0f;
    float friction = 0.3f;
    bool isSensor = false;          // Trigger collider (no physics)
};

struct PhysicsComponent {
    BodyType bodyType = BodyType::Dynamic;
    Collider collider;
    uint32_t physicsHandle = 0;    // Internal Rapier handle
    bool isAwake = true;
};

// ============================================================================
// Rendering
// ============================================================================

struct SpriteComponent {
    AssetId spriteAssetId;
    glm::vec4 tint = {1.0f, 1.0f, 1.0f, 1.0f};
    float alpha = 1.0f;
    glm::vec2 pivot = {0.5f, 0.5f}; // 0-1, for Y-sorting
    int32_t renderOrder = 0;        // Z-order for layering
    uint32_t raylib_texture = 0;    // Internal Raylib texture ID
};

// ============================================================================
// Animation
// ============================================================================

struct AnimationState {
    std::string currentAnimation;
    uint32_t currentFrame = 0;
    float frameTime = 0.0f;
    float frameDuration = 0.1f;
    bool isPlaying = false;
    bool isLooping = false;
};

// ============================================================================
// Entity Definition (Template)
// ============================================================================

struct EntityDef {
    EntityId id;
    std::string name;
    std::string className;          // For pool queries
    Transform transform;
    SpriteComponent spriteComponent;
    PhysicsComponent physicsComponent;
    AnimationState animationState;
    std::vector<std::string> tags;
};

// ============================================================================
// Scene Definition
// ============================================================================

struct SceneDef {
    SceneId id;
    std::string name;
    glm::vec2 worldSize = {800.0f, 600.0f};
    glm::vec2 viewportSize = {800.0f, 600.0f};
    glm::vec4 backgroundColor = {0.1f, 0.1f, 0.1f, 1.0f};
    std::vector<EntityId> entityIds;
};

// ============================================================================
// Project Document
// ============================================================================

struct ProjectDoc {
    std::string projectName;
    std::string version = "2.0.0";

    glm::vec2 gameResolution = {1280.0f, 720.0f};
    float targetFPS = 60.0f;

    std::unordered_map<EntityId, EntityDef> entities;
    std::unordered_map<SceneId, SceneDef> scenes;
    SceneId activeSceneId;

    std::string mainScriptPath = "scripts/main.luac";
};

// ============================================================================
// Input Events
// ============================================================================

enum class KeyCode {
    Space = 0,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    KeyW, KeyA, KeyS, KeyD,
    KeyX, KeyZ,
    Enter, Escape,
    // ... more as needed
};

struct InputState {
    bool keysDown[256] = {};
    bool keysPressedThisFrame[256] = {};
    bool keysReleasedThisFrame[256] = {};
    glm::vec2 mousePosition = {0.0f, 0.0f};
    bool mouseButtonDown[3] = {};   // LMB, RMB, MMB
};

// ============================================================================
// Global State (Lua-accessible)
// ============================================================================

using GlobalStateValue = std::variant<
    int32_t,
    float,
    std::string,
    bool
>;

using GlobalState = std::unordered_map<std::string, GlobalStateValue>;

} // namespace ArtCade

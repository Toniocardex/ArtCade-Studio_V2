#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <variant>
#include <vector>
#include <unordered_map>

namespace ArtCade {

// ============================================================================
// Primitive identifiers
// ============================================================================

using EntityId  = uint32_t;
using SceneId   = std::string;
using AssetId   = std::string;

constexpr EntityId INVALID_ENTITY = 0;

// ============================================================================
// Math (wraps glm — include glm before this header)
// ============================================================================

struct Vec2 { float x = 0.f, y = 0.f; };
struct Vec4 { float r = 1.f, g = 1.f, b = 1.f, a = 1.f; };

// ============================================================================
// Transform
// ============================================================================

struct Transform {
    Vec2  position;
    Vec2  scale   = {1.f, 1.f};
    float rotation = 0.f;     // radians
    Vec2  velocity;
};

// ============================================================================
// Physics
// ============================================================================

enum class BodyType    { Dynamic, Static, Kinematic };
enum class ColliderShape { Rectangle, Circle };

struct Collider {
    ColliderShape shape   = ColliderShape::Rectangle;
    Vec2          size    = {1.f, 1.f};  // w/h for rect, radius in x for circle
    Vec2          offset;
    float         density  = 1.f;
    float         friction = 0.3f;
    bool          isSensor = false;
};

struct PhysicsComponent {
    BodyType bodyType     = BodyType::Dynamic;
    Collider collider;
    uint32_t physicsHandle = 0;  // Opaque Box2D body id (internal pool index)
};

// ============================================================================
// Sprite / Animation
// ============================================================================

struct SpriteComponent {
    AssetId spriteAssetId;
    Vec4    tint        = {1.f, 1.f, 1.f, 1.f};
    float   alpha       = 1.f;
    Vec2    pivot       = {0.5f, 0.5f};
    int32_t renderOrder = 0;
};

struct AnimationState {
    std::string currentAnim;
    uint32_t    currentFrame   = 0;
    float       frameTime      = 0.f;
    float       frameDuration  = 0.1f;
    bool        isPlaying      = false;
    bool        isLooping      = false;
};

// ============================================================================
// Gameplay ECS components (Scene Editor — Phase D1)
// Field names mirror the editor TS model (types/components.ts) so the JSON
// produced by the editor maps 1:1 with no synonyms.
// ============================================================================

struct SensorComponent {
    std::string shape     = "Circle";   // "Circle" | "Rectangle"
    float       radius    = 120.f;      // Circle
    float       width     = 64.f;       // Rectangle
    float       height    = 64.f;       // Rectangle
    std::string targetTag = "player";
};

struct PlatformerControllerComponent {
    float maxSpeed      = 300.f;
    float jumpForce     = 600.f;
    float customGravity = 1500.f;
    float coyoteTime    = 0.15f;
    float jumpBuffer    = 0.1f;
    std::string groundClass = "Ground";
};

/** Runtime-only: not serialized from project JSON. */
struct EntityRuntimeFlags {
    bool sceneActive = true;
};

struct HealthComponent {
    float maxHp     = 100.f;
    float currentHp = 100.f;
    float iFrames   = 0.2f;
};

struct AutoDestroyComponent {
    float lifespan  = 0.f;   // seconds; 0 = manual (never auto-destroy)
    float _timeAlive = 0.f;  // runtime accumulator (not serialised)
};

// ============================================================================
// Entity / Scene definitions
// ============================================================================

struct EntityDef {
    EntityId         id;
    std::string      name;
    std::string      className;
    std::vector<std::string> tags;
    Transform        transform;
    SpriteComponent  sprite;
    PhysicsComponent physics;
    AnimationState   animation;
    // Optional gameplay components (Phase D1)
    std::optional<SensorComponent>               sensor;
    std::optional<PlatformerControllerComponent> platformerController;
    std::optional<HealthComponent>               health;
    std::optional<AutoDestroyComponent>          autoDestroy;
    EntityRuntimeFlags                           runtime;
};

// Tilemap (Scene Editor Phase D2) — field names mirror editor TS.
struct TilemapData {
    float            tileSize = 32.f;
    int              cols     = 0;   // 0 = no tilemap
    int              rows     = 0;
    std::vector<int> data;           // size cols*rows, row-major, 0 = empty
    std::string      tilesetAssetId; // Phase F3: spritesheet ref (empty = colour)
};

// Phase F3: spritesheet tileset. Cell id is 1-based, laid out L→R, T→B.
struct TilesetAsset {
    std::string assetId;
    std::string spriteImagePath;
    float       tileSize = 32.f;
    int         margin   = 0;
    int         cols     = 1;
    int         rows     = 1;
};

struct SceneDef {
    SceneId             id;
    std::string         name;
    Vec2                worldSize    = {800.f, 600.f};
    Vec2                viewportSize = {800.f, 600.f};
    Vec4                backgroundColor;
    std::vector<EntityId> entityIds;
    TilemapData         tilemap;     // cols==0 → absent
};

struct TilePaletteEntry {
    int         id    = 0;
    std::string name;
    Vec4        color = {0.5f, 0.5f, 0.5f, 1.f};
    bool        solid = false;
};

// ============================================================================
// Project document (root data model)
// ============================================================================

struct ProjectDoc {
    std::string  projectName;
    std::string  version         = "2.0.0";
    std::string  licenseTier     = "free";
    Vec2         gameResolution  = {1280.f, 720.f};
    float        targetFPS       = 60.f;
    SceneId      activeSceneId;
    std::string  mainScriptPath  = "scripts/main.luac";

    std::unordered_map<EntityId, EntityDef> entities;
    std::unordered_map<SceneId,  SceneDef>  scenes;
    std::unordered_map<SceneId,  std::string> thumbnails;
    std::vector<TilePaletteEntry> tilePalette;   // Phase D2
    std::vector<TilesetAsset>     tilesets;      // Phase F3
};

// ============================================================================
// Global state (runtime key-value store)
// ============================================================================

using StateValue = std::variant<int32_t, float, std::string, bool>;
using GlobalState = std::unordered_map<std::string, StateValue>;

// ============================================================================
// Input
// ============================================================================

struct InputState {
    bool keysDown[512]             = {};
    bool keysPressedThisFrame[512] = {};
    bool keysReleasedThisFrame[512]= {};
    Vec2 mousePosition;
    bool mouseButtonDown[3]        = {};
};

} // namespace ArtCade

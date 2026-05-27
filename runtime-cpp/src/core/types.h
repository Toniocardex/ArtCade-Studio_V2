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
struct Vec3 { float x = 1.f, y = 1.f, z = 1.f; };
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
    // Runtime compatibility mirror. Source of truth lives in RuntimeEntityGateway.
    uint32_t physicsHandle = 0;
};

// ============================================================================
// Sprite / Animation
// ============================================================================

struct ImagePointDef {
    std::string id;
    float       x = 0.f;   // normalised 0..1 on sprite
    float       y = 0.f;
};

struct SpriteComponent {
    AssetId spriteAssetId;
    Vec4    tint        = {1.f, 1.f, 1.f, 1.f};
    Vec3    fillColor   = {1.f, 1.f, 1.f};  // opaque placeholder when no texture
    float   alpha       = 1.f;
    Vec2    pivot       = {0.5f, 0.5f};
    int32_t renderOrder = 0;
    std::string shaderEffect;  // "" | outline | hit_flash | palette_swap | wave
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

struct SolidComponent {
    std::string groundClass  = "Ground";
    /** "solid" (default) or "oneWay" — one-way only collides when falling (vy >= 0). */
    std::string surfaceKind = "solid";
};

struct PlatformerControllerComponent {
    float maxSpeed      = 300.f;
    float jumpForce     = 600.f;
    float customGravity = 1500.f;
    float coyoteTime    = 0.15f;
    float jumpBuffer    = 0.1f;
    std::string groundClass = "Ground";
};

struct TopDownControllerComponent {
    float maxSpeed       = 260.f;
    float acceleration   = 1600.f;
    float friction       = 2200.f;
    bool  fourDirections = false;
};

struct LinearMoverComponent {
    float directionX = 1.f;
    float directionY = 0.f;
    float speed      = 300.f;
    /** Runtime pause flag (not serialised). */
    bool  _paused    = false;
};

/** Marks an entity as the 2D camera follow target (offset + smoothing). */
struct CameraTargetComponent {
    float offsetX     = 0.f;
    float offsetY     = 0.f;
    float followSpeed = 8.f;   // exponential lerp rate (1/s); 0 = snap
};

/** Pulls tagged entities toward this entity (loot magnet). */
struct MagneticItemComponent {
    std::string attractTag = "pickup";
    float       radius     = 200.f;   // px; 0 = unlimited range
    float       pullSpeed  = 400.f;   // px/s toward holder
    /** Runtime enable flag (not serialised). */
    bool        _enabled   = true;
};

/** Swarm steering: chase a class + separate from other horde members. */
struct HordeMemberComponent {
    std::string targetClass      = "Player";
    float       maxSpeed         = 120.f;
    float       separationRadius = 48.f;
    float       separationWeight = 1.5f;
    float       chaseWeight      = 1.f;
};

/** Runtime-only: not serialized from project JSON. */
struct EntityRuntimeFlags {
    bool sceneActive = true;
};

struct HealthComponent {
    float maxHp     = 100.f;
    float currentHp = 100.f;
    float iFrames   = 0.2f;
    /** Runtime invulnerability countdown (not serialised). */
    float _iFramesRemaining = 0.f;
};

struct AutoDestroyComponent {
    float lifespan  = 0.f;   // seconds; 0 = manual (never auto-destroy)
    float _timeAlive = 0.f;  // runtime accumulator (not serialised)
};

// LifecycleEvent — emitted by EntityRegistry signals (on_construct/on_destroy
// of Identity) when an entity gains its className/tags (Spawned) or is being
// destroyed (Destroyed). Drained once per frame by the gateway and routed to
// Lua handlers registered via `lifecycle.onSpawn(class, fn)` /
// `lifecycle.onDestroy(class, fn)`. Order matches registry insertion order
// for Spawned events and reverse-insertion for Destroyed (signal fires
// before the entity is physically removed). See ECS_IMPLEMENTATION_GUIDE.md §10.
struct LifecycleEvent {
    enum class Kind { Spawned, Destroyed };
    Kind                     kind      = Kind::Spawned;
    EntityId                 id        = 0;
    std::string              className;
    std::vector<std::string> tags;
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
    std::optional<SolidComponent>                solid;
    std::optional<PlatformerControllerComponent> platformerController;
    std::optional<TopDownControllerComponent>    topDownController;
    std::optional<LinearMoverComponent>          linearMover;
    std::optional<CameraTargetComponent>         cameraTarget;
    std::optional<MagneticItemComponent>         magneticItem;
    std::optional<HordeMemberComponent>          hordeMember;
    std::optional<HealthComponent>               health;
    std::optional<AutoDestroyComponent>          autoDestroy;
    /** Design-time flag: when false the sprite is hidden in play / shipped
     *  builds. The editor preview always draws the sprite (with a dashed
     *  outline). Runtime Logic Board setVisible() toggles sprite alpha. */
    bool                                         visible = true;
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

/** Scene placement of an object type (project format v2). */
struct SceneInstanceDef {
    EntityId    id           = 0;
    std::string objectTypeId;
    std::string instanceName;
    Transform   transform;
    bool        visible      = true;
};

struct SceneDef {
    SceneId             id;
    std::string         name;
    Vec2                worldSize    = {800.f, 600.f};
    Vec2                viewportSize = {800.f, 600.f};
    Vec4                backgroundColor;
    std::vector<EntityId> entityIds;
    std::vector<SceneInstanceDef> instances;
    TilemapData         tilemap;     // cols==0 → absent
};

struct TilePaletteEntry {
    int         id    = 0;
    std::string name;
    Vec4        color = {0.5f, 0.5f, 0.5f, 1.f};
    bool        solid = false;
    std::string groundClass  = "Ground";
    /** "solid" (default) or "oneWay" — mirrors SolidComponent::surfaceKind. */
    std::string surfaceKind = "solid";
};

/** Runtime cache per tile id (from tilePalette). Used by platformer grounding. */
struct TileSurfaceMeta {
    bool        blocks      = false;
    bool        oneWay      = false;
    std::string groundClass = "Ground";
};

// ============================================================================
// Project document (root data model)
// ============================================================================

struct ImageAssetDef {
    std::string assetId;
    std::vector<ImagePointDef> imagePoints;
};

enum class PhysicsMode {
    Auto,
    Off,
    On,
};

struct WorldSettings {
    float       gravity        = 9.81f;
    float       pixelsPerMeter = 100.f;
    float       timeScale      = 1.f;
    PhysicsMode physicsMode    = PhysicsMode::Auto;
};

struct ProjectDoc {
    std::string  projectName;
    std::string  version         = "2.0.0";
    int          formatVersion   = 0;
    std::string  licenseTier     = "free";
    float        targetFPS       = 60.f;
    SceneId      activeSceneId;
    std::string  mainScriptPath  = "scripts/main.luac";

    /** Object type catalog (v2). Key = type id; prototype uses className == key. */
    std::unordered_map<std::string, EntityDef> objectTypes;
    std::unordered_map<EntityId, EntityDef> entities;
    std::unordered_map<SceneId,  SceneDef>  scenes;
    std::unordered_map<SceneId,  std::string> thumbnails;
    std::vector<TilePaletteEntry> tilePalette;   // Phase D2
    std::vector<TilesetAsset>     tilesets;      // Phase F3
    std::vector<ImageAssetDef>    imageAssets;   // editor assets + image points
    WorldSettings                 world{};
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

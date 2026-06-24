#pragma once

#include "project-defaults.h"
#include <cstdint>
#include <optional>
#include <string>
#include <variant>
#include <vector>
#include <variant>
#include <unordered_map>

namespace ArtCade {

// ============================================================================
// Primitive identifiers
// ============================================================================

using EntityId  = uint32_t;
using SceneId   = std::string;
using AssetId   = std::string;

constexpr EntityId INVALID_ENTITY = 0;

using GameVariableValue = std::variant<double, bool, std::string>;

struct GameVariableDefinition {
    enum class Type { Number, Boolean, String };
    std::string       key;
    Type              type = Type::Number;
    GameVariableValue initialValue = 0.0;
    std::string       description;
};

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
    bool    pivotFromAsset = true;
    Vec2    pivot       = {0.5f, 0.5f};
    int32_t renderOrder = 0;
    std::string shaderEffect;  // "" | outline | hit_flash | palette_swap | wave
    std::string defaultClip;
    bool        playClipOnSpawn = false;
    // Facing flags, decoupled from scale: the renderer mirrors the sprite from
    // these (scale carries only magnitude). A negative authored scale is migrated
    // into these on entity creation so scale stays a pure size.
    bool        flipX = false;
    bool        flipY = false;
    // Render layer name (set at entity creation from EntityDef.layer). Drives
    // per-layer parallax in app_scene_render; "" = no layer / factor 1.
    std::string layer;
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

/**
 * Explicit climb zone for the platformer controller. An entity carrying this
 * component is climbable; the zone bbox (shape/size, like SensorComponent)
 * decouples reach from the sprite collider, and axis selects which movement
 * axis drives climbing. Preferred over PlatformerControllerComponent.climbClass
 * (the className-overlap fallback), removing false positives from decorations.
 */
struct LadderComponent {
    std::string shape      = "Rectangle"; // "Circle" | "Rectangle"
    float       radius     = 64.f;        // Circle
    float       width      = 32.f;        // Rectangle
    float       height     = 96.f;        // Rectangle
    std::string axis       = "vertical";  // "vertical" (movement.y) | "horizontal" (movement.x)
    float       climbSpeed = 0.f;         // px/s; 0 = use PlatformerController.climbSpeed
};

struct PlatformerControllerComponent {
    float maxSpeed      = 300.f;
    float jumpForce     = 600.f;
    float customGravity = 1500.f;
    float coyoteTime    = 0.15f;
    float jumpBuffer    = 0.1f;
    std::string groundClass = "Ground";
    // Ladder climbing: while overlapping an entity of climbClass and the player
    // feeds vertical intent, gravity is suspended and the body moves at
    // climbSpeed along Y. Empty climbClass disables the feature (no per-frame
    // overlap query), so existing platformers cost nothing.
    std::string climbClass = "";
    float       climbSpeed = 120.f;   // px/s
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

/** Text label (score, titles) drawn above the entity sprite (or fixed on screen). */
struct TextComponent {
    std::string text;
    std::string bindKey;             // state var to auto-display; empty = static text
    std::string bindScope = "global";
    std::string format  = "text";    // text|integer|padded|time|percent|decimals
    int         digits  = 2;         // pad width (padded) / decimal places (decimals)
    std::string prefix;              // shown before the bound value
    std::string suffix;              // shown after the bound value
    std::string fontPath;            // project-relative; empty = default font
    int         size    = 24;
    Vec4        color   = {1.f, 1.f, 1.f, 1.f};
    // 3×3 anchor point at the entity position. Canonical: "{v}-{h}" with the
    // dead-centre collapsing to "center" (e.g. "top-left", "bottom-center").
    // Legacy horizontal-only values ("left"|"center"|"right") still parse.
    std::string align   = "top-left";
    float       offsetX = 0.f;
    float       offsetY = 0.f;
    bool        screenSpace = false; // draw fixed on screen (HUD) vs in the world
};

/** Filled bar driven by a variable (health, mana, progress). */
struct GaugeComponent {
    std::string bindKey;             // variable read as current value
    std::string bindScope = "global";
    float       maxValue   = 100.f;  // value mapped to a full bar
    float       width      = 64.f;
    float       height     = 8.f;
    Vec4        fillColor  = {0.23f, 0.82f, 0.23f, 1.f};
    Vec4        bgColor    = {0.13f, 0.13f, 0.13f, 1.f};
    std::string direction  = "horizontal"; // "horizontal" | "vertical"
    float       offsetX    = 0.f;
    float       offsetY    = -40.f;
    bool        screenSpace = false;
};

/** NPC / talkable — references dialogs/{dialogId}.json in project root. */
struct DialogComponent {
    std::string dialogId;
    std::string startNode;       // optional override; empty = graph startNode
    float       textSpeed = 40.f;
    std::string triggerMessage;  // optional Logic Board message name
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
    std::string      layer;        // render layer name ("" = none)
    std::vector<std::string> tags;
    Transform        transform;
    SpriteComponent  sprite;
    PhysicsComponent physics;
    AnimationState   animation;
    // Optional gameplay components (Phase D1)
    std::optional<SensorComponent>               sensor;
    std::optional<SolidComponent>                solid;
    std::optional<LadderComponent>               ladder;
    std::optional<PlatformerControllerComponent> platformerController;
    std::optional<TopDownControllerComponent>    topDownController;
    std::optional<LinearMoverComponent>          linearMover;
    std::optional<CameraTargetComponent>         cameraTarget;
    std::optional<MagneticItemComponent>         magneticItem;
    std::optional<HordeMemberComponent>          hordeMember;
    std::optional<HealthComponent>               health;
    std::optional<AutoDestroyComponent>          autoDestroy;
    std::optional<DialogComponent>               dialog;
    std::optional<TextComponent>                 text;
    std::optional<GaugeComponent>                gauge;
    /** Design-time flag: when false the sprite is hidden in play / shipped
     *  builds. The editor preview always draws the sprite (with a dashed
     *  outline). Runtime Logic Board setVisible() toggles sprite alpha. */
    bool                                         visible = true;
    EntityRuntimeFlags                           runtime;
    std::vector<GameVariableDefinition>          localVariables;
    std::unordered_map<std::string, GameVariableValue> localVariableOverrides;
};

// Tilemap (Scene Editor Phase D2) — field names mirror editor TS.
// Grid dimension limits: see tilemap_grid.h (sync with editor/src/types/tilemap-grid.ts).
struct TilesetSourceRef {
    std::string tilesetAssetId;
};

struct TilemapData {
    float            tileSize = 32.f;
    int              cols     = 0;   // 0 = no tilemap
    int              rows     = 0;
    std::vector<int> data;           // size cols*rows, row-major, 0 = empty
    std::vector<int> sourceIndices;  // parallel to data; 0 = empty; 1..N → tilesetSources[N-1]
    std::vector<TilesetSourceRef> tilesetSources;
    std::string      tilesetAssetId; // legacy migration only
    std::string      defaultTilesetAssetId;
};

/** Per-layer parallax scroll factor (1 = moves with world, <1 = far, >1 = near). */
struct LayerParallax {
    float x = 1.f;
    float y = 1.f;
};

/** Optional repeating background image painted under a layer's entities. */
struct LayerBackground {
    std::string imageId;        // ImageAsset id; empty = no background
    bool        tileX   = true; // repeat horizontally to fill the view
    bool        tileY   = true; // repeat vertically to fill the view
    float       scrollX = 0.f;  // constant auto-scroll px/s (camera-independent)
    float       scrollY = 0.f;
};

/** Named scene render layer (editor project.layers; index 0 = highest priority). */
struct SceneLayerDef {
    std::string     name;
    bool            visible = true;
    bool            locked  = false;
    float           opacity = 1.f;
    LayerParallax   parallax;
    LayerBackground background;
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
    std::string layer;        // render layer name ("" = none)
    std::unordered_map<std::string, GameVariableValue> localVariableOverrides;
};

struct SceneDef {
    SceneId             id;
    std::string         name;
    Vec2                worldSize    = {
        ProjectDefaults::kSceneWorldWidth,
        ProjectDefaults::kSceneWorldHeight,
    };
    Vec2                viewportSize = {
        ProjectDefaults::kSceneViewportWidth,
        ProjectDefaults::kSceneViewportHeight,
    };
    /** World-space top-left of the camera's initial view (player's start view). */
    Vec2                cameraStart  = { 0.f, 0.f };
    Vec4                backgroundColor;
    std::vector<EntityId> entityIds;
    std::vector<SceneInstanceDef> instances;
    /** Merged grid for physics / legacy single-layer projects. */
    TilemapData         tilemap;     // cols==0 → absent
    /** Per-layer paint grids (editor tilemapLayers); rendered bottom→top. */
    std::unordered_map<std::string, TilemapData> tilemapLayers;
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

struct AnimationFrameRect {
    float x = 0.f;
    float y = 0.f;
    float w = 0.f;
    float h = 0.f;
};

struct AnimationClipDef {
    std::string              name;
    std::vector<AnimationFrameRect> frames;
    float                    fps  = 12.f;
    bool                     loop = true;
};

struct ImageAssetDef {
    std::string assetId;
    Vec2 defaultPivot = {0.5f, 0.5f};
    std::vector<ImagePointDef> imagePoints;
    std::vector<AnimationClipDef> clips;
};

enum class PhysicsMode {
    Auto,
    Off,
    On,
};

struct WorldSettings {
    float       gravity           = 9.81f;
    float       pixelsPerMeter    = 100.f;
    float       timeScale         = 1.f;
    PhysicsMode physicsMode       = PhysicsMode::Auto;
    bool        physicsDebugDraw  = false;
};

/** Runtime timing + physics from project JSON (editor WASM + native load). */
struct ProjectRuntimeSettings {
    float       targetFPS         = 60.f;
    PhysicsMode physicsMode       = PhysicsMode::Auto;
    float       gravity           = 9.81f;
    float       pixelsPerMeter    = 100.f;
    float       timeScale         = 1.f;
    bool        physicsDebugDraw  = false;
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
    std::vector<SceneLayerDef>    layers;        // render stack (index 0 = on top)
    std::vector<TilePaletteEntry> tilePalette;   // Phase D2
    std::vector<TilesetAsset>     tilesets;      // Phase F3
    std::vector<ImageAssetDef>    imageAssets;   // editor assets + image points
    WorldSettings                 world{};
    std::vector<GameVariableDefinition> globalVariables;
};

inline ProjectRuntimeSettings runtimeSettingsFromProjectDoc(const ProjectDoc& doc) {
    ProjectRuntimeSettings s;
    s.targetFPS          = doc.targetFPS;
    s.physicsMode        = doc.world.physicsMode;
    s.gravity            = doc.world.gravity;
    s.pixelsPerMeter     = doc.world.pixelsPerMeter;
    s.timeScale          = doc.world.timeScale;
    s.physicsDebugDraw   = doc.world.physicsDebugDraw;
    return s;
}

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

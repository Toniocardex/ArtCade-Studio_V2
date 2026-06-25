#include "../include/world.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/variable-manager/include/variable-manager.h"
#include "../../modules/renderer/include/renderer.h"

#include <cmath>

namespace ArtCade {

World::World(Modules::RuntimeEntityGateway& gateway,
             Modules::Physics&              ph,
             Modules::VariableManager&      variables)
    : entityGateway_(gateway), physics_(ph), variables_(variables) {
    // Drop per-entity gameplay caches the moment the gateway destroys an
    // entity. EnTT recycles ids, so without this a fresh entity can inherit
    // previous gameplay timers and input state.
    entityGateway_.setEntityDestroyHandler([this](EntityId id) {
        forgetEntity(id);
        variables_.destroyEntity(id);
    });
    entityGateway_.setEntityCreatedHandler([this](EntityId id, const EntityDef& def) {
        variables_.createEntity(id, def.localVariables, def.localVariableOverrides);
    });
}

void World::forgetEntity(EntityId id) {
    platformerRt_.erase(id);
    topDownRt_.erase(id);
    controlIntents_.erase(id);
    if (cameraFollowMode_ == CameraFollowMode::Explicit
        && cameraFollowTarget_ == id) {
        useAutomaticCameraTarget();
    }
}

void World::clearGameplayRuntimeState() {
    platformerRt_.clear();
    topDownRt_.clear();
    controlIntents_.clear();
    useAutomaticCameraTarget();
}

void World::applyTilePalette(const std::vector<TilePaletteEntry>& tilePalette) {
    tileMeta_.clear();
    for (const auto& e : tilePalette) {
        if (e.id < 1) continue;
        TileSurfaceMeta m;
        m.collisionBody = e.collisionBody;
        if (m.collisionBody) {
            for (const CollisionShape& shape : m.collisionBody->shapes) {
                if (!shape.enabled) continue;
                if (shape.response == CollisionResponse::Solid) {
                    m.blocks = true;
                    m.oneWay = m.oneWay || shape.oneWay;
                }
            }
        }
        tileMeta_[e.id] = std::move(m);
    }
}

void World::syncAfterEditorProject(const std::vector<TilePaletteEntry>& tilePalette) {
    applyTilePalette(tilePalette);
    clearGameplayRuntimeState();
    rebuildCollisionWorld();
}

void World::restoreDesignState(const std::vector<TilePaletteEntry>& tilePalette) {
    syncAfterEditorProject(tilePalette);
}

void World::init(const ProjectDoc& doc) {
    clearGameplayRuntimeState();
    physicsLayers_ = doc.physicsLayers;
    collisionWorld_.setLayers(physicsLayers_);
    variables_.configureGlobals(doc.globalVariables);
    entityGateway_.setPhysics(&physics_);
    const std::unordered_map<std::string, EntityDef>* typesPtr =
        doc.objectTypes.empty() ? nullptr : &doc.objectTypes;
    entityGateway_.replaceProject(doc.scenes, doc.entities, doc.activeSceneId, typesPtr);
    entityGateway_.setCollisionProjectData(
        doc.physicsLayers, doc.collisionProfiles, doc.spritePathToAssetId);

    applyTilePalette(doc.tilePalette);
    activeTilemap_ = TilemapData{};

    rebuildCollisionWorld();
}

void World::shutdown() {
    // Unregister the destroy hook before anything else: the lambda captures
    // `this`, and if World is destroyed before the gateway any later
    // destroy(id) on the gateway would dereference dangling memory.
    entityGateway_.setEntityDestroyHandler(nullptr);
    entityGateway_.setEntityCreatedHandler(nullptr);
    entityGateway_.setPhysicsTopologyHandler(nullptr);

    variables_.clear();
    clearGameplayRuntimeState();
    activeTilemap_ = TilemapData{};
    tileMeta_.clear();
    collisionWorld_.clear();
    physicsLayers_.clear();
}

bool World::loadScene(const SceneId& id) {
    if (!entityGateway_.loadScene(id)) return false;
    clearGameplayRuntimeState();
    rebuildCollisionWorld();
    return true;
}

SceneId World::activeSceneId() const {
    return entityGateway_.activeSceneId();
}

void World::syncPhysicsToEntities() {
    // EnTT visitor: in-place Transform update for every active entity that
    // has a live physics handle. PlatformerController owns transform; its
    // collider body is pushed from transform in tickPlatformerControllers.
    entityGateway_.forEachActivePhysicsBody(
        [this](EntityId id, uint32_t handle, Transform& t) {
            PlatformerControllerComponent platformer{};
            if (entityGateway_.getPlatformerController(id, platformer))
                return;
            t.position = physics_.getPosition(handle);
            t.velocity = physics_.getLinearVelocity(handle);
        });
    rebuildCollisionWorld();
}

bool World::hasGlobalState(const std::string& key) const {
    return variables_.exists(key);
}

StateValue World::getGlobalState(const std::string& key) const {
    auto v = variables_.get(key);
    if (auto* number = std::get_if<double>(&v)) return StateValue{ static_cast<float>(*number) };
    if (auto* b = std::get_if<bool>(&v))      return StateValue{ *b };
    if (auto* s = std::get_if<std::string>(&v)) return StateValue{ *s };
    return StateValue{ 0 };
}

void World::setGlobalState(const std::string& key, const StateValue& value) {
    if (auto* i = std::get_if<int32_t>(&value)) variables_.set(key, static_cast<double>(*i));
    else if (auto* f = std::get_if<float>(&value)) variables_.set(key, static_cast<double>(*f));
    else if (auto* b = std::get_if<bool>(&value))  variables_.setBool(key, *b);
    else if (auto* s = std::get_if<std::string>(&value))
        variables_.setString(key, *s);
}

std::vector<EntityId> World::activeEntityIds() const {
    return entityGateway_.activeSceneIds();
}

void World::rebuildCollisionWorld() {
    if (const SceneDef* scene = entityGateway_.activeScene())
        activeTilemap_ = scene->tilemap;
    collisionWorld_.clear();
    const auto& layers = entityGateway_.physicsLayers();
    if (layers.empty())
        collisionWorld_.setLayers({});
    else
        collisionWorld_.setLayers(layers);
    entityGateway_.forEachActiveCollisionBody(
        [this](EntityId id,
               const Transform& transform,
               const CollisionBodyComponent& body) {
            collisionWorld_.addEntity(id, transform, body);
        });

    const TilemapData& tm = activeTilemap_;
    if (tm.cols <= 0 || tm.rows <= 0 || tm.tileSize <= 0.f)
        return;

    uint32_t tileEntityId = 0x80000000u;
    const float ts = tm.tileSize;

    auto tileAt = [&](int col, int row) -> int {
        if (col < 0 || row < 0 || col >= tm.cols || row >= tm.rows)
            return 0;
        const int idx = row * tm.cols + col;
        if (idx < 0 || idx >= static_cast<int>(tm.data.size()))
            return 0;
        return tm.data[idx];
    };

    auto hasCollisionTile = [&](int id) -> bool {
        auto it = tileMeta_.find(id);
        return it != tileMeta_.end() && it->second.collisionBody;
    };

    for (int row = 0; row < tm.rows; ++row) {
        int col = 0;
        while (col < tm.cols) {
            const int tileId = tileAt(col, row);
            if (!hasCollisionTile(tileId)) {
                ++col;
                continue;
            }

            const int startCol = col;
            while (col < tm.cols && tileAt(col, row) == tileId)
                ++col;

            const TileSurfaceMeta& meta = tileMeta_.at(tileId);
            CollisionBodyComponent body = *meta.collisionBody;
            body.bodyType = BodyType::Static;
            body.enabled = true;

            std::vector<CollisionShape> aggregatedShapes;
            aggregatedShapes.reserve(body.shapes.size());
            for (const CollisionShape& shape : body.shapes) {
                if (!shape.enabled)
                    continue;
                CollisionShape aggregate = shape;
                aggregate.type = CollisionShapeType::Rectangle;
                aggregate.offset = {};
                aggregate.size = { (col - startCol) * ts, ts };
                aggregate.radius = 0.f;
                aggregate.points.clear();
                aggregatedShapes.push_back(std::move(aggregate));
            }
            if (aggregatedShapes.empty())
                continue;

            body.shapes = std::move(aggregatedShapes);

            Transform tileTransform{};
            tileTransform.position = {
                startCol * ts + (col - startCol) * ts * 0.5f,
                row * ts + ts * 0.5f,
            };
            collisionWorld_.addEntity(tileEntityId++, tileTransform, body);
        }
    }
}

bool World::collisionOverlap(EntityId a, EntityId b) const {
    return collisionWorld_.overlapEntities(a, b);
}

EntityId World::firstCollisionTouching(
    EntityId id,
    const CollisionWorld::Filter& filter) const
{
    if (!filter.className.empty()) {
        for (EntityId other : entityGateway_.poolByClass(filter.className)) {
            if (other != id && collisionWorld_.overlapEntities(id, other, filter))
                return other;
        }
        return INVALID_ENTITY;
    }
    if (!filter.tag.empty()) {
        for (EntityId other : entityGateway_.byTag(filter.tag)) {
            if (other != id && collisionWorld_.overlapEntities(id, other, filter))
                return other;
        }
        return INVALID_ENTITY;
    }
    return collisionWorld_.firstTouching(id, filter);
}

CollisionWorld::RaycastResult World::collisionRaycast(
    const Vec2& from,
    const Vec2& to,
    const CollisionWorld::Filter& filter) const
{
    return collisionWorld_.raycast(from, to, filter);
}

bool World::collisionGrounded(EntityId id) const {
    return collisionWorld_.isGrounded(id);
}

void World::resolveKinematicCollisionBody(
    EntityId id,
    Transform& transform,
    const Transform& beforeMove,
    float& horizontalVelocity,
    float& verticalVelocity) const
{
    CollisionBodyComponent selfBody{};
    if (!entityGateway_.getResolvedCollisionBody(id, selfBody) || !selfBody.enabled)
        return;

    const Vec2 delta{
        transform.position.x - beforeMove.position.x,
        transform.position.y - beforeMove.position.y,
    };
    if (std::abs(delta.x) > 1e-6f || std::abs(delta.y) > 1e-6f) {
        bool hitAny = false;
        PhysicsMath::SweepHit bestHit;
        for (const CollisionWorld::ShapeRef& authoredSelf : collisionWorld_.shapes()) {
            if (authoredSelf.id != id)
                continue;
            if (!authoredSelf.shape.enabled
                || authoredSelf.shape.response != CollisionResponse::Solid)
                continue;
            if (authoredSelf.shape.role != CollisionShapeRole::Body
                && authoredSelf.shape.role != CollisionShapeRole::Feet)
                continue;

            CollisionWorld::ShapeRef moving = authoredSelf;
            moving.instance =
                CollisionWorld::shapeInstance(beforeMove, moving.shape);
            moving.aabb = PhysicsMath::shapeWorldAabb(moving.instance);

            for (const CollisionWorld::ShapeRef& other : collisionWorld_.shapes()) {
                if (other.id == id)
                    continue;
                if (!other.shape.enabled
                    || other.shape.response != CollisionResponse::Solid)
                    continue;
                if (!CollisionWorld::canCollide(moving, other))
                    continue;
                if (other.shape.oneWay
                    && !(verticalVelocity >= 0.f
                         && moving.aabb.maxY <= other.aabb.minY + 2.f))
                    continue;

                const PhysicsMath::SweepHit hit =
                    PhysicsMath::sweepAabb(moving.aabb, delta, other.aabb);
                if (!hit.hit || hit.fraction >= bestHit.fraction)
                    continue;
                bestHit = hit;
                hitAny = true;
            }
        }

        if (hitAny) {
            const float t = std::max(0.f, bestHit.fraction - 1e-4f);
            transform.position.x = beforeMove.position.x + delta.x * t;
            transform.position.y = beforeMove.position.y + delta.y * t;
            if (std::abs(bestHit.normal.x) > 0.f)
                horizontalVelocity = 0.f;
            if (std::abs(bestHit.normal.y) > 0.f)
                verticalVelocity = 0.f;
        }
    }

    for (int pass = 0; pass < 4; ++pass) {
        bool resolvedAny = false;
        for (const CollisionWorld::ShapeRef& authoredSelf : collisionWorld_.shapes()) {
            if (authoredSelf.id != id)
                continue;
            if (!authoredSelf.shape.enabled
                || authoredSelf.shape.response != CollisionResponse::Solid)
                continue;
            if (authoredSelf.shape.role != CollisionShapeRole::Body
                && authoredSelf.shape.role != CollisionShapeRole::Feet)
                continue;

            CollisionWorld::ShapeRef selfRef = authoredSelf;
            selfRef.instance =
                CollisionWorld::shapeInstance(transform, selfRef.shape);
            selfRef.aabb = PhysicsMath::shapeWorldAabb(selfRef.instance);

            const auto prevAabb = PhysicsMath::shapeWorldAabb(
                CollisionWorld::shapeInstance(beforeMove, selfRef.shape));

            for (const CollisionWorld::ShapeRef& other : collisionWorld_.shapes()) {
                if (resolvedAny || other.id == id)
                    break;
                if (!other.shape.enabled
                    || other.shape.response != CollisionResponse::Solid)
                    continue;
                if (!CollisionWorld::canCollide(selfRef, other))
                    continue;
                if (!PhysicsMath::aabbOverlap(selfRef.aabb, other.aabb))
                    continue;
                if (!PhysicsMath::shapesOverlap(selfRef.instance, other.instance))
                    continue;
                if (other.shape.oneWay
                    && !(verticalVelocity >= 0.f
                         && prevAabb.maxY <= other.aabb.minY + 2.f))
                    continue;

                Vec2 correction{};
                if (!PhysicsMath::resolveAabbSeparation(selfRef.aabb, other.aabb, correction))
                    continue;
                transform.position.x += correction.x;
                transform.position.y += correction.y;
                if (std::abs(correction.x) > 1e-6f) horizontalVelocity = 0.f;
                if (std::abs(correction.y) > 1e-6f) verticalVelocity = 0.f;
                resolvedAny = true;
            }
        }
        if (!resolvedAny) break;
    }
}

void World::setRenderer(Modules::Renderer* renderer) {
    renderer_ = renderer;
}

bool World::followCameraTarget(EntityId id) {
    Transform transform{};
    if (id == INVALID_ENTITY || !entityGateway_.getTransform(id, transform))
        return false;
    cameraFollowMode_ = CameraFollowMode::Explicit;
    cameraFollowTarget_ = id;
    return true;
}

void World::stopCameraFollow() {
    cameraFollowMode_ = CameraFollowMode::Disabled;
    cameraFollowTarget_ = INVALID_ENTITY;
}

void World::useAutomaticCameraTarget() {
    cameraFollowMode_ = CameraFollowMode::Automatic;
    cameraFollowTarget_ = INVALID_ENTITY;
}

void World::tickGameplaySystems(float dt) {
    if (const SceneDef* sc = entityGateway_.activeScene())
        activeTilemap_ = sc->tilemap;
    // Platformer runs in Application::tickFixedStep after Lua, before physics.step
    // (see FIXED_STEP_CONTRACT).
    tickTopDownControllers(dt);
    tickLinearMovers(dt);
    tickMagneticItems(dt);
    tickHordeMembers(dt);
    tickHealthCooldowns(dt);
    // tickSensorOverlapEdges() intentionally NOT called here — sensor
    // edges must be computed against fresh post-physics positions, so the
    // app driver invokes refreshSensorEdges() after physics->step() and
    // syncPhysicsToEntities(). See Application::tickFixedStep.
}

void World::refreshSensorEdges() {
    rebuildCollisionWorld();
    collisionWorld_.refreshEvents();
}

void World::flushEntityQueues() {
    entityGateway_.flushPendingOperations();
}

void World::snapEntityToGrid(EntityId id, float cellSize) {
    if (cellSize <= 0.f) return;
    Transform transform{};
    if (!entityGateway_.getTransform(id, transform)) return;
    const float cs = cellSize;
    transform.position.x = std::round(transform.position.x / cs) * cs;
    transform.position.y = std::round(transform.position.y / cs) * cs;
    entityGateway_.setTransform(id, transform);
    if (const uint32_t handle = entityGateway_.physicsHandle(id); handle != 0)
        physics_.setPosition(handle, transform.position);
    rebuildCollisionWorld();
}

void World::moveEntityByOffset(EntityId id, float dx, float dy) {
    Transform transform{};
    if (!entityGateway_.getTransform(id, transform)) return;
    transform.position.x += dx;
    transform.position.y += dy;
    entityGateway_.setTransform(id, transform);
    if (const uint32_t handle = entityGateway_.physicsHandle(id); handle != 0)
        physics_.setPosition(handle, transform.position);
    rebuildCollisionWorld();
}

} // namespace ArtCade

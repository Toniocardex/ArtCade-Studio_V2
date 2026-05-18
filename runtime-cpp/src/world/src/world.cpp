#include "../include/world.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"
#include "../../modules/physics/include/physics.h"
#include <iostream>

namespace ArtCade {

World::World(Modules::RuntimeEntityGateway& gateway,
             Modules::Physics&              ph)
    : entityGateway_(gateway), physics_(ph) {}

void World::init(const ProjectDoc& doc) {
    entityGateway_.replaceProject(doc.scenes, doc.entities, doc.activeSceneId);

    // Phase D2: static Box2D bodies for `solid` tiles of the active scene.
    auto sceneIt = doc.scenes.find(doc.activeSceneId);
    if (sceneIt == doc.scenes.end()) return;
    const TilemapData& tm = sceneIt->second.tilemap;
    if (tm.cols <= 0 || tm.rows <= 0) return;

    std::unordered_map<int, bool> solid;
    for (const auto& e : doc.tilePalette) solid[e.id] = e.solid;

    int created = 0;
    const int n = static_cast<int>(tm.data.size());
    for (int r = 0; r < tm.rows; ++r) {
        for (int c = 0; c < tm.cols; ++c) {
            const int idx = r * tm.cols + c;
            if (idx >= n) continue;
            const int id = tm.data[idx];
            if (id <= 0) continue;
            auto si = solid.find(id);
            if (si == solid.end() || !si->second) continue;

            PhysicsComponent pc;
            pc.bodyType         = BodyType::Static;
            pc.collider.shape   = ColliderShape::Rectangle;
            pc.collider.size    = { tm.tileSize, tm.tileSize };
            const uint32_t h = physics_.createBody(INVALID_ENTITY, pc);
            physics_.setPosition(h, {
                c * tm.tileSize + tm.tileSize * 0.5f,
                r * tm.tileSize + tm.tileSize * 0.5f });
            ++created;
        }
    }
    std::cout << "[Tilemap] " << created
              << " solid collision bodies created\n";
}

void World::shutdown() {
    globalState_.clear();
}

bool World::loadScene(const SceneId& id) {
    return entityGateway_.loadScene(id);
}

SceneId World::activeSceneId() const {
    return entityGateway_.activeSceneId();
}

void World::syncPhysicsToEntities() {
    for (EntityId id : entityGateway_.allIds()) {
        auto* e = entityGateway_.get(id);
        if (!e || e->physics.physicsHandle == 0) continue;

        e->transform.position = physics_.getPosition(e->physics.physicsHandle);
        auto vel = physics_.getLinearVelocity(e->physics.physicsHandle);
        e->transform.velocity = vel;
    }
}

bool World::hasGlobalState(const std::string& key) const {
    return globalState_.count(key) > 0;
}

StateValue World::getGlobalState(const std::string& key) const {
    auto it = globalState_.find(key);
    return (it != globalState_.end()) ? it->second : StateValue{0};
}

void World::setGlobalState(const std::string& key, const StateValue& value) {
    globalState_[key] = value;
}

std::vector<EntityId> World::activeEntityIds() const {
    return entityGateway_.activeSceneIds();
}

} // namespace ArtCade

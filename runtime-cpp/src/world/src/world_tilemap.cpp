#include "../include/world.h"
#include "../../modules/physics/include/physics.h"
#include "../../modules/runtime-entity-gateway/include/runtime-entity-gateway.h"

#include <cmath>
#include <iostream>

namespace ArtCade {

void World::clearTilemapPhysics() {
    for (uint32_t h : tilePhysicsHandles_)
        physics_.destroyBody(h);
    tilePhysicsHandles_.clear();
}

void World::rebuildTilemapPhysics() {
    clearTilemapPhysics();

    const SceneDef* scene = entityGateway_.activeScene();
    if (!scene) {
        activeTilemap_ = TilemapData{};
        return;
    }

    activeTilemap_ = scene->tilemap;
    const TilemapData& tm = activeTilemap_;
    if (tm.cols <= 0 || tm.rows <= 0) return;

    int created = 0;
    const int n = static_cast<int>(tm.data.size());
    for (int r = 0; r < tm.rows; ++r) {
        for (int c = 0; c < tm.cols; ++c) {
            const int idx = r * tm.cols + c;
            if (idx >= n) continue;
            const int id = tm.data[idx];
            if (id <= 0) continue;
            auto si = tileSolid_.find(id);
            if (si == tileSolid_.end() || !si->second) continue;

            PhysicsComponent pc;
            pc.bodyType       = BodyType::Static;
            pc.collider.shape = ColliderShape::Rectangle;
            pc.collider.size  = { tm.tileSize, tm.tileSize };
            const uint32_t h = physics_.createBody(INVALID_ENTITY, pc);
            physics_.setPosition(h, {
                c * tm.tileSize + tm.tileSize * 0.5f,
                r * tm.tileSize + tm.tileSize * 0.5f });
            tilePhysicsHandles_.push_back(h);
            ++created;
        }
    }
    std::cout << "[Tilemap] " << created << " solid collision bodies created\n";
}

bool World::isSpaceFree(float x, float y, float w, float h) const {
    const auto& tm = activeTilemap_;
    if (tm.cols <= 0 || tm.rows <= 0 || tm.tileSize <= 0.f) return true;

    const float ts = tm.tileSize;
    const int c0 = static_cast<int>(std::floor(x / ts));
    const int r0 = static_cast<int>(std::floor(y / ts));
    const int c1 = static_cast<int>(std::floor((x + w) / ts));
    const int r1 = static_cast<int>(std::floor((y + h) / ts));

    for (int r = r0; r <= r1; ++r) {
        for (int c = c0; c <= c1; ++c) {
            if (c < 0 || r < 0 || c >= tm.cols || r >= tm.rows) return false;
            const int idx = r * tm.cols + c;
            if (idx >= static_cast<int>(tm.data.size())) continue;
            const int tid = tm.data[idx];
            if (tid <= 0) continue;
            auto it = tileSolid_.find(tid);
            if (it != tileSolid_.end() && it->second) return false;
        }
    }
    return true;
}

} // namespace ArtCade

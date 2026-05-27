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

bool World::needsTilemapPhysicsBodies() const {
    return physics_.hasDynamicBodies();
}

void World::syncTilemapPhysicsWithDynamics() {
    if (needsTilemapPhysicsBodies()) {
        if (tilePhysicsHandles_.empty()
            && activeTilemap_.cols > 0 && activeTilemap_.rows > 0)
            rebuildTilemapPhysics();
        return;
    }
    if (!tilePhysicsHandles_.empty())
        clearTilemapPhysics();
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

    if (!needsTilemapPhysicsBodies()) {
        std::cout << "[Tilemap] 0 solid collision bodies (platformer grid only)\n";
        return;
    }

    auto isSolidCell = [&](int col, int row) -> bool {
        if (col < 0 || row < 0 || col >= tm.cols || row >= tm.rows)
            return false;
        const int idx = row * tm.cols + col;
        if (idx >= static_cast<int>(tm.data.size()))
            return false;
        const int id = tm.data[idx];
        if (id <= 0) return false;
        auto si = tileMeta_.find(id);
        return si != tileMeta_.end() && si->second.blocks;
    };

    int created = 0;
    const float ts = tm.tileSize;

    for (int r = 0; r < tm.rows; ++r) {
        int c = 0;
        while (c < tm.cols) {
            if (!isSolidCell(c, r)) {
                ++c;
                continue;
            }
            int runStart = c;
            while (c < tm.cols && isSolidCell(c, r))
                ++c;
            const int runLen = c - runStart;
            const float width  = runLen * ts;
            const float height = ts;
            const float centerX =
                runStart * ts + width * 0.5f;
            const float centerY = r * ts + height * 0.5f;

            PhysicsComponent pc;
            pc.bodyType       = BodyType::Static;
            pc.collider.shape = ColliderShape::Rectangle;
            pc.collider.size  = { width, height };
            const uint32_t h = physics_.createBody(INVALID_ENTITY, pc);
            physics_.setPosition(h, { centerX, centerY });
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
            auto it = tileMeta_.find(tid);
            if (it != tileMeta_.end() && it->second.blocks) return false;
        }
    }
    return true;
}

} // namespace ArtCade

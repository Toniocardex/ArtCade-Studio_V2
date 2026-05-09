#pragma once

#include "../engine/types.h"
#include <unordered_map>
#include <vector>
#include <string>

namespace ArtCade {

/**
 * EntityManager: Stores and manages all entities
 *
 * Provides entity creation, destruction, lookup, and pool queries.
 */
class EntityManager {
public:
    EntityManager();
    ~EntityManager();

    void init();
    void shutdown();

    // Entity creation/destruction
    EntityId createEntity(const EntityDef& def);
    void destroyEntity(EntityId id);
    bool entityExists(EntityId id) const;

    // Entity access
    EntityDef* getEntity(EntityId id);
    const EntityDef* getEntity(EntityId id) const;

    // Pool queries (by className)
    std::vector<EntityId> getPool(const std::string& className) const;
    size_t getPoolCount(const std::string& className) const;

    // Tag queries
    std::vector<EntityId> getEntitiesByTag(const std::string& tag) const;

    // Update
    void update(float deltaTime);

    // Get all entities
    std::vector<EntityId> getAllEntities() const;

    // Get class index for fast lookups
    const std::unordered_map<std::string, std::vector<EntityId>>& getClassIndex() const {
        return classIndex_;
    }

private:
    std::unordered_map<EntityId, EntityDef> entities_;
    std::unordered_map<std::string, std::vector<EntityId>> classIndex_; // className -> [entityIds]
    std::unordered_map<std::string, std::vector<EntityId>> tagIndex_;   // tag -> [entityIds]

    void updateClassIndex(EntityId id, const EntityDef& def);
};

} // namespace ArtCade

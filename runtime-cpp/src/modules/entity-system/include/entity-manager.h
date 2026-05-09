#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <vector>
#include <functional>

namespace ArtCade::Modules {

/**
 * EntityManager — runtime entity storage and pool queries.
 *
 * Entities are keyed by EntityId (uint32_t).
 * Class index and tag index enable fast pool queries from Lua.
 */
class EntityManager final : public IModule {
public:
    EntityManager() = default;

    bool init() override;
    void shutdown() override;

    // Entity lifecycle
    EntityId   createEntity(const EntityDef& def);
    void       destroyEntity(EntityId id);
    bool       exists(EntityId id)        const;

    // Access
    EntityDef*       get(EntityId id);
    const EntityDef* get(EntityId id)     const;

    // Pool queries (by className)
    std::vector<EntityId> getPool(const std::string& className)  const;
    size_t                poolCount(const std::string& className) const;

    // Tag queries
    std::vector<EntityId> getByTag(const std::string& tag)       const;

    // Iteration
    std::vector<EntityId> allIds()                                const;

    // Bulk operations
    void forEachInPool(const std::string& className,
                       const std::function<void(EntityId, EntityDef&)>& fn);

private:
    std::unordered_map<EntityId, EntityDef>              entities_;
    std::unordered_map<std::string, std::vector<EntityId>> classIndex_;
    std::unordered_map<std::string, std::vector<EntityId>> tagIndex_;

    EntityId nextId_ = 1;

    void rebuildIndex(EntityId id, const EntityDef& def);
    void removeFromIndex(EntityId id, const EntityDef& def);
};

} // namespace ArtCade::Modules

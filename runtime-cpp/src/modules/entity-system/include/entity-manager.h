#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"

#include <vector>

namespace ArtCade::Modules {

/**
 * EntityManager - legacy runtime entity storage.
 *
 * Entities are keyed by EntityId. Runtime queries and indexes live in
 * RuntimeEntityGateway so this storage can be replaced by EnTT without
 * touching higher-level systems.
 */
class EntityManager final : public IModule {
public:
    EntityManager() = default;

    bool init() override;
    void shutdown() override;

    EntityId createEntity(const EntityDef& def);
    void     destroyEntity(EntityId id);
    bool     exists(EntityId id) const;

    EntityDef*       get(EntityId id);
    const EntityDef* get(EntityId id) const;

    std::vector<EntityId> allIds() const;

    void clear();

private:
    std::unordered_map<EntityId, EntityDef> entities_;
    EntityId nextId_ = 1;
};

} // namespace ArtCade::Modules

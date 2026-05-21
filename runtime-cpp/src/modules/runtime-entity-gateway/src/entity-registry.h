#pragma once

#include "../../../core/types.h"

#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::Modules {

/**
 * EntityRegistry — internal storage abstraction for RuntimeEntityGateway.
 *
 * Owns the runtime component bag (transform / sprite / physics / sensor /
 * platformer / autoDestroy / physicsHandle / sceneActive) plus the
 * className and tag indexes that back pool / by-tag queries.
 *
 * The gateway is the ONLY consumer — this header lives under src/ so it is
 * not part of the module's public include surface. The gateway exposes
 * its existing API (get/setTransform, poolByClass, ...) on top; this class
 * is the seam where entt::registry will land later. When that swap
 * happens the gateway public API does not move, only this implementation.
 *
 * Design choices:
 *   • One record per EntityId. Empty for ids that were touched without
 *     ever receiving an identity (matches the previous "default record on
 *     first write" semantics of `runtimeState_[id]`).
 *   • Indexes are rebuilt on identity change (setIdentity removes the
 *     previous className / tags from the indexes before re-inserting).
 *   • Queries return `std::vector<EntityId>` by value: callers iterate
 *     while ids may be erased (queueDestroy → flushPendingOperations →
 *     erase()), and the previous gateway code already paid that cost.
 *   • No id allocation. EntityId still comes from EntityManager during the
 *     transition; once EntityManager is retired this class will absorb
 *     allocation too.
 */
class EntityRegistry final {
public:
    EntityRegistry();
    ~EntityRegistry();

    EntityRegistry(const EntityRegistry&)            = delete;
    EntityRegistry& operator=(const EntityRegistry&) = delete;

    // ---- Records --------------------------------------------------------

    /** Ensure a record exists for `id` (idempotent). Returns true if a new
     *  record was inserted, false if one was already there. */
    bool touch(EntityId id);
    /** Drop the record and any index references. */
    void erase(EntityId id);
    bool contains(EntityId id) const;
    void clear();

    std::vector<EntityId> allIds() const;

    // ---- Identity + indexes --------------------------------------------

    /** Set className + tags for `id`, refreshing both indexes. */
    void setIdentity(EntityId id, std::string className,
                     std::vector<std::string> tags);

    const std::string& className(EntityId id) const;
    const std::vector<std::string>& tags(EntityId id) const;

    /** Insertion-order list of ids carrying `className`. */
    std::vector<EntityId> idsByClass(const std::string& className) const;
    /** Insertion-order list of ids carrying `tag`. */
    std::vector<EntityId> idsByTag(const std::string& tag) const;

    // ---- Scene activation ----------------------------------------------

    bool sceneActive(EntityId id) const;
    void setSceneActive(EntityId id, bool active);

    // ---- Components ----------------------------------------------------

    bool getTransform(EntityId id, Transform& out) const;
    void setTransform(EntityId id, const Transform& t);

    bool getSprite(EntityId id, SpriteComponent& out) const;
    void setSprite(EntityId id, const SpriteComponent& s);

    bool getPhysics(EntityId id, PhysicsComponent& out) const;
    void setPhysics(EntityId id, const PhysicsComponent& p);

    bool getSensor(EntityId id, SensorComponent& out) const;
    void setSensor(EntityId id, const std::optional<SensorComponent>& s);

    bool getPlatformer(EntityId id, PlatformerControllerComponent& out) const;
    void setPlatformer(EntityId id,
                       const std::optional<PlatformerControllerComponent>& p);

    bool getAutoDestroy(EntityId id, AutoDestroyComponent& out) const;
    void setAutoDestroy(EntityId id,
                        const std::optional<AutoDestroyComponent>& ad);

    // ---- Physics handle ------------------------------------------------

    uint32_t physicsHandle(EntityId id) const;
    void     setPhysicsHandle(EntityId id, uint32_t handle);

private:
    struct Record {
        bool                                           sceneActive   = false;
        uint32_t                                       physicsHandle = 0;
        Transform                                      transform;
        SpriteComponent                                sprite;
        PhysicsComponent                               physics;
        std::optional<SensorComponent>                 sensor;
        std::optional<PlatformerControllerComponent>   platformer;
        std::optional<AutoDestroyComponent>            autoDestroy;
        std::string                                    className;
        std::vector<std::string>                       tags;
    };

    std::unordered_map<EntityId, Record>                       records_;
    std::unordered_map<std::string, std::vector<EntityId>>     classIndex_;
    std::unordered_map<std::string, std::vector<EntityId>>     tagIndex_;

    Record*       find(EntityId id);
    const Record* find(EntityId id) const;
    void          removeFromIndexes(EntityId id);
};

} // namespace ArtCade::Modules

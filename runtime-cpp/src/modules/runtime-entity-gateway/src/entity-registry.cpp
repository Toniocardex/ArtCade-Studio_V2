#include "entity-registry.h"

#include <algorithm>
#include <utility>

namespace ArtCade::Modules {

namespace {

void eraseId(std::vector<EntityId>& ids, EntityId id) {
    ids.erase(std::remove(ids.begin(), ids.end(), id), ids.end());
}

} // namespace

EntityRegistry::EntityRegistry()  = default;
EntityRegistry::~EntityRegistry() = default;

// ---- Records ---------------------------------------------------------------

EntityId EntityRegistry::allocate(EntityId hint) {
    EntityId id;
    if (hint != 0 && records_.find(hint) == records_.end()) {
        id = hint;
    } else {
        // Skip ids already taken by previous hint-based allocations.
        while (records_.find(nextId_) != records_.end()) ++nextId_;
        id = nextId_++;
    }
    if (id >= nextId_) nextId_ = id + 1;
    records_.try_emplace(id);
    return id;
}

bool EntityRegistry::touch(EntityId id) {
    return records_.try_emplace(id).second;
}

void EntityRegistry::erase(EntityId id) {
    removeFromIndexes(id);
    records_.erase(id);
}

bool EntityRegistry::contains(EntityId id) const {
    return records_.find(id) != records_.end();
}

void EntityRegistry::clear() {
    records_.clear();
    classIndex_.clear();
    tagIndex_.clear();
    nextId_ = 1;
}

std::vector<EntityId> EntityRegistry::allIds() const {
    std::vector<EntityId> ids;
    ids.reserve(records_.size());
    for (const auto& [id, _] : records_)
        ids.push_back(id);
    return ids;
}

// ---- Identity + indexes ---------------------------------------------------

void EntityRegistry::setIdentity(EntityId id,
                                 std::string className,
                                 std::vector<std::string> tags) {
    // Drop previous index references — identity can change for an existing
    // record (matters for editor live edits, even if not exercised yet).
    removeFromIndexes(id);

    Record& r = records_[id];
    r.className = std::move(className);
    r.tags      = std::move(tags);

    classIndex_[r.className].push_back(id);
    for (const std::string& tag : r.tags)
        tagIndex_[tag].push_back(id);
}

const std::string& EntityRegistry::className(EntityId id) const {
    static const std::string empty;
    const Record* r = find(id);
    return r ? r->className : empty;
}

const std::vector<std::string>& EntityRegistry::tags(EntityId id) const {
    static const std::vector<std::string> empty;
    const Record* r = find(id);
    return r ? r->tags : empty;
}

std::vector<EntityId>
EntityRegistry::idsByClass(const std::string& className) const {
    auto it = classIndex_.find(className);
    if (it == classIndex_.end()) return {};
    return it->second;
}

std::vector<EntityId>
EntityRegistry::idsByTag(const std::string& tag) const {
    auto it = tagIndex_.find(tag);
    if (it == tagIndex_.end()) return {};
    return it->second;
}

// ---- Scene activation -----------------------------------------------------

bool EntityRegistry::sceneActive(EntityId id) const {
    const Record* r = find(id);
    return r && r->sceneActive;
}

void EntityRegistry::setSceneActive(EntityId id, bool active) {
    if (Record* r = find(id))
        r->sceneActive = active;
}

// ---- Components -----------------------------------------------------------

bool EntityRegistry::getTransform(EntityId id, Transform& out) const {
    const Record* r = find(id);
    if (!r) return false;
    out = r->transform;
    return true;
}

void EntityRegistry::setTransform(EntityId id, const Transform& t) {
    if (Record* r = find(id))
        r->transform = t;
}

bool EntityRegistry::getSprite(EntityId id, SpriteComponent& out) const {
    const Record* r = find(id);
    if (!r) return false;
    out = r->sprite;
    return true;
}

void EntityRegistry::setSprite(EntityId id, const SpriteComponent& s) {
    if (Record* r = find(id))
        r->sprite = s;
}

bool EntityRegistry::getPhysics(EntityId id, PhysicsComponent& out) const {
    const Record* r = find(id);
    if (!r) return false;
    out = r->physics;
    out.physicsHandle = r->physicsHandle;
    return true;
}

void EntityRegistry::setPhysics(EntityId id, const PhysicsComponent& p) {
    if (Record* r = find(id)) {
        r->physics = p;
        r->physicsHandle = p.physicsHandle;
    }
}

bool EntityRegistry::getSensor(EntityId id, SensorComponent& out) const {
    const Record* r = find(id);
    if (!r || !r->sensor) return false;
    out = *r->sensor;
    return true;
}

void EntityRegistry::setSensor(EntityId id,
                               const std::optional<SensorComponent>& s) {
    if (Record* r = find(id))
        r->sensor = s;
}

bool EntityRegistry::getPlatformer(EntityId id,
                                   PlatformerControllerComponent& out) const {
    const Record* r = find(id);
    if (!r || !r->platformer) return false;
    out = *r->platformer;
    return true;
}

void EntityRegistry::setPlatformer(
    EntityId id, const std::optional<PlatformerControllerComponent>& p) {
    if (Record* r = find(id))
        r->platformer = p;
}

bool EntityRegistry::getAutoDestroy(EntityId id,
                                    AutoDestroyComponent& out) const {
    const Record* r = find(id);
    if (!r || !r->autoDestroy) return false;
    out = *r->autoDestroy;
    return true;
}

void EntityRegistry::setAutoDestroy(
    EntityId id, const std::optional<AutoDestroyComponent>& ad) {
    if (Record* r = find(id))
        r->autoDestroy = ad;
}

// ---- Physics handle -------------------------------------------------------

uint32_t EntityRegistry::physicsHandle(EntityId id) const {
    const Record* r = find(id);
    return r ? r->physicsHandle : 0u;
}

void EntityRegistry::setPhysicsHandle(EntityId id, uint32_t handle) {
    if (Record* r = find(id)) {
        r->physicsHandle = handle;
        r->physics.physicsHandle = handle;
    }
}

// ---- Helpers --------------------------------------------------------------

EntityRegistry::Record* EntityRegistry::find(EntityId id) {
    auto it = records_.find(id);
    return it != records_.end() ? &it->second : nullptr;
}

const EntityRegistry::Record* EntityRegistry::find(EntityId id) const {
    auto it = records_.find(id);
    return it != records_.end() ? &it->second : nullptr;
}

void EntityRegistry::removeFromIndexes(EntityId id) {
    const Record* r = find(id);
    if (!r) return;

    auto classIt = classIndex_.find(r->className);
    if (classIt != classIndex_.end())
        eraseId(classIt->second, id);

    for (const std::string& tag : r->tags) {
        auto tagIt = tagIndex_.find(tag);
        if (tagIt != tagIndex_.end())
            eraseId(tagIt->second, id);
    }
}

} // namespace ArtCade::Modules

// entity-registry.cpp — EnTT-backed implementation of EntityRegistry.
//
// Public API is dictated by entity-registry.h (which the gateway includes).
// All EnTT-specific types live here; the gateway only sees the EntityId
// uint32 surface.
//
// Component layout inside `entt::registry`:
//   - Transform, SpriteComponent, PhysicsComponent : always present once a
//     record is touched (mirrors the previous "default record on first
//     write" semantics; equivalent to value-initialized fields in the old
//     Record struct).
//   - SensorComponent, PlatformerControllerComponent, AutoDestroyComponent:
//     opt-in components — emplaced when set with a non-empty optional,
//     removed when set with std::nullopt.
//   - SceneActiveTag : empty tag, presence == active in current scene.
//   - PhysicsHandle  : small uint32 wrapper, separate from PhysicsComponent
//     because the handle changes for body lifetime independently of the
//     authored physics data.
//   - Identity       : className + tags metadata (kept in EnTT for symmetry,
//                      but className/tag *indexes* are still manual vectors
//                      because EnTT views don't guarantee stable order).

#include "entity-registry.h"

#include <entt/entt.hpp>

#include <algorithm>
#include <unordered_map>
#include <utility>

namespace ArtCade::Modules {

namespace {

struct PhysicsHandleComp { uint32_t value = 0; };
struct SceneActiveTag    {};
struct Identity {
    std::string              className;
    std::vector<std::string> tags;
};

void eraseId(std::vector<EntityId>& ids, EntityId id) {
    ids.erase(std::remove(ids.begin(), ids.end(), id), ids.end());
}

} // namespace

struct EntityRegistry::Impl {
    entt::registry reg;

    // EntityId (project-stable uint32) → entt::entity (entt's compact id).
    std::unordered_map<EntityId, entt::entity> ids;

    // Insertion-order indexes for deterministic iteration. EnTT views do
    // not guarantee a stable ordering across runs, so we maintain these
    // by hand on setIdentity / erase.
    std::unordered_map<std::string, std::vector<EntityId>> classIndex;
    std::unordered_map<std::string, std::vector<EntityId>> tagIndex;

    EntityId nextId = 1;

    entt::entity toEntt(EntityId id) const {
        auto it = ids.find(id);
        return (it != ids.end()) ? it->second : entt::null;
    }

    entt::entity ensure(EntityId id) {
        auto it = ids.find(id);
        if (it != ids.end()) return it->second;
        const entt::entity e = reg.create();
        ids.emplace(id, e);
        // Default-initialize the "always present" components, matching
        // the previous "value-initialized record fields" contract.
        reg.emplace<Transform>(e);
        reg.emplace<SpriteComponent>(e);
        reg.emplace<PhysicsComponent>(e);
        reg.emplace<PhysicsHandleComp>(e);
        reg.emplace<Identity>(e);
        return e;
    }

    void removeFromIndexes(EntityId id) {
        const entt::entity e = toEntt(id);
        if (e == entt::null) return;
        if (auto* ident = reg.try_get<Identity>(e)) {
            auto cit = classIndex.find(ident->className);
            if (cit != classIndex.end()) eraseId(cit->second, id);
            for (const std::string& t : ident->tags) {
                auto tit = tagIndex.find(t);
                if (tit != tagIndex.end()) eraseId(tit->second, id);
            }
        }
    }
};

EntityRegistry::EntityRegistry()  : impl_(std::make_unique<Impl>()) {}
EntityRegistry::~EntityRegistry() = default;

// ---- Records ---------------------------------------------------------------

EntityId EntityRegistry::allocate(EntityId hint) {
    EntityId id;
    if (hint != 0 && impl_->ids.find(hint) == impl_->ids.end()) {
        id = hint;
    } else {
        while (impl_->ids.find(impl_->nextId) != impl_->ids.end())
            ++impl_->nextId;
        id = impl_->nextId++;
    }
    if (id >= impl_->nextId) impl_->nextId = id + 1;
    impl_->ensure(id);
    return id;
}

bool EntityRegistry::touch(EntityId id) {
    if (impl_->ids.find(id) != impl_->ids.end()) return false;
    impl_->ensure(id);
    return true;
}

void EntityRegistry::erase(EntityId id) {
    impl_->removeFromIndexes(id);
    const entt::entity e = impl_->toEntt(id);
    if (e != entt::null) {
        impl_->reg.destroy(e);
        impl_->ids.erase(id);
    }
}

bool EntityRegistry::contains(EntityId id) const {
    return impl_->ids.find(id) != impl_->ids.end();
}

void EntityRegistry::clear() {
    impl_->reg.clear();
    impl_->ids.clear();
    impl_->classIndex.clear();
    impl_->tagIndex.clear();
    impl_->nextId = 1;
}

std::vector<EntityId> EntityRegistry::allIds() const {
    std::vector<EntityId> out;
    out.reserve(impl_->ids.size());
    for (const auto& [id, _] : impl_->ids)
        out.push_back(id);
    return out;
}

// ---- Identity + indexes ---------------------------------------------------

void EntityRegistry::setIdentity(EntityId id,
                                 std::string className,
                                 std::vector<std::string> tags) {
    impl_->removeFromIndexes(id);

    const entt::entity e = impl_->ensure(id);
    Identity& ident = impl_->reg.get<Identity>(e);
    ident.className = std::move(className);
    ident.tags      = std::move(tags);

    impl_->classIndex[ident.className].push_back(id);
    for (const std::string& tag : ident.tags)
        impl_->tagIndex[tag].push_back(id);
}

const std::string& EntityRegistry::className(EntityId id) const {
    static const std::string empty;
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return empty;
    if (const auto* ident = impl_->reg.try_get<Identity>(e))
        return ident->className;
    return empty;
}

const std::vector<std::string>& EntityRegistry::tags(EntityId id) const {
    static const std::vector<std::string> empty;
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return empty;
    if (const auto* ident = impl_->reg.try_get<Identity>(e))
        return ident->tags;
    return empty;
}

std::vector<EntityId>
EntityRegistry::idsByClass(const std::string& className) const {
    auto it = impl_->classIndex.find(className);
    if (it == impl_->classIndex.end()) return {};
    return it->second;
}

std::vector<EntityId>
EntityRegistry::idsByTag(const std::string& tag) const {
    auto it = impl_->tagIndex.find(tag);
    if (it == impl_->tagIndex.end()) return {};
    return it->second;
}

// ---- Scene activation -----------------------------------------------------

bool EntityRegistry::sceneActive(EntityId id) const {
    const entt::entity e = impl_->toEntt(id);
    return e != entt::null && impl_->reg.all_of<SceneActiveTag>(e);
}

void EntityRegistry::setSceneActive(EntityId id, bool active) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    if (active) impl_->reg.emplace_or_replace<SceneActiveTag>(e);
    else        impl_->reg.remove<SceneActiveTag>(e);
}

// ---- Components -----------------------------------------------------------

bool EntityRegistry::getTransform(EntityId id, Transform& out) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return false;
    if (const auto* c = impl_->reg.try_get<Transform>(e)) { out = *c; return true; }
    return false;
}

void EntityRegistry::setTransform(EntityId id, const Transform& t) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    impl_->reg.emplace_or_replace<Transform>(e, t);
}

bool EntityRegistry::getSprite(EntityId id, SpriteComponent& out) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return false;
    if (const auto* c = impl_->reg.try_get<SpriteComponent>(e)) { out = *c; return true; }
    return false;
}

void EntityRegistry::setSprite(EntityId id, const SpriteComponent& s) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    impl_->reg.emplace_or_replace<SpriteComponent>(e, s);
}

bool EntityRegistry::getPhysics(EntityId id, PhysicsComponent& out) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return false;
    if (const auto* c = impl_->reg.try_get<PhysicsComponent>(e)) {
        out = *c;
        if (const auto* h = impl_->reg.try_get<PhysicsHandleComp>(e))
            out.physicsHandle = h->value;
        return true;
    }
    return false;
}

void EntityRegistry::setPhysics(EntityId id, const PhysicsComponent& p) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    impl_->reg.emplace_or_replace<PhysicsComponent>(e, p);
    impl_->reg.emplace_or_replace<PhysicsHandleComp>(e, PhysicsHandleComp{ p.physicsHandle });
}

bool EntityRegistry::getSensor(EntityId id, SensorComponent& out) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return false;
    if (const auto* c = impl_->reg.try_get<SensorComponent>(e)) { out = *c; return true; }
    return false;
}

void EntityRegistry::setSensor(EntityId id,
                               const std::optional<SensorComponent>& s) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    if (s) impl_->reg.emplace_or_replace<SensorComponent>(e, *s);
    else   impl_->reg.remove<SensorComponent>(e);
}

bool EntityRegistry::getPlatformer(EntityId id,
                                   PlatformerControllerComponent& out) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return false;
    if (const auto* c = impl_->reg.try_get<PlatformerControllerComponent>(e)) {
        out = *c;
        return true;
    }
    return false;
}

void EntityRegistry::setPlatformer(
    EntityId id, const std::optional<PlatformerControllerComponent>& p) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    if (p) impl_->reg.emplace_or_replace<PlatformerControllerComponent>(e, *p);
    else   impl_->reg.remove<PlatformerControllerComponent>(e);
}

bool EntityRegistry::getAutoDestroy(EntityId id,
                                    AutoDestroyComponent& out) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return false;
    if (const auto* c = impl_->reg.try_get<AutoDestroyComponent>(e)) {
        out = *c;
        return true;
    }
    return false;
}

void EntityRegistry::setAutoDestroy(
    EntityId id, const std::optional<AutoDestroyComponent>& ad) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    if (ad) impl_->reg.emplace_or_replace<AutoDestroyComponent>(e, *ad);
    else    impl_->reg.remove<AutoDestroyComponent>(e);
}

// ---- Physics handle -------------------------------------------------------

uint32_t EntityRegistry::physicsHandle(EntityId id) const {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return 0u;
    if (const auto* h = impl_->reg.try_get<PhysicsHandleComp>(e))
        return h->value;
    return 0u;
}

void EntityRegistry::setPhysicsHandle(EntityId id, uint32_t handle) {
    const entt::entity e = impl_->toEntt(id);
    if (e == entt::null) return;
    impl_->reg.emplace_or_replace<PhysicsHandleComp>(e, PhysicsHandleComp{ handle });
    if (auto* p = impl_->reg.try_get<PhysicsComponent>(e))
        p->physicsHandle = handle;
}

} // namespace ArtCade::Modules

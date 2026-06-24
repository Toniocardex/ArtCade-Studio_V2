#pragma once

#include "collision_math.h"

#include "../../../core/types.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace ArtCade::CollisionWorld {

struct ShapeRef {
    EntityId id = INVALID_ENTITY;
    size_t   shapeIndex = 0;
    BodyType bodyType = BodyType::Static;
    CollisionShape shape;
    uint32_t layerBits = 0;
    uint32_t maskBits = 0;
    PhysicsMath::ShapeInstance instance;
    PhysicsMath::Aabb aabb;
};

struct RaycastResult {
    bool     hit = false;
    EntityId entityId = INVALID_ENTITY;
    size_t   shapeIndex = 0;
    Vec2     point{};
    float    distance = 0.f;
};

struct Filter {
    std::string layerId;
    std::string role;
    std::string response;
    std::string className;
    std::string tag;
};

struct ContactEvent {
    enum class Kind { Enter, Stay, Exit };
    Kind     kind = Kind::Enter;
    EntityId self = INVALID_ENTITY;
    EntityId other = INVALID_ENTITY;
    std::string selfRole;
    std::string otherRole;
    Vec2 normal{};
    Vec2 point{};
};

struct LayerTable {
    std::unordered_map<std::string, uint32_t> bitsById;

    uint32_t bitFor(const std::string& id) const {
        auto it = bitsById.find(id);
        if (it == bitsById.end()) return 1u;
        return it->second;
    }
};

inline std::string roleName(CollisionShapeRole role) {
    switch (role) {
    case CollisionShapeRole::Feet: return "feet";
    case CollisionShapeRole::Hurtbox: return "hurtbox";
    case CollisionShapeRole::Hitbox: return "hitbox";
    case CollisionShapeRole::Interaction: return "interaction";
    case CollisionShapeRole::Body:
    default: return "body";
    }
}

inline std::string responseName(CollisionResponse response) {
    return response == CollisionResponse::Sensor ? "sensor" : "solid";
}

inline LayerTable makeLayerTable(const std::vector<PhysicsLayerDef>& layers) {
    LayerTable table;
    for (const auto& layer : layers) {
        if (!layer.id.empty() && layer.bit < 32)
            table.bitsById[layer.id] = 1u << layer.bit;
    }
    if (table.bitsById.empty())
        table.bitsById["default"] = 1u;
    return table;
}

inline bool canCollide(const ShapeRef& a, const ShapeRef& b) {
    return (a.layerBits & b.maskBits) != 0
        && (b.layerBits & a.maskBits) != 0;
}

inline bool matchesFilter(const ShapeRef& shape, const Filter& filter) {
    if (!filter.layerId.empty() && shape.shape.layerId != filter.layerId)
        return false;
    if (!filter.role.empty() && roleName(shape.shape.role) != filter.role)
        return false;
    if (!filter.response.empty() && responseName(shape.shape.response) != filter.response)
        return false;
    return true;
}

inline PhysicsMath::ShapeInstance shapeInstance(
    const Transform& transform,
    const CollisionShape& shape)
{
    PhysicsMath::ShapeInstance inst;
    inst.position = transform.position;
    inst.offset = shape.offset;
    inst.size = shape.size;
    if (shape.type == CollisionShapeType::Circle) {
        inst.shape = ColliderShape::Circle;
        inst.size = { std::max(0.5f, shape.radius), std::max(0.5f, shape.radius) };
    } else {
        inst.shape = ColliderShape::Rectangle;
        if (shape.type == CollisionShapeType::Capsule) {
            inst.size = {
                std::max(1.f, shape.size.x),
                std::max(1.f, shape.size.y),
            };
        } else if (shape.type == CollisionShapeType::Polygon && !shape.points.empty()) {
            float minX = shape.points[0].x;
            float maxX = shape.points[0].x;
            float minY = shape.points[0].y;
            float maxY = shape.points[0].y;
            for (const Vec2& p : shape.points) {
                minX = std::min(minX, p.x);
                maxX = std::max(maxX, p.x);
                minY = std::min(minY, p.y);
                maxY = std::max(maxY, p.y);
            }
            inst.offset = {
                shape.offset.x + (minX + maxX) * 0.5f,
                shape.offset.y + (minY + maxY) * 0.5f,
            };
            inst.size = {
                std::max(1.f, maxX - minX),
                std::max(1.f, maxY - minY),
            };
        }
    }
    return inst;
}

class World {
public:
    void setLayers(const std::vector<PhysicsLayerDef>& layers) {
        layers_ = makeLayerTable(layers);
    }

    void clear() {
        shapes_.clear();
        entityRanges_.clear();
    }

    void addEntity(EntityId id,
                   const Transform& transform,
                   const CollisionBodyComponent& body)
    {
        if (!body.enabled) return;
        const size_t start = shapes_.size();
        for (size_t i = 0; i < body.shapes.size(); ++i) {
            const CollisionShape& shape = body.shapes[i];
            if (!shape.enabled) continue;
            ShapeRef ref;
            ref.id = id;
            ref.shapeIndex = i;
            ref.bodyType = body.bodyType;
            ref.shape = shape;
            ref.layerBits = layers_.bitFor(shape.layerId);
            ref.maskBits = 0;
            for (const std::string& maskId : shape.maskLayerIds)
                ref.maskBits |= layers_.bitFor(maskId);
            if (ref.maskBits == 0) ref.maskBits = 1u;
            ref.instance = shapeInstance(transform, shape);
            ref.aabb = PhysicsMath::shapeWorldAabb(ref.instance);
            shapes_.push_back(std::move(ref));
        }
        entityRanges_[id] = { start, shapes_.size() };
    }

    bool overlapEntities(EntityId a, EntityId b, const Filter& filter = {}) const {
        for (const ShapeRef* sa : shapesFor(a)) {
            for (const ShapeRef* sb : shapesFor(b)) {
                if (!matchesFilter(*sb, filter)) continue;
                if (!canCollide(*sa, *sb)) continue;
                if (PhysicsMath::shapesOverlap(sa->instance, sb->instance))
                    return true;
            }
        }
        return false;
    }

    EntityId firstTouching(EntityId id, const Filter& filter = {}) const {
        for (const ShapeRef* self : shapesFor(id)) {
            for (const ShapeRef& other : shapes_) {
                if (other.id == id) continue;
                if (!matchesFilter(other, filter)) continue;
                if (!canCollide(*self, other)) continue;
                if (PhysicsMath::shapesOverlap(self->instance, other.instance))
                    return other.id;
            }
        }
        return INVALID_ENTITY;
    }

    RaycastResult raycast(const Vec2& from,
                          const Vec2& to,
                          const Filter& filter = {}) const
    {
        RaycastResult result;
        PhysicsMath::RaycastHit best;
        for (const ShapeRef& shape : shapes_) {
            if (shape.shape.response == CollisionResponse::Sensor) continue;
            if (!matchesFilter(shape, filter)) continue;
            const PhysicsMath::RaycastHit hit =
                PhysicsMath::raycastSegmentVsShape(from, to, shape.instance);
            if (!hit.hit || hit.fraction >= best.fraction)
                continue;
            best = hit;
            result.hit = true;
            result.entityId = shape.id;
            result.shapeIndex = shape.shapeIndex;
            result.point = hit.point;
        }
        if (result.hit) {
            const float dx = result.point.x - from.x;
            const float dy = result.point.y - from.y;
            result.distance = std::sqrt(dx * dx + dy * dy);
        }
        return result;
    }

    bool isGrounded(EntityId id) const {
        Filter ground;
        ground.response = "solid";
        for (const ShapeRef* feet : shapesFor(id)) {
            if (feet->shape.role != CollisionShapeRole::Feet
                && feet->shape.role != CollisionShapeRole::Body)
                continue;
            PhysicsMath::Aabb probe = feet->aabb;
            probe.minY = probe.maxY - 2.f;
            probe.maxY += 4.f;
            for (const ShapeRef& other : shapes_) {
                if (other.id == id || other.shape.response != CollisionResponse::Solid)
                    continue;
                if (!canCollide(*feet, other)) continue;
                if (PhysicsMath::aabbOverlap(probe, other.aabb)
                    && feet->aabb.maxY <= other.aabb.minY + 4.f)
                    return true;
            }
        }
        return false;
    }

    std::vector<ContactEvent> refreshEvents() {
        std::unordered_set<uint64_t> current;
        current.reserve(shapes_.size() * 2);
        std::vector<ContactEvent> events;
        for (size_t i = 0; i < shapes_.size(); ++i) {
            for (size_t j = i + 1; j < shapes_.size(); ++j) {
                const ShapeRef& a = shapes_[i];
                const ShapeRef& b = shapes_[j];
                if (a.id == b.id || !canCollide(a, b)) continue;
                if (!PhysicsMath::shapesOverlap(a.instance, b.instance)) continue;
                const uint64_t key = pairKey(i, j);
                current.insert(key);
                events.push_back(makeEvent(
                    activePairs_.count(key) ? ContactEvent::Kind::Stay : ContactEvent::Kind::Enter,
                    a, b));
            }
        }
        for (uint64_t key : activePairs_) {
            if (current.count(key) == 0)
                events.push_back(ContactEvent{ ContactEvent::Kind::Exit });
        }
        activePairs_ = std::move(current);
        return events;
    }

    const std::vector<ShapeRef>& shapes() const { return shapes_; }

private:
    std::vector<const ShapeRef*> shapesFor(EntityId id) const {
        std::vector<const ShapeRef*> out;
        auto it = entityRanges_.find(id);
        if (it == entityRanges_.end()) return out;
        out.reserve(it->second.second - it->second.first);
        for (size_t i = it->second.first; i < it->second.second; ++i)
            out.push_back(&shapes_[i]);
        return out;
    }

    static uint64_t pairKey(size_t a, size_t b) {
        if (a > b) std::swap(a, b);
        return (static_cast<uint64_t>(a) << 32)
            | static_cast<uint64_t>(b & 0xffffffffu);
    }

    static ContactEvent makeEvent(ContactEvent::Kind kind,
                                  const ShapeRef& a,
                                  const ShapeRef& b) {
        ContactEvent ev;
        ev.kind = kind;
        ev.self = a.id;
        ev.other = b.id;
        ev.selfRole = roleName(a.shape.role);
        ev.otherRole = roleName(b.shape.role);
        ev.point = {
            (std::max(a.aabb.minX, b.aabb.minX) + std::min(a.aabb.maxX, b.aabb.maxX)) * 0.5f,
            (std::max(a.aabb.minY, b.aabb.minY) + std::min(a.aabb.maxY, b.aabb.maxY)) * 0.5f,
        };
        const float ax = (a.aabb.minX + a.aabb.maxX) * 0.5f;
        const float ay = (a.aabb.minY + a.aabb.maxY) * 0.5f;
        const float bx = (b.aabb.minX + b.aabb.maxX) * 0.5f;
        const float by = (b.aabb.minY + b.aabb.maxY) * 0.5f;
        ev.normal = { bx >= ax ? 1.f : -1.f, by >= ay ? 1.f : -1.f };
        return ev;
    }

    LayerTable layers_;
    std::vector<ShapeRef> shapes_;
    std::unordered_map<EntityId, std::pair<size_t, size_t>> entityRanges_;
    std::unordered_set<uint64_t> activePairs_;
};

} // namespace ArtCade::CollisionWorld

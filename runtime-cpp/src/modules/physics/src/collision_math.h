#pragma once

// collision_math.h — Stateless collision algebra for artcade-physics.
// Screen-space Y-down; axis-aligned shapes only (rotation 0).

#include "../../../core/types.h"
#include <algorithm>
#include <cmath>
#include <limits>

namespace ArtCade::PhysicsMath {

struct Aabb {
    float minX = 0.f;
    float minY = 0.f;
    float maxX = 0.f;
    float maxY = 0.f;
};

struct ShapeInstance {
    ColliderShape shape = ColliderShape::Rectangle;
    Vec2            position{};
    Vec2            offset{};
    Vec2            size{ 1.f, 1.f }; // rect: full w/h; circle: radius in x
};

inline Aabb aabbFromRect(const Vec2& center, float halfW, float halfH) {
    return {
        center.x - halfW,
        center.y - halfH,
        center.x + halfW,
        center.y + halfH,
    };
}

inline Vec2 shapeCenter(const ShapeInstance& s) {
    return { s.position.x + s.offset.x, s.position.y + s.offset.y };
}

inline Aabb shapeWorldAabb(const ShapeInstance& s) {
    const Vec2 c = shapeCenter(s);
    if (s.shape == ColliderShape::Circle) {
        const float r = s.size.x;
        return aabbFromRect(c, r, r);
    }
    return aabbFromRect(c, s.size.x * 0.5f, s.size.y * 0.5f);
}

/** Inclusive edges — touching counts as overlap (matches prior solver queries). */
inline bool aabbOverlap(const Aabb& a, const Aabb& b) {
    return a.minX <= b.maxX && a.maxX >= b.minX
        && a.minY <= b.maxY && a.maxY >= b.minY;
}

inline bool circleCircleOverlap(const Vec2& c1, float r1, const Vec2& c2, float r2) {
    const float dx = c2.x - c1.x;
    const float dy = c2.y - c1.y;
    const float r  = r1 + r2;
    return dx * dx + dy * dy <= r * r;
}

inline bool circleRectOverlap(const Vec2& center, float radius, const Aabb& rect) {
    const float cx = std::clamp(center.x, rect.minX, rect.maxX);
    const float cy = std::clamp(center.y, rect.minY, rect.maxY);
    const float dx = center.x - cx;
    const float dy = center.y - cy;
    return dx * dx + dy * dy <= radius * radius;
}

inline bool shapesOverlap(const ShapeInstance& a, const ShapeInstance& b) {
    const Vec2 ca = shapeCenter(a);
    const Vec2 cb = shapeCenter(b);

    if (a.shape == ColliderShape::Circle && b.shape == ColliderShape::Circle)
        return circleCircleOverlap(ca, a.size.x, cb, b.size.x);

    const Aabb aa = shapeWorldAabb(a);
    const Aabb ab = shapeWorldAabb(b);

    if (a.shape == ColliderShape::Rectangle && b.shape == ColliderShape::Rectangle)
        return aabbOverlap(aa, ab);

    if (a.shape == ColliderShape::Circle)
        return circleRectOverlap(ca, a.size.x, ab);
    return circleRectOverlap(cb, b.size.x, aa);
}

/** Minimum translation to separate movable AABB from fixed AABB (Y-down). */
inline bool resolveAabbSeparation(Aabb& movable, const Aabb& fixed, Vec2& outCorrection) {
    if (!aabbOverlap(movable, fixed)) return false;

    const float penLeft  = movable.maxX - fixed.minX;
    const float penRight = fixed.maxX - movable.minX;
    const float penUp    = movable.maxY - fixed.minY;
    const float penDown  = fixed.maxY - movable.minY;

    const float penX = std::min(penLeft, penRight);
    const float penY = std::min(penUp, penDown);

    outCorrection = {};
    if (penX < penY) {
        const float movableCx = (movable.minX + movable.maxX) * 0.5f;
        const float fixedCx   = (fixed.minX + fixed.maxX) * 0.5f;
        outCorrection.x = (movableCx < fixedCx) ? -penX : penX;
    } else {
        const float movableCy = (movable.minY + movable.maxY) * 0.5f;
        const float fixedCy   = (fixed.minY + fixed.maxY) * 0.5f;
        outCorrection.y = (movableCy < fixedCy) ? -penY : penY;
    }
    return true;
}

inline void translateAabb(Aabb& box, const Vec2& delta) {
    box.minX += delta.x;
    box.maxX += delta.x;
    box.minY += delta.y;
    box.maxY += delta.y;
}

struct RaycastHit {
    bool  hit      = false;
    float fraction = 1.f;
    Vec2  point{};
};

/** Segment vs axis-aligned box; returns closest hit with fraction in [0,1]. */
inline RaycastHit raycastSegmentVsAabb(const Vec2& from, const Vec2& to, const Aabb& box) {
    RaycastHit best;
    const Vec2 dir  = { to.x - from.x, to.y - from.y };
    const float len = std::sqrt(dir.x * dir.x + dir.y * dir.y);
    if (len < 1e-6f) {
        const bool inside = from.x >= box.minX && from.x <= box.maxX
                         && from.y >= box.minY && from.y <= box.maxY;
        if (inside) {
            best.hit      = true;
            best.fraction = 0.f;
            best.point    = from;
        }
        return best;
    }

    float tMin = 0.f;
    float tMax = 1.f;

    const float invDx = std::abs(dir.x) > 1e-8f ? 1.f / dir.x : 0.f;
    const float invDy = std::abs(dir.y) > 1e-8f ? 1.f / dir.y : 0.f;

    if (std::abs(dir.x) > 1e-8f) {
        float t1 = (box.minX - from.x) * invDx;
        float t2 = (box.maxX - from.x) * invDx;
        if (t1 > t2) std::swap(t1, t2);
        tMin = std::max(tMin, t1);
        tMax = std::min(tMax, t2);
    } else if (from.x < box.minX || from.x > box.maxX) {
        return best;
    }

    if (std::abs(dir.y) > 1e-8f) {
        float t1 = (box.minY - from.y) * invDy;
        float t2 = (box.maxY - from.y) * invDy;
        if (t1 > t2) std::swap(t1, t2);
        tMin = std::max(tMin, t1);
        tMax = std::min(tMax, t2);
    } else if (from.y < box.minY || from.y > box.maxY) {
        return best;
    }

    if (tMax >= tMin && tMax >= 0.f && tMin <= 1.f) {
        const float t = std::clamp(tMin, 0.f, 1.f);
        best.hit      = true;
        best.fraction = t;
        best.point    = { from.x + dir.x * t, from.y + dir.y * t };
    }
    return best;
}

inline RaycastHit raycastSegmentVsCircle(const Vec2& from, const Vec2& to,
                                         const Vec2& center, float radius) {
    RaycastHit best;
    const Vec2  d  = { to.x - from.x, to.y - from.y };
    const Vec2  f  = { from.x - center.x, from.y - center.y };
    const float a  = d.x * d.x + d.y * d.y;
    if (a < 1e-8f) {
        const float distSq = f.x * f.x + f.y * f.y;
        if (distSq <= radius * radius) {
            best.hit      = true;
            best.fraction = 0.f;
            best.point    = from;
        }
        return best;
    }
    const float b  = 2.f * (f.x * d.x + f.y * d.y);
    const float c  = f.x * f.x + f.y * f.y - radius * radius;
    float       disc = b * b - 4.f * a * c;
    if (disc < 0.f) return best;
    disc = std::sqrt(disc);
    const float t1 = (-b - disc) / (2.f * a);
    const float t2 = (-b + disc) / (2.f * a);
    float tHit = std::numeric_limits<float>::max();
    if (t1 >= 0.f && t1 <= 1.f) tHit = std::min(tHit, t1);
    if (t2 >= 0.f && t2 <= 1.f) tHit = std::min(tHit, t2);
    if (tHit <= 1.f) {
        best.hit      = true;
        best.fraction = tHit;
        best.point    = { from.x + d.x * tHit, from.y + d.y * tHit };
    }
    return best;
}

inline RaycastHit raycastSegmentVsShape(const Vec2& from, const Vec2& to,
                                        const ShapeInstance& shape) {
    if (shape.shape == ColliderShape::Circle)
        return raycastSegmentVsCircle(from, to, shapeCenter(shape), shape.size.x);
    return raycastSegmentVsAabb(from, to, shapeWorldAabb(shape));
}

inline bool pointInsideShape(const Vec2& point, const ShapeInstance& shape) {
    if (shape.shape == ColliderShape::Circle) {
        const Vec2 c = shapeCenter(shape);
        const float dx = point.x - c.x;
        const float dy = point.y - c.y;
        return dx * dx + dy * dy <= shape.size.x * shape.size.x;
    }
    const Aabb box = shapeWorldAabb(shape);
    return point.x >= box.minX && point.x <= box.maxX
        && point.y >= box.minY && point.y <= box.maxY;
}

} // namespace ArtCade::PhysicsMath

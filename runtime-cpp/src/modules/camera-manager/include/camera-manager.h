#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"   // Vec2
#include <functional>
#include <cstdint>

namespace ArtCade::Modules {

/**
 * CameraManager — 2D camera system.
 *
 * Features:
 *   - position, rotation, zoom (all smoothly tweened via lerp)
 *   - optional follow-target (supply a getter lambda; camera lerps towards it)
 *   - screen-shake: trauma-based, decays over time
 *   - world ↔ screen coordinate conversion (pure math, no Raylib call here)
 *   - viewport bounds: the rectangle of the world visible through this camera
 *
 * The Renderer reads position()/rotation()/zoom() and applies them.
 * This module does NOT call Raylib — it just manages camera state.
 */
class CameraManager final : public IModule {
public:
    CameraManager() = default;

    bool init()     override;
    void shutdown() override;

    // ------------------------------------------------------------------ direct control

    void setPosition(Vec2 pos);
    void setRotation(float radians);
    void setZoom(float zoom);

    Vec2  position() const;
    float rotation() const;
    float zoom()     const;

    // ------------------------------------------------------------------ smooth movement

    // Lerp camera toward a target position over time
    void moveTo(Vec2 target, float duration);

    // Zoom smoothly
    void zoomTo(float target, float duration);

    // Snap immediately (no lerp)
    void snapTo(Vec2 pos);
    void snapZoom(float zoom);

    // ------------------------------------------------------------------ follow

    using TargetGetter = std::function<Vec2()>;

    // Supply a lambda that returns the target world position each frame
    void setFollowTarget(TargetGetter getter, float lerpSpeed = 5.f);
    void clearFollowTarget();

    // ------------------------------------------------------------------ shake

    // Add trauma (0–1 range; stacks additively, clamped to 1)
    void addTrauma(float amount);

    // Max shake displacement in world units and max rotation in radians
    void setShakeParams(float maxDisplace, float maxRotation);

    // ------------------------------------------------------------------ update

    void update(float dt);

    // ------------------------------------------------------------------ coordinate conversion

    // World position → screen pixel (uses viewport origin + zoom)
    Vec2 worldToScreen(Vec2 world) const;
    Vec2 screenToWorld(Vec2 screen) const;

    // ------------------------------------------------------------------ viewport

    // Screen size must be provided so the camera can compute visible bounds
    void setScreenSize(float w, float h);

    // Returns the world-space AABB [topLeft, bottomRight] currently visible
    void visibleBounds(Vec2& outTopLeft, Vec2& outBottomRight) const;

private:
    Vec2  pos_      = { 0.f, 0.f };
    float rotation_ = 0.f;
    float zoom_     = 1.f;

    // Position lerp
    Vec2  movTarget_   = { 0.f, 0.f };
    float movDuration_ = 0.f;
    float movElapsed_  = 0.f;
    Vec2  movStart_    = { 0.f, 0.f };

    // Zoom lerp
    float zoomTarget_   = 1.f;
    float zoomDuration_ = 0.f;
    float zoomElapsed_  = 0.f;
    float zoomStart_    = 1.f;

    // Follow
    TargetGetter followGetter_;
    float        followSpeed_ = 5.f;

    // Shake
    float trauma_         = 0.f;
    float shakeDisplace_  = 20.f;
    float shakeRotation_  = 0.05f;
    Vec2  shakeOffset_    = { 0.f, 0.f };
    float shakeRotOffset_ = 0.f;
    float shakeTime_      = 0.f;  // used as noise seed

    // Screen
    float screenW_ = 1280.f;
    float screenH_ = 720.f;

    float lerpf(float a, float b, float t) const;
    Vec2  lerpv(Vec2 a, Vec2 b, float t)   const;
    float pseudoNoise(float x) const;
};

} // namespace ArtCade::Modules

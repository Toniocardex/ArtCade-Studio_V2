#pragma once

#include "game-state.h"
#include "../../../core/engine-context.h"
#include <string>

namespace ArtCade::Modules {

/**
 * SplashState — Displays a branded splash screen with optional watermark.
 *
 * Usage:
 *   if (licenseTier == "free") {
 *       gameStateManager->PushState(std::make_unique<SplashState>(ctx, "free"));
 *   }
 *
 * Display: 4.5 seconds with fade in/out.
 * FREE tier: shows "MADE WITH ARTCADE" watermark
 * PRO  tier: shows logo only, no watermark
 */
class SplashState : public GameState {
public:
    explicit SplashState(EngineContext* ctx, const std::string& tier = "free");
    virtual ~SplashState() = default;

    void Enter() override;
    void Update(float dt) override;
    void Render() override;

    // Query if splash duration has elapsed (used by GameStateManager to auto-pop)
    bool ShouldPop() const;

private:
    std::string licenseTier_;  // "free" or "pro"
    float timer_;
    bool shouldPop_ = false;
};

} // namespace ArtCade::Modules

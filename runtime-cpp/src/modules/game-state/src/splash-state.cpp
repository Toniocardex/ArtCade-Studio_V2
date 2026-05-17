#include "../include/splash-state.h"
#include "../../renderer/include/renderer.h"
#include "../../../utils/logger.h"

#ifdef ARTCADE_WASM
#include <emscripten/emscripten.h>
#endif

#include <raylib.h>

namespace ArtCade::Modules {

SplashState::SplashState(EngineContext* ctx, const std::string& tier)
    : GameState(ctx), licenseTier_(tier), timer_(0.0f) {}

void SplashState::Enter() {
    LOG_DEBUG("[SplashState] Entering splash screen (license=%s)", licenseTier_.c_str());
    timer_ = 0.0f;
}

void SplashState::Update(float dt) {
    timer_ += dt;

    // Display splash for 4.5 seconds, then request state pop
    if (timer_ >= 4.5f) {
        LOG_DEBUG("[SplashState] Splash complete, transitioning to gameplay");
        // Signal that this state should be popped
        // (GameStateManager will handle the pop on next frame)
        shouldPop_ = true;
    }
}

void SplashState::Render() {
    // Get viewport dimensions from context
    int screenWidth  = 1280;
    int screenHeight = 720;
    if (ctx_ && ctx_->renderer) {
        // Use renderer's resolution if available
        screenWidth  = 1280;  // Default from game.json
        screenHeight = 720;
    }

    // Background: black
    DrawRectangle(0, 0, screenWidth, screenHeight, BLACK);

    // Alpha fade in/out for smooth transition
    float alpha = 1.0f;
    if (timer_ < 0.5f) {
        // Fade in: 0s → 0.5s → alpha 0 → 1
        alpha = timer_ / 0.5f;
    } else if (timer_ > 4.0f) {
        // Fade out: 4s → 4.5s → alpha 1 → 0
        alpha = (4.5f - timer_) / 0.5f;
    }

    alpha = std::max(0.0f, std::min(1.0f, alpha));  // Clamp [0, 1]

    // Logo area (center)
    float logoX = screenWidth / 2.0f;
    float logoY = screenHeight / 2.0f - 60.0f;

    // Draw simple ArtCade logo text (white gradient)
    Color logoColor = {
        (unsigned char)(255 * alpha),
        (unsigned char)(255 * alpha),
        (unsigned char)(255 * alpha),
        (unsigned char)(255 * alpha)
    };

    DrawText(
        "ARTCADE",
        (int)(logoX - 120),
        (int)(logoY - 40),
        80,
        logoColor
    );

    // Watermark (only if FREE tier)
    if (licenseTier_ == "free") {
        Color watermarkColor = {
            (unsigned char)(200 * alpha),
            (unsigned char)(200 * alpha),
            (unsigned char)(200 * alpha),
            (unsigned char)(200 * alpha)
        };

        DrawText(
            "MADE WITH ARTCADE",
            (int)(logoX - 150),
            (int)(logoY + 80),
            24,
            watermarkColor
        );
    }

    // Version info
    Color infoColor = {
        (unsigned char)(150 * alpha),
        (unsigned char)(150 * alpha),
        (unsigned char)(150 * alpha),
        (unsigned char)(200 * alpha)
    };

    const char* tierLabel = (licenseTier_ == "free") ? "Free Edition" : "Pro Edition";
    DrawText(
        tierLabel,
        (int)(logoX - 60),
        (int)(logoY + 130),
        16,
        infoColor
    );
}

bool SplashState::ShouldPop() const {
    return shouldPop_;
}

} // namespace ArtCade::Modules

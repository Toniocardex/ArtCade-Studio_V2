#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <string>

namespace ArtCade::Modules {

/**
 * Input — keyboard, mouse, (future) gamepad.
 *
 * Key codes are passed as strings matching KeyboardEvent.code
 * (e.g. "KeyW", "Space", "ArrowLeft") for Lua-friendliness.
 * Internal keymap translation lives in src/keymap.h (private).
 */
class Input final : public IModule {
public:
    Input() = default;

    bool init() override;
    void shutdown() override;

    // Called once per frame before game logic
    void poll();

    // Called at end of frame — clears pressed/released edge flags
    void resetFrameState();

    // Keyboard
    bool isKeyDown(const std::string& code)      const;
    bool wasKeyPressed(const std::string& code)  const;
    bool wasKeyReleased(const std::string& code) const;

    // Mouse
    Vec2 mousePosition()              const;
    bool isMouseButtonDown(int btn)   const;   // 0=LMB 1=RMB 2=MMB
    bool wasMouseButtonPressed(int btn) const;

    /** Request blocking browser defaults for this mouse button (0=left, 1=right). */
    void requestPreventDefault(int btn);

    /** Bitmask for DOM suppress (bit0=left, bit1=right); cleared after publish. */
    uint8_t consumePreventDefaultMask();

    const InputState& state() const { return state_; }

private:
    InputState state_;
    uint8_t preventDefaultMask_ = 0;

    int stringToRaylibKey(const std::string& code) const;
};

} // namespace ArtCade::Modules

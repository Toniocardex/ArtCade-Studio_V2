#pragma once

#include "types.h"
#include <glm/glm.hpp>

namespace ArtCade {

/**
 * Input: Keyboard, mouse, gamepad input handling
 *
 * Polls input each frame and tracks state changes.
 */
class Input {
public:
    Input();
    ~Input();

    void init();
    void shutdown();

    // Update input state (called once per frame)
    void poll();

    // Keyboard
    bool isKeyDown(const std::string& keyCode) const;
    bool wasKeyPressed(const std::string& keyCode) const;
    bool wasKeyReleased(const std::string& keyCode) const;

    // Mouse
    glm::vec2 getMousePosition() const;
    bool isMouseButtonDown(int button) const; // 0=LMB, 1=RMB, 2=MMB

    // Clear pressed/released state (called at end of frame)
    void resetFrameState();

    // Get current input state
    const InputState& getState() const { return state_; }

private:
    InputState state_;
    InputState previousState_;

    KeyCode stringToKeyCode(const std::string& keyStr) const;
};

} // namespace ArtCade

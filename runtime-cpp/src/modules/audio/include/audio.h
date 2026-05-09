#pragma once

#include "../../../core/module.h"
#include <string>

namespace ArtCade::Modules {

/**
 * Audio — sound effects and music via Raylib audio (OpenAL).
 *
 * Supports multiple concurrent SFX and a single streaming music track.
 * Volume is per-channel (master / music / sfx).
 */
class Audio final : public IModule {
public:
    Audio() = default;

    bool init() override;
    void shutdown() override;

    // Sound effects
    void playSound(const std::string& assetPath,
                   float volume = 1.f,
                   float pitch  = 1.f);

    // Music (single stream, replaces current)
    void playMusic(const std::string& assetPath, bool loop = true);
    void stopMusic();
    void pauseMusic();
    void resumeMusic();

    // Mixer
    void setMasterVolume(float v);   // 0–1
    void setMusicVolume(float v);
    void setSFXVolume(float v);

    void stopAll();

    // Called each frame to keep music streaming
    void update();

private:
    float masterVolume_ = 1.f;
    float musicVolume_  = 1.f;
    float sfxVolume_    = 1.f;

    // Opaque Raylib handles (avoid pulling raylib.h into public header)
    void* currentMusicHandle_ = nullptr;
    std::unordered_map<std::string, void*> soundCache_;
};

} // namespace ArtCade::Modules

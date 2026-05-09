#pragma once

#include <string>
#include <unordered_map>

namespace ArtCade {

/**
 * Audio: Sound and music playback via Raylib audio
 *
 * Supports multiple concurrent sounds with volume/pitch control.
 */
class Audio {
public:
    Audio();
    ~Audio();

    void init();
    void shutdown();

    // Sound effects
    void playSound(const std::string& assetPath, float volume = 1.0f, float pitch = 1.0f);
    void stopSound(const std::string& soundId);

    // Music (single stream)
    void playMusic(const std::string& assetPath, bool loop = true);
    void stopMusic();
    void setMusicVolume(float volume);

    // Master volume
    void setMasterVolume(float volume);
    void setSFXVolume(float volume);

    void stopAll();

private:
    float masterVolume_ = 1.0f;
    float musicVolume_ = 1.0f;
    float sfxVolume_ = 1.0f;

    std::unordered_map<std::string, void*> loadedSounds_;
    void* currentMusic_ = nullptr;
};

} // namespace ArtCade

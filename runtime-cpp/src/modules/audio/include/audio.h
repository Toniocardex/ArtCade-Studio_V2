#pragma once

#include "../../../core/module.h"
#include <string>
#include <memory>

namespace ArtCade::Modules {

/**
 * Audio — sound effects and music via Raylib audio (miniaudio backend).
 *
 * All Raylib audio types (Sound, Music) are hidden behind Pimpl.
 * Sound effects are cached per file path to avoid duplicate GPU allocations.
 */
class Audio final : public IModule {
public:
    Audio();
    ~Audio();

    bool init()     override;
    void shutdown() override;

    // Sound effects (fire-and-forget; same file is reused from cache)
    void playSound(const std::string& assetPath,
                   float volume = 1.f,
                   float pitch  = 1.f);

    /** Register SFX from memory (editor WASM upload). `ext` e.g. ".ogg". */
    bool registerSoundFromMemory(const std::string& path,
                                 const unsigned char* data, int len,
                                 const std::string& ext);

    void invalidateSound(const std::string& path);

    /** Unload all cached SFX (editor project hot-reload). */
    void evictSoundCache();

    // Music (single streaming track; replaces current)
    void playMusic  (const std::string& assetPath, bool loop = true);
    void stopMusic  ();
    void pauseMusic ();
    void resumeMusic();

    /** True while the current music track is playing (not stopped/paused). */
    bool isMusicPlaying() const;

    /**
     * Linearly fade the music volume to `target` (0–1) over `seconds`.
     * Fading to 0 stops the track and restores the pre-fade volume, so a
     * later playMusic starts audible again.
     */
    void fadeMusicTo(float target, float seconds);

    // Global mixer
    void setMasterVolume(float v);   // 0–1, affects all output
    void setMusicVolume (float v);   // 0–1, affects current music stream
    void setSFXVolume   (float v);   // 0–1, applied to each playSound call

    void stopAll();

    // Called every frame to keep the music stream fed
    void update();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

} // namespace ArtCade::Modules

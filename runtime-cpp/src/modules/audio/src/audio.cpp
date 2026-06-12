#include "../include/audio.h"
#include <raylib.h>
#include <memory>
#include <unordered_map>
#include <string>

namespace ArtCade::Modules {

// ------------------------------------------------------------------ Pimpl

struct Audio::Impl {
    float masterVolume = 1.f;
    float musicVolume  = 1.f;
    float sfxVolume    = 1.f;

    bool  musicLoaded  = false;
    bool  deviceOpen   = false;
    Music currentMusic = {};
    std::string currentMusicPath;

    // Music fade state (advanced once per frame in update()).
    bool  fadeActive        = false;
    float fadeTarget        = 0.f;
    float fadeRate          = 0.f;   // volume units per second
    float fadeRestoreVolume = 1.f;   // musicVolume before a fade-out started

    std::unordered_map<std::string, Sound> soundCache;
};

// ------------------------------------------------------------------ lifecycle

Audio::Audio()  : impl_(std::make_unique<Impl>()) {}
Audio::~Audio() = default;

bool Audio::init() {
    InitAudioDevice();
    impl_->deviceOpen = true;
    SetMasterVolume(impl_->masterVolume);
    return true;
}

void Audio::shutdown() {
    if (!impl_->deviceOpen) return;
    stopAll();
    for (auto& [path, snd] : impl_->soundCache)
        UnloadSound(snd);
    impl_->soundCache.clear();
    if (impl_->musicLoaded) {
        UnloadMusicStream(impl_->currentMusic);
        impl_->musicLoaded = false;
    }
    CloseAudioDevice();
    impl_->deviceOpen = false;
}

// ------------------------------------------------------------------ SFX

bool Audio::registerSoundFromMemory(const std::string& path,
                                    const unsigned char* data, int len,
                                    const std::string& ext) {
    if (!impl_->deviceOpen || !data || len <= 0) return false;
    auto it = impl_->soundCache.find(path);
    if (it != impl_->soundCache.end()) {
        UnloadSound(it->second);
        impl_->soundCache.erase(it);
    }
    const char* hint = ext.empty() ? ".wav" : ext.c_str();
    Wave wave = LoadWaveFromMemory(hint, data, len);
    if (wave.data == nullptr) return false;
    Sound snd = LoadSoundFromWave(wave);
    UnloadWave(wave);
    if (snd.frameCount <= 0) {
        UnloadSound(snd);
        return false;
    }
    impl_->soundCache[path] = snd;
    return true;
}

void Audio::invalidateSound(const std::string& path) {
    auto it = impl_->soundCache.find(path);
    if (it == impl_->soundCache.end()) return;
    UnloadSound(it->second);
    impl_->soundCache.erase(it);
}

void Audio::evictSoundCache() {
    for (auto& [path, snd] : impl_->soundCache)
        UnloadSound(snd);
    impl_->soundCache.clear();
}

void Audio::playSound(const std::string& path, float volume, float pitch) {
    if (!impl_->deviceOpen) return;

    auto it = impl_->soundCache.find(path);
    if (it == impl_->soundCache.end()) {
        if (!FileExists(path.c_str())) return;
        impl_->soundCache[path] = LoadSound(path.c_str());
        it = impl_->soundCache.find(path);
    }
    Sound& snd = it->second;
    SetSoundVolume(snd, volume * impl_->sfxVolume);
    SetSoundPitch (snd, pitch);
    PlaySound(snd);
}

// ------------------------------------------------------------------ Music

void Audio::playMusic(const std::string& path, bool loop) {
    if (!impl_->deviceOpen) return;
    if (!FileExists(path.c_str())) return;

    if (impl_->musicLoaded) {
        StopMusicStream(impl_->currentMusic);
        UnloadMusicStream(impl_->currentMusic);
        impl_->musicLoaded = false;
    }

    impl_->currentMusic     = LoadMusicStream(path.c_str());
    impl_->currentMusicPath = path;
    impl_->musicLoaded      = true;

    impl_->currentMusic.looping = loop;
    impl_->fadeActive = false;
    SetMusicVolume(impl_->currentMusic, impl_->musicVolume);
    PlayMusicStream(impl_->currentMusic);
}

void Audio::stopMusic() {
    impl_->fadeActive = false;
    if (impl_->musicLoaded)
        StopMusicStream(impl_->currentMusic);
}

void Audio::pauseMusic() {
    if (impl_->musicLoaded)
        PauseMusicStream(impl_->currentMusic);
}

void Audio::resumeMusic() {
    if (impl_->musicLoaded)
        ResumeMusicStream(impl_->currentMusic);
}

bool Audio::isMusicPlaying() const {
    return impl_->musicLoaded && IsMusicStreamPlaying(impl_->currentMusic);
}

void Audio::fadeMusicTo(float target, float seconds) {
    if (target < 0.f) target = 0.f;
    if (target > 1.f) target = 1.f;
    if (seconds <= 0.f) {
        impl_->fadeActive = false;
        if (target <= 0.001f) {
            stopMusic();
        } else {
            setMusicVolume(target);
        }
        return;
    }
    impl_->fadeActive        = true;
    impl_->fadeTarget        = target;
    impl_->fadeRestoreVolume = impl_->musicVolume;
    float delta = target - impl_->musicVolume;
    if (delta < 0.f) delta = -delta;
    impl_->fadeRate = delta / seconds;
}

// ------------------------------------------------------------------ mixer

void Audio::setMasterVolume(float v) {
    impl_->masterVolume = v;
    if (impl_->deviceOpen) SetMasterVolume(v);
}

void Audio::setMusicVolume(float v) {
    impl_->musicVolume = v;
    if (impl_->musicLoaded)
        SetMusicVolume(impl_->currentMusic, v);
}

void Audio::setSFXVolume(float v) {
    impl_->sfxVolume = v;
}

// ------------------------------------------------------------------ frame

void Audio::stopAll() {
    stopMusic();
    for (auto& [path, snd] : impl_->soundCache)
        StopSound(snd);
}

void Audio::update() {
    if (impl_->musicLoaded)
        UpdateMusicStream(impl_->currentMusic);

    if (impl_->fadeActive && impl_->musicLoaded) {
        const float step = impl_->fadeRate * GetFrameTime();
        float v = impl_->musicVolume;
        if (v < impl_->fadeTarget) {
            v = v + step > impl_->fadeTarget ? impl_->fadeTarget : v + step;
        } else {
            v = v - step < impl_->fadeTarget ? impl_->fadeTarget : v - step;
        }
        setMusicVolume(v);
        if (v == impl_->fadeTarget) {
            impl_->fadeActive = false;
            if (impl_->fadeTarget <= 0.001f) {
                const float restore = impl_->fadeRestoreVolume;
                stopMusic();
                setMusicVolume(restore);
            }
        }
    }
}

} // namespace ArtCade::Modules

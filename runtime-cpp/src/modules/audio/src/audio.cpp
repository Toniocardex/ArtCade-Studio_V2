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
    SetMusicVolume(impl_->currentMusic, impl_->musicVolume);
    PlayMusicStream(impl_->currentMusic);
}

void Audio::stopMusic() {
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
}

} // namespace ArtCade::Modules

#include "../include/sprite-animator.h"

#include <unordered_set>

namespace ArtCade::Modules {

bool SpriteAnimator::init() {
    clips_.clear();
    instances_.clear();
    return true;
}

void SpriteAnimator::shutdown() {
    clips_.clear();
    instances_.clear();
    finishBuffer_.clear();
}

std::vector<SpriteAnimator::FinishEvent> SpriteAnimator::pollFinished() {
    std::vector<FinishEvent> out;
    out.swap(finishBuffer_);
    return out;
}

// ------------------------------------------------------------------ clip definition

void SpriteAnimator::defineClip(const Clip& clip) {
    clips_[clip.name] = clip;
}

bool SpriteAnimator::hasClip(const std::string& name) const {
    return clips_.count(name) > 0;
}

void SpriteAnimator::clearClips() {
    clips_.clear();
}

void SpriteAnimator::removeClipsExcept(const std::unordered_set<std::string>& keep) {
    for (auto it = clips_.begin(); it != clips_.end(); ) {
        if (keep.count(it->first) == 0)
            it = clips_.erase(it);
        else
            ++it;
    }
}

// ------------------------------------------------------------------ instance control

void SpriteAnimator::play(EntityId entity, const std::string& clipName, FinishCb onFinish) {
    AnimInstance inst;
    inst.clipName = clipName;
    inst.frameIdx = 0;
    inst.elapsed  = 0.f;
    inst.state    = PlayState::Playing;
    inst.onFinish = std::move(onFinish);
    instances_[entity] = std::move(inst);
}

void SpriteAnimator::pause(EntityId entity) {
    auto it = instances_.find(entity);
    if (it != instances_.end() && it->second.state == PlayState::Playing)
        it->second.state = PlayState::Paused;
}

void SpriteAnimator::resume(EntityId entity) {
    auto it = instances_.find(entity);
    if (it != instances_.end() && it->second.state == PlayState::Paused)
        it->second.state = PlayState::Playing;
}

void SpriteAnimator::stop(EntityId entity) {
    auto it = instances_.find(entity);
    if (it != instances_.end())
        it->second.state = PlayState::Stopped;
}

void SpriteAnimator::seekFrame(EntityId entity, int frame) {
    auto iit = instances_.find(entity);
    if (iit == instances_.end()) return;

    auto cit = clips_.find(iit->second.clipName);
    if (cit == clips_.end()) return;

    const Clip& clip = cit->second;
    int count = static_cast<int>(clip.frames.size());
    if (count == 0) return;

    iit->second.frameIdx = frame % count;
    iit->second.elapsed  = 0.f;
}

// ------------------------------------------------------------------ update

void SpriteAnimator::update(float dt) {
    for (auto& [entity, inst] : instances_) {
        if (inst.state != PlayState::Playing) continue;

        auto cit = clips_.find(inst.clipName);
        if (cit == clips_.end()) continue;

        const Clip& clip  = cit->second;
        int count = static_cast<int>(clip.frames.size());
        if (count == 0) continue;

        float frameDur = (clip.fps > 0.f) ? 1.f / clip.fps : 1.f;
        inst.elapsed += dt;

        while (inst.elapsed >= frameDur) {
            inst.elapsed -= frameDur;
            inst.frameIdx++;

            if (inst.frameIdx >= count) {
                if (clip.loop) {
                    inst.frameIdx = 0;
                } else {
                    inst.frameIdx = count - 1;
                    inst.state    = PlayState::Stopped;
                    finishBuffer_.push_back({ entity, inst.clipName });
                    if (inst.onFinish)
                        inst.onFinish(entity, inst.clipName);
                    break;
                }
            }
        }
    }
}

// ------------------------------------------------------------------ query

SpriteAnimator::Frame SpriteAnimator::currentFrame(EntityId entity) const {
    auto iit = instances_.find(entity);
    if (iit == instances_.end()) return {};

    auto cit = clips_.find(iit->second.clipName);
    if (cit == clips_.end()) return {};

    const auto& frames = cit->second.frames;
    if (frames.empty()) return {};

    int idx = iit->second.frameIdx;
    if (idx < 0 || idx >= static_cast<int>(frames.size())) return {};
    return frames[idx];
}

std::string SpriteAnimator::currentClip(EntityId entity) const {
    auto it = instances_.find(entity);
    if (it == instances_.end() || it->second.state == PlayState::Stopped)
        return "";
    return it->second.clipName;
}

bool SpriteAnimator::isPlaying(EntityId entity) const {
    auto it = instances_.find(entity);
    return (it != instances_.end()) && (it->second.state == PlayState::Playing);
}

int SpriteAnimator::frameIndex(EntityId entity) const {
    auto it = instances_.find(entity);
    return (it != instances_.end()) ? it->second.frameIdx : -1;
}

void SpriteAnimator::removeEntity(EntityId entity) {
    instances_.erase(entity);
}

void SpriteAnimator::clearInstances() {
    instances_.clear();
    finishBuffer_.clear();
}

} // namespace ArtCade::Modules

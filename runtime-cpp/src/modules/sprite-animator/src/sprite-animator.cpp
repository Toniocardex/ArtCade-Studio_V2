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
    eventBuffer_.clear();
}

std::vector<SpriteAnimator::FinishEvent> SpriteAnimator::pollFinished() {
    std::vector<FinishEvent> out;
    out.swap(finishBuffer_);
    return out;
}

std::vector<SpriteAnimator::AnimEvent> SpriteAnimator::pollEvents() {
    std::vector<AnimEvent> out;
    out.swap(eventBuffer_);
    return out;
}

void SpriteAnimator::setWatchedEventKinds(uint32_t mask) {
    watchedEventKinds_ = mask;
}

void SpriteAnimator::pushEvent(AnimEventKind kind, EntityId entity,
                               const std::string& clipName, int frameIdx) {
    if (watchedEventKinds_ & animEventBit(kind))
        eventBuffer_.push_back({ kind, entity, clipName, frameIdx });
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
    // Capture the previously playing clip (if any) before we overwrite the
    // instance, so we can surface a Change event on a real clip switch.
    std::string prevClip;
    auto prevIt = instances_.find(entity);
    if (prevIt != instances_.end() && prevIt->second.state != PlayState::Stopped)
        prevClip = prevIt->second.clipName;

    AnimInstance inst;
    inst.clipName = clipName;
    inst.frameIdx = 0;
    inst.elapsed  = 0.f;
    inst.state    = PlayState::Playing;
    inst.onFinish = std::move(onFinish);
    instances_[entity] = std::move(inst);

    pushEvent(AnimEventKind::Start, entity, clipName, 0);
    if (!prevClip.empty() && prevClip != clipName)
        pushEvent(AnimEventKind::Change, entity, clipName, 0);
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
                    pushEvent(AnimEventKind::Loop, entity, inst.clipName, 0);
                    pushEvent(AnimEventKind::Frame, entity, inst.clipName, 0);
                } else {
                    inst.frameIdx = count - 1;
                    inst.state    = PlayState::Stopped;
                    finishBuffer_.push_back({ entity, inst.clipName });
                    if (inst.onFinish)
                        inst.onFinish(entity, inst.clipName);
                    break;
                }
            } else {
                pushEvent(AnimEventKind::Frame, entity, inst.clipName, inst.frameIdx);
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

SpriteAnimator::Frame SpriteAnimator::clipFrame(const std::string& clipName, int frameIdx) const {
    auto cit = clips_.find(clipName);
    if (cit == clips_.end()) return {};

    const auto& frames = cit->second.frames;
    if (frames.empty()) return {};

    if (frameIdx < 0 || frameIdx >= static_cast<int>(frames.size())) return {};
    return frames[static_cast<size_t>(frameIdx)];
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
    eventBuffer_.clear();
}

} // namespace ArtCade::Modules

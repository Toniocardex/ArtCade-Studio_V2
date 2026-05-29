#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <functional>
#include <cstdint>

namespace ArtCade::Modules {

/**
 * SpriteAnimator — clip-based sprite sheet animation system.
 *
 * A "clip" is a named sequence of frame rectangles (all from one texture)
 * with a playback FPS and loop flag.
 *
 * Each entity has an independent AnimInstance that tracks:
 *   - which clip is playing
 *   - elapsed time within that clip
 *   - current frame index
 *   - playback state (playing / paused / stopped)
 *
 * update(dt) advances all active instances.
 *
 * The system is pure CPU math — it does not call Raylib.  The renderer
 * reads currentFrame() and draws the appropriate subrect of the texture.
 */
class SpriteAnimator final : public IModule {
public:
    SpriteAnimator() = default;

    bool init()     override;
    void shutdown() override;

    // ------------------------------------------------------------------ clip definition

    struct Frame {
        int x, y, w, h;      // pixel subrect on the sprite sheet
    };

    struct Clip {
        std::string        name;
        std::vector<Frame> frames;
        float              fps    = 12.f;
        bool               loop   = true;
    };

    void defineClip(const Clip& clip);
    bool hasClip(const std::string& name) const;
    /** Remove clip definitions whose names are not in keep (instances may still reference them). */
    void removeClipsExcept(const std::unordered_set<std::string>& keep);
    void clearClips();

    // ------------------------------------------------------------------ instance control

    using EntityId = uint32_t;
    using FinishCb = std::function<void(EntityId, const std::string& clipName)>;

    // Start playing a clip on an entity; resets the instance if already playing
    void play(EntityId entity, const std::string& clipName,
              FinishCb onFinish = {});

    void pause (EntityId entity);
    void resume(EntityId entity);
    void stop  (EntityId entity);

    // Jump to a specific frame (0-based)
    void seekFrame(EntityId entity, int frame);

    // Advance all active instances
    void update(float dt);

    // ------------------------------------------------------------------ query

    // Current source subrect to draw (zeroed if no active instance)
    Frame currentFrame(EntityId entity) const;

    // Name of the playing clip ("" if stopped)
    std::string currentClip(EntityId entity) const;

    bool isPlaying(EntityId entity) const;
    int  frameIndex(EntityId entity) const;

    struct FinishEvent {
        EntityId    entityId = 0;
        std::string clipName;
    };

    /** Drain animation-finished events since last poll (non-loop clips only). */
    std::vector<FinishEvent> pollFinished();

    // Remove instance data for an entity (e.g. on entity destroy)
    void removeEntity(EntityId entity);

    /** Drop all per-entity playback state; clip definitions are kept. */
    void clearInstances();

private:
    enum class PlayState { Stopped, Playing, Paused };

    struct AnimInstance {
        std::string clipName;
        int         frameIdx  = 0;
        float       elapsed   = 0.f;
        PlayState   state     = PlayState::Stopped;
        FinishCb    onFinish;
    };

    std::unordered_map<std::string, Clip>        clips_;
    std::unordered_map<EntityId, AnimInstance>   instances_;
    std::vector<FinishEvent>                   finishBuffer_;
};

} // namespace ArtCade::Modules

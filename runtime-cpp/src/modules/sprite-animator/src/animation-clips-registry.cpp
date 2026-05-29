#include "../include/animation-clips-registry.h"
#include "../include/sprite-animator.h"

namespace ArtCade {

void registerAnimationClipsFromAssets(
    Modules::SpriteAnimator& animator,
    const std::vector<ImageAssetDef>& imageAssets)
{
    animator.clearClips();
    for (const ImageAssetDef& asset : imageAssets) {
        for (const AnimationClipDef& def : asset.clips) {
            if (def.name.empty() || def.frames.empty()) continue;
            Modules::SpriteAnimator::Clip clip;
            clip.name = def.name;
            clip.fps  = def.fps > 0.f ? def.fps : 12.f;
            clip.loop = def.loop;
            clip.frames.reserve(def.frames.size());
            for (const AnimationFrameRect& r : def.frames) {
                if (r.w <= 0.f || r.h <= 0.f) continue;
                clip.frames.push_back({
                    static_cast<int>(r.x),
                    static_cast<int>(r.y),
                    static_cast<int>(r.w),
                    static_cast<int>(r.h),
                });
            }
            if (!clip.frames.empty())
                animator.defineClip(clip);
        }
    }
}

} // namespace ArtCade

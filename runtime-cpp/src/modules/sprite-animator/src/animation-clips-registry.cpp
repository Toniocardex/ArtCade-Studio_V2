#include "../include/animation-clips-registry.h"
#include "../include/sprite-animator.h"

#include <unordered_set>

namespace ArtCade {

namespace {

void defineClipsFromAssets(
    Modules::SpriteAnimator& animator,
    const std::vector<ImageAssetDef>& imageAssets)
{
    std::unordered_set<std::string> assetsWithFirstFrame;
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
            if (!clip.frames.empty()) {
                if (!asset.assetId.empty() && assetsWithFirstFrame.count(asset.assetId) == 0) {
                    animator.setFirstFrameForAsset(asset.assetId, clip.frames.front());
                    assetsWithFirstFrame.insert(asset.assetId);
                }
                animator.defineClip(clip);
            }
        }
    }
}

} // namespace

void registerAnimationClipsFromAssets(
    Modules::SpriteAnimator& animator,
    const std::vector<ImageAssetDef>& imageAssets)
{
    animator.clearClips();
    defineClipsFromAssets(animator, imageAssets);
}

void replaceAnimationClipsFromAssets(
    Modules::SpriteAnimator& animator,
    const std::vector<ImageAssetDef>& imageAssets)
{
    std::unordered_set<std::string> keep;
    for (const ImageAssetDef& asset : imageAssets) {
        for (const AnimationClipDef& def : asset.clips) {
            if (!def.name.empty() && !def.frames.empty())
                keep.insert(def.name);
        }
    }
    animator.removeClipsExcept(keep);
    animator.clearFirstFramesByAsset();
    defineClipsFromAssets(animator, imageAssets);
}

} // namespace ArtCade

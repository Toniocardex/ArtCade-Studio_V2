#pragma once

#include "../../../core/types.h"

namespace ArtCade::Modules {
class SpriteAnimator;
}

namespace ArtCade {

/** Register all clips from parsed image assets into the runtime animator. */
void registerAnimationClipsFromAssets(
    Modules::SpriteAnimator& animator,
    const std::vector<ImageAssetDef>& imageAssets);

} // namespace ArtCade

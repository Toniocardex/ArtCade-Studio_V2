#include "../include/presentation_system.h"

#include "../include/output_policy.h"

#include <algorithm>

namespace ArtCade::Presentation {

PresentationSnapshot PresentationSystem::calculate_snapshot(
    const PresentationState& state,
    uint64_t revision) {
    PresentationSnapshot snapshot{};
    snapshot.revision = revision;
    snapshot.effectiveMode = state.mode;
    snapshot.surface = state.surface;
    snapshot.logicalWidth = state.logicalWidth;
    snapshot.logicalHeight = state.logicalHeight;
    snapshot.placement = state.placement;
    snapshot.useIdentityPlacement = state.useIdentityPlacement;
    snapshot.pickingCamera = state.pickingCamera;
    snapshot.presentationScale = state.placement.scaleX;
    snapshot.letterboxActive = state.placement.destX > 0.
        || state.placement.destY > 0.
        || state.placement.destW < state.surface.framebufferWidth
        || state.placement.destH < state.surface.framebufferHeight;
    return snapshot;
}

void PresentationSystem::push_history(const PresentationSnapshot& snapshot) {
    for (std::size_t index = kRevisionHistory - 1; index > 0; --index)
        history_[index] = history_[index - 1];
    history_[0] = snapshot;
    historyCount_ = std::min(historyCount_ + 1, kRevisionHistory);
}

void PresentationSystem::begin_frame() {
    const uint64_t revision = nextRevision_++;
    committedSnapshot_ = calculate_snapshot(state_, revision);
    pendingSnapshot_ = committedSnapshot_;
    push_history(committedSnapshot_);
}

void PresentationSystem::refresh_pending_snapshot() {
    pendingSnapshot_ = calculate_snapshot(state_, nextRevision_);
}

const PresentationSnapshot* PresentationSystem::find_snapshot(
    uint64_t revision) const {
    for (std::size_t index = 0; index < historyCount_; ++index) {
        if (history_[index].revision == revision)
            return &history_[index];
    }
    return nullptr;
}

} // namespace ArtCade::Presentation

#pragma once

#include "presentation_snapshot.h"

#include <cstdint>

namespace ArtCade::Presentation {

/**
 * Flat WASM/JS ABI for a committed PresentationSnapshot (Phase 5).
 * Layout is stable — update editor TS parser when changing field order.
 */
#pragma pack(push, 1)
struct PresentationSnapshotWasm {
    uint64_t revision = 0;
    uint32_t effectiveMode = 0;
    uint32_t flags = 0; /**< bit0 letterboxActive, bit1 useIdentityPlacement */
    float surfaceFbW = 0.f;
    float surfaceFbH = 0.f;
    float logicalW = 0.f;
    float logicalH = 0.f;
    float destX = 0.f;
    float destY = 0.f;
    float destW = 0.f;
    float destH = 0.f;
    float scaleX = 1.f;
    float scaleY = 1.f;
    float presentationScale = 1.f;
    uint32_t reserved = 0;
};
#pragma pack(pop)

static_assert(sizeof(PresentationSnapshotWasm) == 64,
              "PresentationSnapshotWasm ABI size changed — update TS parser");

/** Packs a committed snapshot into the flat WASM struct. */
PresentationSnapshotWasm snapshot_to_wasm(const PresentationSnapshot& snapshot);

} // namespace ArtCade::Presentation

#pragma once

#include "editor-native/commands/editor_invalidation.h"

#include <string>

namespace ArtCade::EditorNative {

// =============================================================================
// EditorOperationResult — the single return shape of every command and intent.
//
//   ok           did the operation succeed?
//   invalidation which panels must refresh (None on failure)
//   error        human-readable message for the console on failure
//
// Failure is explicit and side-effect free: a failed operation neither mutates
// state nor produces invalidation (prompt §24.2, §24.3).
// =============================================================================
struct EditorOperationResult {
    bool                ok           = false;
    EditorInvalidation  invalidation = EditorInvalidation::None;
    std::string         error;

    static EditorOperationResult success(EditorInvalidation inv) {
        return EditorOperationResult{true, inv, {}};
    }
    static EditorOperationResult failure(std::string message) {
        return EditorOperationResult{false, EditorInvalidation::None, std::move(message)};
    }
};

} // namespace ArtCade::EditorNative

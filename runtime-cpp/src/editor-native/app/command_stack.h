#pragma once

#include "editor-native/commands/editor_command.h"

#include <memory>
#include <vector>

namespace ArtCade::EditorNative {

// =============================================================================
// CommandStack — minimal undo storage (prompt §16 Phase D: "non costruire
// subito undo completo"). Redo is out of scope for the spike.
// =============================================================================
class CommandStack {
public:
    void push(std::unique_ptr<EditorCommand> command) {
        undo_.push_back(std::move(command));
    }

    bool canUndo() const { return !undo_.empty(); }

    /** Removes and returns the most recent command, or nullptr if empty. */
    std::unique_ptr<EditorCommand> popForUndo() {
        if (undo_.empty()) return nullptr;
        auto command = std::move(undo_.back());
        undo_.pop_back();
        return command;
    }

    void clear() { undo_.clear(); }
    std::size_t size() const { return undo_.size(); }

private:
    std::vector<std::unique_ptr<EditorCommand>> undo_;
};

} // namespace ArtCade::EditorNative

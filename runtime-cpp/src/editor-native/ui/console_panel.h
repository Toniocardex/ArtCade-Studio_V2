#pragma once

namespace Rml { class ElementDocument; }

namespace ArtCade::EditorNative {

class EditorCoordinator;

// Appends the coordinator's console messages. Refreshed only on a Console
// invalidation (prompt §11).
class ConsolePanel {
public:
    void refresh(Rml::ElementDocument* document, const EditorCoordinator& coordinator) const;
};

} // namespace ArtCade::EditorNative

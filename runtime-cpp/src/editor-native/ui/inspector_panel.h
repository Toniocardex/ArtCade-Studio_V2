#pragma once

namespace Rml { class ElementDocument; }

namespace ArtCade::EditorNative {

class EditorCoordinator;

// Renders the property rows of the selected entity. Each committed field routes
// back through a command — the panel never writes the document directly.
class InspectorPanel {
public:
    void refresh(Rml::ElementDocument* document, const EditorCoordinator& coordinator) const;
};

} // namespace ArtCade::EditorNative

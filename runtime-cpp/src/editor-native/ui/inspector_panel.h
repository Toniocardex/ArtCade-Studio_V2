#pragma once

#include "core/types.h"

namespace Rml { class ElementDocument; }

namespace ArtCade::EditorNative {

class EditorCoordinator;

// Renders the property rows of the selected entity. Each committed field routes
// back through a command — the panel never writes the document directly.
//
// The only local UI state is whether the "Add Component" menu is open. It is
// transient presentation (prompt §3: menu open/close), reset when the selected
// entity changes or Play starts — no EditorUiState, no document state.
class InspectorPanel {
public:
    void refresh(Rml::ElementDocument* document, const EditorCoordinator& coordinator);

    // Toggle / close the in-flow Add Component menu (repaints on toggle).
    void toggleAddMenu(Rml::ElementDocument* document, const EditorCoordinator& coordinator);
    void closeAddMenu() { addMenuOpen_ = false; }

private:
    bool     addMenuOpen_ = false;
    EntityId lastEntity_ = INVALID_ENTITY;   // detect a selection change to reset the menu
};

} // namespace ArtCade::EditorNative

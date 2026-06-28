#pragma once

#include "editor-native/commands/editor_invalidation.h"
#include "editor-native/ui/console_panel.h"
#include "editor-native/ui/hierarchy_panel.h"
#include "editor-native/ui/inspector_panel.h"

#include <functional>
#include <memory>
#include <string>

namespace Rml { class ElementDocument; class EventListener; }

namespace ArtCade::EditorNative {

class EditorCoordinator;

/** Escape &, <, > so authored names are safe inside generated RML. */
std::string escapeRml(const std::string& text);

// =============================================================================
// EditorUi — owns the panels and the single RmlUi event listener, and turns
// coordinator invalidation into targeted panel refreshes (prompt §11).
//
// The listener is the only place RmlUi events enter the editor; it forwards
// every interaction to the coordinator as a command or intent. Panels are
// refreshed strictly in response to invalidation, never every frame.
// =============================================================================
class EditorUi {
public:
    EditorUi(EditorCoordinator& coordinator, Rml::ElementDocument* document);
    ~EditorUi();

    void bind();           // attach the listener + do the initial full refresh
    void processFrame();   // consume invalidations and refresh affected panels

    bool isPlaying() const;

    // Project file operations live in the application layer (it owns the texture
    // cache it must clear on replace, and the platform file pickers). The UI
    // only triggers them; it never touches files or the renderer. Unset handlers
    // make the corresponding toolbar action a no-op.
    using ProjectFileRequest = std::function<void()>;
    void setProjectFileHandlers(ProjectFileRequest open,
                                ProjectFileRequest save,
                                ProjectFileRequest saveAs);

    // Called by the listener; routes one UI interaction to command/intent.
    void handleAction(const std::string& action, const std::string& arg,
                      const std::string& value);
    // Splitter drag: clamps via ResizePanelIntent and re-lays out the panel.
    void handleDrag(const std::string& action, float mouseX, float mouseY);

private:
    class Listener;   // defined in editor_ui.cpp

    void applyInvalidations(EditorInvalidation flags);
    void refreshToolbar();

    EditorCoordinator&                  coordinator_;
    Rml::ElementDocument*               document_;
    HierarchyPanel                      hierarchy_;
    InspectorPanel                      inspector_;
    ConsolePanel                        console_;
    std::unique_ptr<Rml::EventListener> listener_;
    ProjectFileRequest                  openProjectRequest_;
    ProjectFileRequest                  saveProjectRequest_;
    ProjectFileRequest                  saveProjectAsRequest_;
};

} // namespace ArtCade::EditorNative

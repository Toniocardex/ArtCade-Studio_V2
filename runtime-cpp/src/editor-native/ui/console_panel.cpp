#include "editor-native/ui/console_panel.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/ui/editor_ui.h"

#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>

#include <string>

namespace ArtCade::EditorNative {

namespace {

const char* levelClass(ConsoleMessage::Level level) {
    switch (level) {
        case ConsoleMessage::Level::Error:   return "log-error";
        case ConsoleMessage::Level::Warning: return "log-warning";
        default:                             return "log-info";
    }
}

} // namespace

void ConsolePanel::refresh(Rml::ElementDocument* document,
                           const EditorCoordinator& coordinator) const {
    if (!document) return;
    Rml::Element* list = document->GetElementById("console-list");
    if (!list) return;

    const auto& messages = coordinator.consoleLog();
    if (messages.empty()) {
        list->SetInnerRML("<div class=\"log log-info\">Console ready.</div>");
        return;
    }

    std::string html;
    const std::size_t maxShown = 200;
    const std::size_t start = messages.size() > maxShown ? messages.size() - maxShown : 0;
    for (std::size_t i = start; i < messages.size(); ++i) {
        html += "<div class=\"log ";
        html += levelClass(messages[i].level);
        html += "\">" + escapeRml(messages[i].text) + "</div>";
    }
    list->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

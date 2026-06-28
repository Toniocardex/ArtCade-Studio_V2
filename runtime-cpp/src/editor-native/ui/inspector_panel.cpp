#include "editor-native/ui/inspector_panel.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/ui/editor_ui.h"

#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>

#include <cstdio>
#include <string>

namespace ArtCade::EditorNative {

namespace {

std::string num(float v) {
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%g", v);
    return buf;
}

std::string field(const char* label, const char* action, const std::string& value) {
    std::string row = "<div class=\"prop-row\"><span class=\"prop-label\">";
    row += label;
    row += "</span><input type=\"text\" class=\"prop-input\" data-action=\"";
    row += action;
    row += "\" value=\"" + escapeRml(value) + "\"/></div>";
    return row;
}

} // namespace

void InspectorPanel::refresh(Rml::ElementDocument* document,
                             const EditorCoordinator& coordinator) const {
    if (!document) return;
    Rml::Element* body = document->GetElementById("inspector-body");
    if (!body) return;

    const EntityId selected = coordinator.selection().primaryEntity;
    const SceneInstanceDef* inst =
        coordinator.document().findInstanceInScene(coordinator.state().activeSceneId,
                                                   selected);

    if (!inst) {
        body->SetInnerRML("<p class=\"inspector-empty\">Select an entity</p>");
        return;
    }

    std::string html;
    html += "<div class=\"prop-group-title\">Identity</div>";
    html += field("Name", "commit-name", inst->instanceName);
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Type</span>"
            "<span class=\"prop-readonly\">" + escapeRml(inst->objectTypeId) + "</span></div>";

    html += "<div class=\"prop-group-title\">Transform</div>";
    html += field("Position X", "commit-pos-x", num(inst->transform.position.x));
    html += field("Position Y", "commit-pos-y", num(inst->transform.position.y));

    body->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

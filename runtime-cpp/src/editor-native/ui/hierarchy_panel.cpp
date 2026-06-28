#include "editor-native/ui/hierarchy_panel.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/ui/editor_ui.h"

#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>

#include <algorithm>
#include <map>
#include <string>

namespace ArtCade::EditorNative {

namespace {

std::string lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

bool matchesFilter(const std::string& name, const std::string& filter) {
    if (filter.empty()) return true;
    return lower(name).find(lower(filter)) != std::string::npos;
}

void setHtml(Rml::ElementDocument* document, const char* id, const std::string& html) {
    if (Rml::Element* el = document->GetElementById(id)) el->SetInnerRML(html);
}

} // namespace

void HierarchyPanel::refresh(Rml::ElementDocument* document,
                             const EditorCoordinator& coordinator) const {
    if (!document) return;
    const ProjectDocument& doc = coordinator.document();
    const SceneId& activeSceneId = coordinator.state().activeSceneId;

    // -- Scene tabs (sorted by id for a stable order) --------------------------
    std::map<SceneId, std::string> scenesSorted;
    for (const auto& [id, scene] : doc.data().scenes) scenesSorted[id] = scene.name;

    std::string tabs;
    for (const auto& [id, name] : scenesSorted) {
        const bool active = (id == activeSceneId);
        tabs += "<div class=\"tab";
        if (active) tabs += " active";
        tabs += "\" data-action=\"select-scene\" data-arg=\"" + escapeRml(id) + "\">";
        tabs += escapeRml(name);
        tabs += "</div>";
    }
    setHtml(document, "scene-tabs", tabs);

    // -- Entity tree of the active scene --------------------------------------
    const std::string filter = coordinator.uiState().hierarchyFilter;
    const EntityId selected = coordinator.selection().primaryEntity;

    std::string rows;
    if (const SceneDef* scene = doc.findScene(activeSceneId)) {
        for (const SceneInstanceDef& inst : scene->instances) {
            if (!matchesFilter(inst.instanceName, filter)) continue;
            rows += "<div class=\"tree-row";
            if (inst.id == selected) rows += " selected";
            rows += "\" data-action=\"select-entity\" data-arg=\""
                  + std::to_string(inst.id) + "\">";
            rows += "<span class=\"row-name\">" + escapeRml(inst.instanceName) + "</span>";
            rows += "<span class=\"row-type\">" + escapeRml(inst.objectTypeId) + "</span>";
            rows += "</div>";
        }
    }
    if (rows.empty()) rows = "<div class=\"tree-empty\">No entities</div>";
    setHtml(document, "hierarchy-list", rows);
}

} // namespace ArtCade::EditorNative

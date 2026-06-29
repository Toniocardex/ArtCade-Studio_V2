#include "editor-native/ui/assets_panel.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/ui/editor_ui.h"

#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>

#include <string>

namespace ArtCade::EditorNative {

namespace {

std::string importButton(const char* action, const char* label) {
    return std::string("<button class=\"panel-btn\" data-action=\"") + action +
           "\"><span class=\"icon\">&#xeb0b;</span>" + label + "</button>";
}

std::string removeButton(const char* action, const std::string& id) {
    return std::string("<button class=\"panel-btn\" data-action=\"") + action +
           "\" data-arg=\"" + id + "\"><span class=\"icon\">&#xeb41;</span></button>";
}

std::string row(const std::string& name, const std::string& trailing) {
    return "<div class=\"asset-row\"><span class=\"asset-name\">" + name + "</span>"
           + trailing + "</div>";
}

} // namespace

void AssetsPanel::refresh(Rml::ElementDocument* document,
                          const EditorCoordinator& coordinator) const {
    if (!document) return;
    Rml::Element* list = document->GetElementById("assets-list");
    if (!list) return;

    const ProjectDoc& doc = coordinator.document().data();
    std::string html;

    // -- Images: name + Use (assign to selected sprite) + Remove --------------
    html += "<div class=\"asset-group-title\">Images</div>";
    html += importButton("import-image", "Import Image");
    if (doc.imageAssets.empty()) html += "<div class=\"assets-empty\">None</div>";
    for (const ImageAssetDef& asset : doc.imageAssets) {
        const std::string id = escapeRml(asset.assetId);
        html += row(id,
            "<button class=\"panel-btn\" data-action=\"set-sprite-asset\" data-arg=\"" + id
                + "\">Use</button>" + removeButton("remove-image-asset", id));
    }

    // -- Audio: name + load mode + Remove -------------------------------------
    html += "<div class=\"asset-group-title\">Audio</div>";
    html += importButton("import-audio", "Import Audio");
    if (doc.audioAssets.empty()) html += "<div class=\"assets-empty\">None</div>";
    for (const AudioAssetDef& asset : doc.audioAssets) {
        const std::string id = escapeRml(asset.assetId);
        const char* mode = asset.loadMode == AudioLoadMode::Stream ? "Stream" : "Sound";
        html += row(id, "<span class=\"asset-meta\">" + std::string(mode) + "</span>"
                            + removeButton("remove-audio-asset", id));
    }

    // -- Fonts: name + size + Remove ------------------------------------------
    html += "<div class=\"asset-group-title\">Fonts</div>";
    html += importButton("import-font", "Import Font");
    if (doc.fontAssets.empty()) html += "<div class=\"assets-empty\">None</div>";
    for (const FontAssetDef& asset : doc.fontAssets) {
        const std::string id = escapeRml(asset.assetId);
        html += row(id, "<span class=\"asset-meta\">" + std::to_string(asset.defaultPixelSize)
                            + "px</span>" + removeButton("remove-font-asset", id));
    }

    list->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

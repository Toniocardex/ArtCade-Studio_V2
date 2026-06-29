#include "editor-native/ui/assets_panel.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/ui/editor_ui.h"

#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>

#include <string>

namespace ArtCade::EditorNative {

void AssetsPanel::refresh(Rml::ElementDocument* document,
                          const EditorCoordinator& coordinator) const {
    if (!document) return;
    Rml::Element* list = document->GetElementById("assets-list");
    if (!list) return;

    std::string html =
        "<button class=\"panel-btn\" data-action=\"import-image\">"
        "<span class=\"icon\">&#xeb0b;</span>Import Image</button>";

    const auto& assets = coordinator.document().data().imageAssets;
    if (assets.empty()) {
        html += "<div class=\"assets-empty\">No images imported</div>";
    }
    for (const ImageAssetDef& asset : assets) {
        const std::string id = escapeRml(asset.assetId);
        html += "<div class=\"asset-row\">";
        html += "<span class=\"asset-name\">" + id + "</span>";
        html += "<button class=\"panel-btn\" data-action=\"set-sprite-asset\" data-arg=\""
              + id + "\">Use</button>";
        html += "<button class=\"panel-btn\" data-action=\"remove-image-asset\" data-arg=\""
              + id + "\"><span class=\"icon\">&#xeb41;</span></button>";
        html += "</div>";
    }

    list->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

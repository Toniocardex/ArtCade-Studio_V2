#include "editor-native/ui/inspector_panel.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/model/sprite_render_view.h"
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

// Tabler icon glyph span (PUA codepoint passed as an RML char reference).
std::string icon(const char* cp) {
    return std::string("<span class=\"icon\">") + cp + "</span>";
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
    html += "<div class=\"prop-group-title\">" + icon("&#xeb34;") + "Identity</div>";
    html += field("Name", "commit-name", inst->instanceName);
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Type</span>"
            "<span class=\"prop-readonly\">" + escapeRml(inst->objectTypeId) + "</span></div>";

    html += "<div class=\"prop-group-title\">" + icon("&#xf22f;") + "Transform</div>";
    html += field("Position X", "commit-pos-x", num(inst->transform.position.x));
    html += field("Position Y", "commit-pos-y", num(inst->transform.position.y));

    // -- Sprite Renderer component --------------------------------------------
    html += "<div class=\"prop-group-title\">" + icon("&#xeb0a;") + "Sprite Renderer</div>";
    const SpriteRenderView resolved =
        resolveSpriteRenderer(coordinator.document(), coordinator.state().activeSceneId, selected);
    if (!inst->spriteRenderer.has_value()) {
        if (resolved.origin == ComponentOrigin::EntityDefinition) {
            // Inherited from the object type — read-only until overridden.
            html += "<div class=\"prop-row\"><span class=\"prop-label\">Inherited</span>"
                    "<span class=\"prop-readonly\">" + escapeRml(inst->objectTypeId) + "</span></div>";
            html += "<div class=\"prop-row\"><span class=\"prop-label\">Image</span>"
                    "<span class=\"prop-readonly\">"
                  + (resolved.assetId.empty() ? std::string("(none)") : escapeRml(resolved.assetId))
                  + "</span></div>";
            html += "<button class=\"panel-btn\" data-action=\"add-sprite-renderer\">"
                    "<span class=\"icon\">&#xeb0b;</span>Add Override</button>";
        } else {
            html += "<button class=\"panel-btn\" data-action=\"add-sprite-renderer\">"
                    "<span class=\"icon\">&#xeb0b;</span>Add Sprite Renderer</button>";
        }
    } else {
        const SpriteRendererComponent& sr = *inst->spriteRenderer;

        // Visible toggle (commits immediately).
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Visible</span>"
                "<button class=\"panel-btn\" data-action=\"toggle-sprite-visible\">";
        html += sr.visible ? "On" : "Off";
        html += "</button></div>";

        // Image asset: current value + clickable options read from the catalog.
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Image</span>"
                "<span class=\"prop-readonly\">";
        html += sr.imageAssetId.empty() ? "(none)" : escapeRml(sr.imageAssetId);
        html += "</span></div>";

        html += "<div class=\"asset-options\">";
        html += "<div class=\"asset-option\" data-action=\"set-sprite-asset\" data-arg=\"\">"
                "(none)</div>";
        for (const ImageAssetDef& asset : coordinator.document().data().imageAssets) {
            html += "<div class=\"asset-option";
            if (asset.assetId == sr.imageAssetId) html += " selected";
            html += "\" data-action=\"set-sprite-asset\" data-arg=\"" + escapeRml(asset.assetId)
                  + "\">" + escapeRml(asset.assetId) + "</div>";
        }
        html += "</div>";

        html += "<button class=\"panel-btn\" data-action=\"remove-sprite-renderer\">"
                "<span class=\"icon\">&#xeb41;</span>Remove Component</button>";
    }

    // -- Box Collider 2D component (object-type owned) ------------------------
    html += "<div class=\"prop-group-title\">" + icon("&#xeca9;") + "Box Collider 2D</div>";
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Scope</span>"
            "<span class=\"prop-readonly\">Shared by object type</span></div>";
    const auto& types = coordinator.document().data().objectTypes;
    const auto typeIt = types.find(inst->objectTypeId);
    const BoxCollider2DComponent* collider =
        (typeIt != types.end() && typeIt->second.boxCollider2D)
            ? &*typeIt->second.boxCollider2D : nullptr;
    if (!collider) {
        html += "<button class=\"panel-btn\" data-action=\"add-box-collider\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Box Collider</button>";
    } else {
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Enabled</span>"
                "<button class=\"panel-btn\" data-action=\"toggle-box-enabled\">";
        html += collider->enabled ? "On" : "Off";
        html += "</button></div>";

        html += "<div class=\"prop-row\"><span class=\"prop-label\">Trigger</span>"
                "<button class=\"panel-btn\" data-action=\"toggle-box-trigger\">";
        html += collider->isTrigger ? "On" : "Off";
        html += "</button></div>";

        html += field("Offset X", "commit-box-offset-x", num(collider->offset.x));
        html += field("Offset Y", "commit-box-offset-y", num(collider->offset.y));
        html += field("Size W", "commit-box-size-x", num(collider->size.x));
        html += field("Size H", "commit-box-size-y", num(collider->size.y));

        html += "<button class=\"panel-btn\" data-action=\"remove-box-collider\">"
                "<span class=\"icon\">&#xeb41;</span>Remove Component</button>";
    }

    body->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

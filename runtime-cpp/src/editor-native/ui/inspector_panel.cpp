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

// An editable property row. During Play the authoring document is frozen
// (the coordinator rejects edits), so the input is rendered `disabled`: the
// field cannot hold a misleading uncommitted value that Stop would silently
// discard. Enforcement stays in the coordinator; this is the matching affordance.
std::string field(const char* label, const char* action, const std::string& value,
                  bool disabled) {
    std::string row = "<div class=\"prop-row\"><span class=\"prop-label\">";
    row += label;
    row += "</span><input type=\"text\" class=\"prop-input\" data-action=\"";
    row += action;
    row += "\" value=\"" + escapeRml(value) + "\"";
    if (disabled) row += " disabled=\"disabled\"";
    row += "/></div>";
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

    // While Play runs the authoring document is frozen: render every editable
    // control disabled so the inspector cannot start an edit the coordinator
    // would reject. `btn` / `opt` carry the disabled class for the action
    // buttons and the asset picker.
    const bool playing = coordinator.isPlaying();
    const std::string btn = playing ? "panel-btn disabled" : "panel-btn";
    const std::string opt = playing ? "asset-option disabled" : "asset-option";

    std::string html;
    html += "<div class=\"prop-group-title\">" + icon("&#xeb34;") + "Identity</div>";
    html += field("Name", "commit-name", inst->instanceName, playing);
    // Show the object type's display name (the id is an internal token); fall back
    // to the id for a legacy/catalog-less instance whose type is not registered.
    const EntityDef* objectType = coordinator.document().findObjectType(inst->objectTypeId);
    const std::string typeLabel = objectType ? objectType->name : inst->objectTypeId;
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Type</span>"
            "<span class=\"prop-readonly\">" + escapeRml(typeLabel) + "</span></div>";

    html += "<div class=\"prop-group-title\">" + icon("&#xf22f;") + "Transform</div>";
    html += field("Position X", "commit-pos-x", num(inst->transform.position.x), playing);
    html += field("Position Y", "commit-pos-y", num(inst->transform.position.y), playing);

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
            html += "<button class=\"" + btn + "\" data-action=\"add-sprite-renderer\">"
                    "<span class=\"icon\">&#xeb0b;</span>Add Override</button>";
        } else {
            html += "<button class=\"" + btn + "\" data-action=\"add-sprite-renderer\">"
                    "<span class=\"icon\">&#xeb0b;</span>Add Sprite Renderer</button>";
        }
    } else {
        const SpriteRendererComponent& sr = *inst->spriteRenderer;

        // Visible toggle (commits immediately).
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Visible</span>"
                "<button class=\"" + btn + "\" data-action=\"toggle-sprite-visible\">";
        html += sr.visible ? "On" : "Off";
        html += "</button></div>";

        // Image asset: current value + clickable options read from the catalog.
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Image</span>"
                "<span class=\"prop-readonly\">";
        html += sr.imageAssetId.empty() ? "(none)" : escapeRml(sr.imageAssetId);
        html += "</span></div>";

        html += "<div class=\"asset-options\">";
        html += "<div class=\"" + opt + "\" data-action=\"set-sprite-asset\" data-arg=\"\">"
                "(none)</div>";
        for (const ImageAssetDef& asset : coordinator.document().data().imageAssets) {
            html += "<div class=\"" + opt;
            if (asset.assetId == sr.imageAssetId) html += " selected";
            html += "\" data-action=\"set-sprite-asset\" data-arg=\"" + escapeRml(asset.assetId)
                  + "\">" + escapeRml(asset.assetId) + "</div>";
        }
        html += "</div>";

        html += "<button class=\"" + btn + "\" data-action=\"remove-sprite-renderer\">"
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
        html += "<button class=\"" + btn + "\" data-action=\"add-box-collider\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Box Collider</button>";
    } else {
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Enabled</span>"
                "<button class=\"" + btn + "\" data-action=\"toggle-box-enabled\">";
        html += collider->enabled ? "On" : "Off";
        html += "</button></div>";

        html += "<div class=\"prop-row\"><span class=\"prop-label\">Trigger</span>"
                "<button class=\"" + btn + "\" data-action=\"toggle-box-trigger\">";
        html += collider->isTrigger ? "On" : "Off";
        html += "</button></div>";

        html += field("Offset X", "commit-box-offset-x", num(collider->offset.x), playing);
        html += field("Offset Y", "commit-box-offset-y", num(collider->offset.y), playing);
        html += field("Size W", "commit-box-size-x", num(collider->size.x), playing);
        html += field("Size H", "commit-box-size-y", num(collider->size.y), playing);

        html += "<button class=\"" + btn + "\" data-action=\"remove-box-collider\">"
                "<span class=\"icon\">&#xeb41;</span>Remove Component</button>";
    }

    // -- Linear Mover component (object-type owned) ---------------------------
    html += "<div class=\"prop-group-title\">" + icon("&#xf22f;") + "Linear Mover</div>";
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Scope</span>"
            "<span class=\"prop-readonly\">Shared by object type</span></div>";
    const LinearMoverComponent* mover =
        (typeIt != types.end() && typeIt->second.linearMover)
            ? &*typeIt->second.linearMover : nullptr;
    if (!mover) {
        html += "<button class=\"" + btn + "\" data-action=\"add-linear-mover\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Linear Mover</button>";
    } else {
        html += field("Direction X", "commit-mover-dir-x", num(mover->directionX), playing);
        html += field("Direction Y", "commit-mover-dir-y", num(mover->directionY), playing);
        html += field("Speed", "commit-mover-speed", num(mover->speed), playing);
        html += "<button class=\"" + btn + "\" data-action=\"remove-linear-mover\">"
                "<span class=\"icon\">&#xeb41;</span>Remove Component</button>";
    }

    // -- Top Down Controller component (object-type owned) -------------------
    html += "<div class=\"prop-group-title\">" + icon("&#xec8e;") + "Top Down Controller</div>";
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Scope</span>"
            "<span class=\"prop-readonly\">Shared by object type</span></div>";
    const TopDownControllerComponent* controller =
        (typeIt != types.end() && typeIt->second.topDownController)
            ? &*typeIt->second.topDownController : nullptr;
    if (!controller) {
        html += "<button class=\"" + btn + "\" data-action=\"add-top-down\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Top Down Controller</button>";
    } else {
        html += field("Speed", "commit-topdown-speed", num(controller->maxSpeed), playing);
        html += "<button class=\"" + btn + "\" data-action=\"remove-top-down\">"
                "<span class=\"icon\">&#xeb41;</span>Remove Component</button>";
    }

    // -- Platformer Controller component (object-type owned) ------------------
    html += "<div class=\"prop-group-title\">" + icon("&#xec8e;") + "Platformer Controller</div>";
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Scope</span>"
            "<span class=\"prop-readonly\">Shared by object type</span></div>";
    const PlatformerControllerComponent* platformer =
        (typeIt != types.end() && typeIt->second.platformerController)
            ? &*typeIt->second.platformerController : nullptr;
    if (!platformer) {
        html += "<button class=\"" + btn + "\" data-action=\"add-platformer\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Platformer Controller</button>";
    } else {
        html += field("Move Speed", "commit-platformer-move", num(platformer->maxSpeed), playing);
        html += field("Jump Speed", "commit-platformer-jump", num(platformer->jumpForce), playing);
        html += field("Gravity", "commit-platformer-gravity", num(platformer->customGravity), playing);
        html += "<button class=\"" + btn + "\" data-action=\"remove-platformer\">"
                "<span class=\"icon\">&#xeb41;</span>Remove Component</button>";
    }

    body->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

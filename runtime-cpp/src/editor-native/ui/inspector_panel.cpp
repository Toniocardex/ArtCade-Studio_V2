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

// An editable property row. Disabled (read-only) while Play freezes the document.
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

// A component section header: icon + NAME, an ownership badge, and an optional
// remove (x). `badge`/`removeAction` empty are skipped — Identity has neither, a
// structural section (Transform) has a badge but no remove.
std::string header(const char* iconCp, const char* title, const char* badge,
                   const char* badgeClass, const char* removeAction, bool playing) {
    std::string h = "<div class=\"comp-header\"><span class=\"comp-title\">";
    h += icon(iconCp);
    h += title;
    h += "</span>";
    if (badge && *badge) {
        h += "<span class=\"comp-badge ";
        h += (badgeClass ? badgeClass : "");
        h += "\">";
        h += badge;
        h += "</span>";
    }
    if (removeAction && *removeAction) {
        h += "<span class=\"comp-remove";
        if (playing) h += " disabled";
        h += "\" data-action=\"";
        h += removeAction;
        h += "\">";
        h += icon("&#xeb41;");
        h += "</span>";
    }
    h += "</div>";
    return h;
}

} // namespace

void InspectorPanel::toggleAddMenu(Rml::ElementDocument* document,
                                   const EditorCoordinator& coordinator) {
    addMenuOpen_ = !addMenuOpen_;
    refresh(document, coordinator);
}

void InspectorPanel::refresh(Rml::ElementDocument* document,
                             const EditorCoordinator& coordinator) {
    if (!document) return;
    Rml::Element* body = document->GetElementById("inspector-body");
    if (!body) return;

    const EntityId selected = coordinator.selection().primaryEntity;
    const SceneInstanceDef* inst =
        coordinator.document().findInstanceInScene(coordinator.state().activeSceneId,
                                                   selected);

    if (!inst) {
        body->SetInnerRML("<p class=\"inspector-empty\">Select an entity</p>");
        lastEntity_ = INVALID_ENTITY;
        addMenuOpen_ = false;
        return;
    }

    const bool playing = coordinator.isPlaying();
    // The Add menu is transient: a new selection or entering Play closes it.
    if (selected != lastEntity_) { addMenuOpen_ = false; lastEntity_ = selected; }
    if (playing) addMenuOpen_ = false;

    const std::string btn = playing ? "panel-btn disabled" : "panel-btn";
    const std::string opt = playing ? "asset-option disabled" : "asset-option";

    const auto& types = coordinator.document().data().objectTypes;
    const auto typeIt = types.find(inst->objectTypeId);
    const EntityDef* type = (typeIt != types.end()) ? &typeIt->second : nullptr;

    std::string html;

    // -- Identity (not a component) -------------------------------------------
    html += header("&#xeb34;", "Identity", "", "", "", playing);
    html += field("Name", "commit-name", inst->instanceName, playing);
    const std::string typeLabel = type ? type->name : inst->objectTypeId;
    html += "<div class=\"prop-row\"><span class=\"prop-label\">Type</span>"
            "<span class=\"prop-readonly\">" + escapeRml(typeLabel) + "</span></div>";

    // -- Transform (instance-owned; structural, no remove) --------------------
    html += header("&#xf22f;", "Transform", "INSTANCE", "", "", playing);
    html += field("Position X", "commit-pos-x", num(inst->transform.position.x), playing);
    html += field("Position Y", "commit-pos-y", num(inst->transform.position.y), playing);

    // -- Sprite Renderer (instance override, or inherited from the type) ------
    const SpriteRenderView resolved =
        resolveSpriteRenderer(coordinator.document(), coordinator.state().activeSceneId, selected);
    const bool spriteOverride = inst->spriteRenderer.has_value();
    const bool spriteInherited = !spriteOverride
                              && resolved.origin == ComponentOrigin::EntityDefinition;
    if (spriteOverride) {
        const SpriteRendererComponent& sr = *inst->spriteRenderer;
        html += header("&#xeb0a;", "Sprite Renderer", "OVERRIDE", "override",
                       "remove-sprite-renderer", playing);
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Visible</span>"
                "<button class=\"" + btn + "\" data-action=\"toggle-sprite-visible\">";
        html += sr.visible ? "On" : "Off";
        html += "</button></div>";
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Image</span>"
                "<span class=\"prop-readonly\">";
        html += sr.imageAssetId.empty() ? "(none)" : escapeRml(sr.imageAssetId);
        html += "</span></div>";
        html += "<div class=\"asset-options\">";
        html += "<div class=\"" + opt + "\" data-action=\"set-sprite-asset\" data-arg=\"\">(none)</div>";
        for (const ImageAssetDef& asset : coordinator.document().data().imageAssets) {
            html += "<div class=\"" + opt;
            if (asset.assetId == sr.imageAssetId) html += " selected";
            html += "\" data-action=\"set-sprite-asset\" data-arg=\"" + escapeRml(asset.assetId)
                  + "\">" + escapeRml(asset.assetId) + "</div>";
        }
        html += "</div>";
    } else if (spriteInherited) {
        // Inherited from the object type — read-only until overridden (no remove:
        // the type sprite is not the instance's to drop).
        html += header("&#xeb0a;", "Sprite Renderer", "INHERITED", "", "", playing);
        html += "<div class=\"prop-row\"><span class=\"prop-label\">Image</span>"
                "<span class=\"prop-readonly\">"
              + (resolved.assetId.empty() ? std::string("(none)") : escapeRml(resolved.assetId))
              + "</span></div>";
        html += "<button class=\"" + btn + "\" data-action=\"add-sprite-renderer\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Override</button>";
    }

    // -- Box Collider 2D (object-type owned) ----------------------------------
    const BoxCollider2DComponent* collider =
        (type && type->boxCollider2D) ? &*type->boxCollider2D : nullptr;
    if (collider) {
        html += header("&#xeca9;", "Box Collider 2D", "TYPE", "", "remove-box-collider", playing);
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
    }

    // -- Linear Mover (object-type owned) -------------------------------------
    const LinearMoverComponent* mover =
        (type && type->linearMover) ? &*type->linearMover : nullptr;
    if (mover) {
        html += header("&#xf22f;", "Linear Mover", "TYPE", "", "remove-linear-mover", playing);
        html += field("Direction X", "commit-mover-dir-x", num(mover->directionX), playing);
        html += field("Direction Y", "commit-mover-dir-y", num(mover->directionY), playing);
        html += field("Speed", "commit-mover-speed", num(mover->speed), playing);
    }

    // -- Top Down Controller (object-type owned) ------------------------------
    const TopDownControllerComponent* controller =
        (type && type->topDownController) ? &*type->topDownController : nullptr;
    if (controller) {
        html += header("&#xec8e;", "Top Down Controller", "TYPE", "", "remove-top-down", playing);
        html += field("Speed", "commit-topdown-speed", num(controller->maxSpeed), playing);
    }

    // -- Platformer Controller (object-type owned) ----------------------------
    const PlatformerControllerComponent* platformer =
        (type && type->platformerController) ? &*type->platformerController : nullptr;
    if (platformer) {
        html += header("&#xec8e;", "Platformer Controller", "TYPE", "", "remove-platformer", playing);
        html += field("Move Speed", "commit-platformer-move", num(platformer->maxSpeed), playing);
        html += field("Jump Speed", "commit-platformer-jump", num(platformer->jumpForce), playing);
        html += field("Gravity", "commit-platformer-gravity", num(platformer->customGravity), playing);
    }

    // -- Add Component menu (only addable components; one movement driver) -----
    const bool hasDriver = type
        && (type->linearMover || type->topDownController || type->platformerController);
    struct Addable { const char* label; const char* action; bool show; };
    const Addable addable[] = {
        // Sprite override is instance-level (works even without an object type).
        {"Sprite Renderer", "add-sprite-renderer",
            !spriteOverride && resolved.origin == ComponentOrigin::None},
        {"Box Collider 2D", "add-box-collider", type && !collider},
        // The three movement drivers are mutually exclusive: offer none once one exists.
        {"Top Down Controller", "add-top-down", type && !hasDriver},
        {"Platformer Controller", "add-platformer", type && !hasDriver},
        {"Linear Mover", "add-linear-mover", type && !hasDriver},
    };
    bool anyAddable = false;
    for (const Addable& a : addable) anyAddable = anyAddable || a.show;

    if (anyAddable) {
        std::string trigger = "add-component-btn";
        if (playing) trigger += " disabled";
        if (addMenuOpen_ && !playing) trigger += " open";
        html += "<div class=\"add-component\">";
        html += "<div class=\"" + trigger + "\" data-action=\"toggle-add-component\">"
                "<span class=\"icon\">&#xeb0b;</span>Add Component</div>";
        if (addMenuOpen_ && !playing) {
            html += "<div class=\"add-list\">";
            for (const Addable& a : addable) {
                if (!a.show) continue;
                html += "<div class=\"add-entry\" data-action=\"";
                html += a.action;
                html += "\">";
                html += a.label;
                html += "</div>";
            }
            html += "</div>";
        }
        html += "</div>";
    }

    body->SetInnerRML(html);
}

} // namespace ArtCade::EditorNative

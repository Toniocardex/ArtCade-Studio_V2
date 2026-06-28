#include "editor-native/ui/editor_ui.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/app/hierarchy_actions.h"
#include "editor-native/app/inspector_commit.h"
#include "editor-native/commands/entity_commands.h"

#include <RmlUi/Core/Context.h>
#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/ElementDocument.h>
#include <RmlUi/Core/Event.h>
#include <RmlUi/Core/EventListener.h>

#include <cstdlib>
#include <string>

namespace ArtCade::EditorNative {

std::string escapeRml(const std::string& text) {
    std::string out;
    out.reserve(text.size());
    for (const char c : text) {
        switch (c) {
            case '&': out += "&amp;";  break;
            case '<': out += "&lt;";   break;
            case '>': out += "&gt;";   break;
            case '"': out += "&quot;"; break;
            default:  out += c;        break;
        }
    }
    return out;
}

// ----------------------------------------------------------------------------
// The single RmlUi event listener. Attached to the document root; reads
// data-action / data-arg off the bubbled target and forwards to the coordinator.
// ----------------------------------------------------------------------------
namespace {

std::string attribute(Rml::Element* element, const char* name) {
    return element ? element->GetAttribute<Rml::String>(name, Rml::String()) : std::string();
}

} // namespace

class EditorUi::Listener final : public Rml::EventListener {
public:
    explicit Listener(EditorUi& ui) : ui_(ui) {}

    void ProcessEvent(Rml::Event& event) override {
        std::string action, arg;
        for (Rml::Element* e = event.GetTargetElement(); e; e = e->GetParentNode()) {
            action = attribute(e, "data-action");
            if (!action.empty()) {
                arg = attribute(e, "data-arg");
                break;
            }
        }
        if (action.empty()) return;

        const Rml::String type = event.GetType();
        const bool isCommit = action.rfind("commit-", 0) == 0;
        const bool isResize = action.rfind("resize-", 0) == 0;

        if (isResize) {
            if (type != "drag") return;
            ui_.handleDrag(action, event.GetParameter<float>("mouse_x", 0.f),
                                   event.GetParameter<float>("mouse_y", 0.f));
            return;
        }
        // Commit actions fire on value change; everything else on click.
        if (isCommit && type != "change") return;
        if (!isCommit && type != "click") return;

        const std::string value = event.GetParameter<Rml::String>("value", Rml::String());
        ui_.handleAction(action, arg, value);
    }

private:
    EditorUi& ui_;
};

// ----------------------------------------------------------------------------
EditorUi::EditorUi(EditorCoordinator& coordinator, Rml::ElementDocument* document)
    : coordinator_(coordinator), document_(document) {}

EditorUi::~EditorUi() = default;

void EditorUi::bind() {
    if (!document_) return;
    listener_ = std::make_unique<Listener>(*this);
    document_->AddEventListener("click", listener_.get());
    document_->AddEventListener("change", listener_.get());
    document_->AddEventListener("drag", listener_.get());

    // Initial full paint of every panel.
    coordinator_.consumeInvalidations();
    applyInvalidations(EditorInvalidation::Hierarchy | EditorInvalidation::Inspector
                       | EditorInvalidation::Console  | EditorInvalidation::Toolbar);
}

void EditorUi::processFrame() {
    applyInvalidations(coordinator_.consumeInvalidations());
}

void EditorUi::applyInvalidations(EditorInvalidation flags) {
    if (flags == EditorInvalidation::None) return;
    if (has(flags, EditorInvalidation::Hierarchy) || has(flags, EditorInvalidation::Project))
        hierarchy_.refresh(document_, coordinator_);
    if (has(flags, EditorInvalidation::Inspector))
        inspector_.refresh(document_, coordinator_);
    if (has(flags, EditorInvalidation::Console))
        console_.refresh(document_, coordinator_);
    if (has(flags, EditorInvalidation::Toolbar))
        refreshToolbar();
}

bool EditorUi::isPlaying() const { return coordinator_.isPlaying(); }

void EditorUi::refreshToolbar() {
    if (!document_) return;
    const bool playing = coordinator_.isPlaying();

    if (Rml::Element* status = document_->GetElementById("toolbar-status")) {
        const SceneDef* scene =
            coordinator_.document().findScene(coordinator_.state().activeSceneId);
        std::string text = scene ? scene->name : std::string("-");
        text += playing ? "  -  PLAYING" : "  -  EDIT";
        status->SetInnerRML(escapeRml(text));
    }

    // Play affordances derive straight from the authorities — never stored.
    const auto setEnabled = [&](const char* id, bool enabled) {
        if (Rml::Element* el = document_->GetElementById(id))
            el->SetClass("disabled", !enabled);
    };
    setEnabled("btn-play-project", !playing && coordinator_.canPlayProject());
    setEnabled("btn-play-scene",   !playing && coordinator_.canPlayCurrentScene());
    setEnabled("btn-stop",         playing);
}

void EditorUi::handleAction(const std::string& action, const std::string& arg,
                            const std::string& value) {
    const EntityId selected = coordinator_.selection().primaryEntity;

    if (action == "select-entity") {
        coordinator_.apply(SelectEntityIntent{
            static_cast<EntityId>(std::strtoul(arg.c_str(), nullptr, 10))});
    } else if (action == "select-scene") {
        coordinator_.apply(SelectSceneIntent{arg});
    } else if (action == "add-scene") {
        addScene(coordinator_);
    } else if (action == "delete-scene") {
        // No arg → the active scene; the coordinator reconciles the workspace.
        deleteScene(coordinator_, arg.empty() ? coordinator_.state().activeSceneId : arg);
    } else if (action == "add-entity") {
        addEntity(coordinator_);
    } else if (action == "delete-entity") {
        deleteSelectedEntity(coordinator_);
    } else if (action == "commit-pos-x") {
        commitInspectorPositionX(coordinator_, selected, value);
    } else if (action == "commit-pos-y") {
        commitInspectorPositionY(coordinator_, selected, value);
    } else if (action == "commit-name") {
        if (selected != INVALID_ENTITY && !value.empty())
            coordinator_.execute(
                RenameEntityCommand{coordinator_.state().activeSceneId, selected, value});
    } else if (action == "undo") {
        coordinator_.undo();
    } else if (action == "zoom-in" || action == "zoom-out") {
        const SceneId active = coordinator_.state().activeSceneId;
        const float current = coordinator_.sceneView(active).zoom;
        const float factor = (action == "zoom-in") ? 1.2f : (1.0f / 1.2f);
        coordinator_.apply(SetViewportZoomIntent{active, current * factor});
    } else if (action == "play-project") {
        coordinator_.playProject();        // guarded; no-op without a valid start scene
    } else if (action == "play-current-scene") {
        coordinator_.playCurrentScene();   // guarded; no-op without an active scene
    } else if (action == "stop") {
        coordinator_.stopPlaying();
    }
}

void EditorUi::handleDrag(const std::string& action, float mouseX, float mouseY) {
    if (!document_) return;
    Rml::Context* ctx = document_->GetContext();
    const Rml::Vector2i dims = ctx ? ctx->GetDimensions() : Rml::Vector2i(0, 0);

    const auto px = [](float v) { return std::to_string(static_cast<int>(v)) + "px"; };

    if (action == "resize-left") {
        coordinator_.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, mouseX});
        if (Rml::Element* el = document_->GetElementById("left-col"))
            el->SetProperty("width", px(coordinator_.uiState().leftPanelWidth));
    } else if (action == "resize-right") {
        coordinator_.apply(ResizePanelIntent{ResizePanelIntent::Panel::Right,
                                             static_cast<float>(dims.x) - mouseX});
        if (Rml::Element* el = document_->GetElementById("right-col"))
            el->SetProperty("width", px(coordinator_.uiState().rightPanelWidth));
    } else if (action == "resize-console") {
        coordinator_.apply(ResizePanelIntent{ResizePanelIntent::Panel::Console,
                                             static_cast<float>(dims.y) - mouseY});
        if (Rml::Element* el = document_->GetElementById("console"))
            el->SetProperty("height", px(coordinator_.uiState().consoleHeight));
    }
}

} // namespace ArtCade::EditorNative

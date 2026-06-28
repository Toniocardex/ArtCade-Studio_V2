// editor-core-test.cpp — architectural guarantees of the native editor core.
//
// Each CHECK maps to a numbered requirement in the refactor prompt (§24). The
// core has no Raylib / RmlUi dependency, so these run in the plain CTest harness
// with no GL context and no stubs.

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/app/input_routing.h"
#include "editor-native/app/inspector_commit.h"
#include "editor-native/commands/entity_commands.h"
#include "editor-native/commands/scene_commands.h"
#include "editor-native/model/play_session.h"

#include <iostream>
#include <string>
#include <type_traits>

using namespace ArtCade;
using namespace ArtCade::EditorNative;

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond)                                                            \
    do {                                                                       \
        if (cond) ++g_passed;                                                  \
        else { std::cerr << "FAIL: " #cond " (line " << __LINE__ << ")\n"; ++g_failed; } \
    } while (0)

// ---------------------------------------------------------------------------
// A small two-scene project with one placed instance in the first scene.
// ---------------------------------------------------------------------------
static constexpr EntityId kHero = 42;
static const SceneId kSceneA = "scene-a";
static const SceneId kSceneB = "scene-b";

static ProjectDoc makeDoc() {
    ProjectDoc doc;
    doc.projectName = "spike";
    doc.activeSceneId = kSceneA; // persisted gameplay start scene, not editor focus

    SceneDef a;
    a.id = kSceneA;
    a.name = "Scene A";
    a.backgroundColor = {0.1f, 0.1f, 0.1f, 1.f};
    SceneInstanceDef hero;
    hero.id = kHero;
    hero.objectTypeId = "Hero";
    hero.instanceName = "Hero";
    hero.transform.position = {10.f, 20.f};
    a.instances.push_back(hero);

    SceneDef b;
    b.id = kSceneB;
    b.name = "Scene B";

    doc.scenes.emplace(kSceneA, a);
    doc.scenes.emplace(kSceneB, b);
    return doc;
}

int main() {
    // -- §24.1  A command modifies a single authority --------------------------
    {
        EditorCoordinator c{makeDoc()};
        const SelectionState selectionBefore = c.selection();
        const EditorUiState  uiBefore = c.uiState();

        const auto r = c.execute(SetEntityPositionCommand{kSceneA, kHero, {99.f, 20.f}});
        CHECK(r.ok);
        // Only the document changed; selection and UI state are untouched.
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 99.f);
        CHECK(c.selection().primaryEntity == selectionBefore.primaryEntity);
        CHECK(c.uiState().leftPanelWidth == uiBefore.leftPanelWidth);
        CHECK(c.document().isDirty());
    }

    // -- §24.2 / §24.3  A failed command changes nothing and invalidates nothing
    {
        EditorCoordinator c{makeDoc()};
        const uint64_t revBefore = c.document().revision();
        c.consumeInvalidations(); // clear

        const auto r = c.execute(SetEntityPositionCommand{kSceneA, 9999, {1.f, 2.f}});
        CHECK(!r.ok);
        CHECK(!r.error.empty());
        CHECK(c.document().revision() == revBefore);          // state unchanged
        CHECK(!c.document().isDirty());
        // Only the console error was raised; no Inspector/Viewport invalidation.
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(!has(inv, EditorInvalidation::Inspector));
        CHECK(!has(inv, EditorInvalidation::Viewport));
        CHECK(!c.canUndo());                                   // not pushed to undo
    }

    // -- §24.4  SetEntityPositionCommand invalidates only Inspector|Viewport ---
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        const auto r = c.execute(SetEntityPositionCommand{kSceneA, kHero, {1.f, 1.f}});
        CHECK(r.invalidation ==
              (EditorInvalidation::Inspector | EditorInvalidation::Viewport));
        CHECK(r.change.kind == DomainChangeKind::EntityChanged);
        CHECK(r.change.sceneId == kSceneA);
        CHECK(r.change.entityId == kHero);
        CHECK(!has(r.invalidation, EditorInvalidation::Hierarchy));
        CHECK(!has(r.invalidation, EditorInvalidation::Project));
    }

    // -- §24.5  A selection does not perform a Replace -------------------------
    {
        EditorCoordinator c{makeDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        c.apply(SelectEntityIntent{kHero});
        CHECK(c.selection().primaryEntity == kHero);
        CHECK(c.document().replaceCount() == replacesBefore);  // no Replace
        CHECK(!c.document().isDirty());                        // no authoring mutation

        const auto bad = c.apply(SelectEntityIntent{9999});
        CHECK(!bad.ok);
        CHECK(c.selection().primaryEntity == kHero);           // unchanged on failure
    }

    // -- §24.6  A scene change does not serialize / Replace the project --------
    {
        EditorCoordinator c{makeDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        const uint64_t revBefore = c.document().revision();

        c.apply(SelectEntityIntent{kHero});
        CHECK(c.selection().primaryEntity == kHero);

        const auto r = c.apply(SelectSceneIntent{kSceneB});
        CHECK(r.ok);
        CHECK(c.state().activeSceneId == kSceneB);
        CHECK(c.selection().primaryEntity == INVALID_ENTITY);
        CHECK(c.uiState().leftPanelWidth == 280.0f);
        CHECK(c.document().startSceneId() == kSceneA);         // project unchanged
        CHECK(c.document().replaceCount() == replacesBefore);  // no Replace
        CHECK(c.document().revision() == revBefore);           // no serialization/mutation
        CHECK(!c.document().isDirty());

        const auto bad = c.apply(SelectSceneIntent{"nope"});
        CHECK(!bad.ok);
        CHECK(c.state().activeSceneId == kSceneB);             // unchanged on failure
        CHECK(c.document().startSceneId() == kSceneA);
    }

    // -- §24.8  Nothing accumulates invalidation without an operation ----------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
        CHECK(c.pendingInvalidations() == EditorInvalidation::None);
    }

    // -- §24.11  Play does not modify the ProjectDocument ----------------------
    {
        EditorCoordinator c{makeDoc()};
        const uint64_t revBefore = c.document().revision();

        c.apply(SelectSceneIntent{kSceneB});
        PlaySession session = PlaySession::startProject(c.document());
        CHECK(session.sceneId() == kSceneA);
        CHECK(session.instances().size() == 1);

        PlaySession currentSceneSession =
            PlaySession::startActiveScene(c.document(), c.state().activeSceneId);
        CHECK(currentSceneSession.sceneId() == kSceneB);
        CHECK(currentSceneSession.instances().empty());

        // The simulation mutates the session freely...
        session.instances()[0].transform.position = {500.f, 600.f};
        // ...the authoring document is untouched.
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        CHECK(c.document().revision() == revBefore);

        // -- §24.12  Stop needs no reload: destroying the session restores
        //            nothing because the document was never changed.
        session.instances().clear();
        CHECK(c.document().findInstanceInScene(kSceneA, kHero) != nullptr);
        CHECK(c.document().revision() == revBefore);
    }

    // -- §24.13  Invalid NumberField parse does not modify the document --------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        const uint64_t revBefore = c.document().revision();

        const auto bad = commitInspectorPositionX(c, kHero, "abc");
        CHECK(!bad.ok);
        CHECK(c.document().revision() == revBefore);           // untouched
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        CHECK(parseNumberField("12.5").has_value());
        CHECK(!parseNumberField("12.5xz").has_value());
        CHECK(!parseNumberField("").has_value());
    }

    // -- §24.17  Splitter applies min/max clamp --------------------------------
    {
        EditorCoordinator c{makeDoc()};
        const SceneId sceneBefore = c.state().activeSceneId;
        const EntityId selectionBefore = c.selection().primaryEntity;
        c.consumeInvalidations();
        const auto resized = c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 5.f});
        CHECK(resized.invalidation == (EditorInvalidation::Layout | EditorInvalidation::Viewport));
        CHECK(c.uiState().leftPanelWidth == PanelLimits::kLeftMin);
        CHECK(c.state().activeSceneId == sceneBefore);
        CHECK(c.selection().primaryEntity == selectionBefore);
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 99999.f});
        CHECK(c.uiState().leftPanelWidth == PanelLimits::kLeftMax);
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Console, 300.f});
        CHECK(c.uiState().consoleHeight == 300.f);

        c.apply(SelectEntityIntent{kHero});
        c.apply(SetHierarchyFilterIntent{"hero"});
        CHECK(c.uiState().hierarchyFilter == "hero");
        CHECK(c.state().activeSceneId == sceneBefore);
        CHECK(c.selection().primaryEntity == kHero);

        const auto tool = c.apply(SetActiveToolIntent{EditorTool::Pan});
        CHECK(tool.invalidation == EditorInvalidation::Toolbar);
        CHECK(c.state().activeTool == EditorTool::Pan);
        CHECK(c.uiState().consoleVisible);

        const auto console = c.apply(ToggleConsoleIntent{});
        CHECK(console.invalidation == (EditorInvalidation::Layout | EditorInvalidation::Viewport));
        CHECK(!c.uiState().consoleVisible);
        CHECK(c.state().activeTool == EditorTool::Pan);
    }

    // -- Contract: public coordinator access is read-only ----------------------
    {
        EditorCoordinator c{makeDoc()};
        static_assert(std::is_const_v<std::remove_reference_t<decltype(c.document())>>,
                      "EditorCoordinator::document() must be const-only");
        static_assert(std::is_const_v<std::remove_reference_t<decltype(c.state())>>,
                      "EditorCoordinator::state() must be const-only");
        static_assert(std::is_const_v<std::remove_reference_t<decltype(c.uiState())>>,
                      "EditorCoordinator::uiState() must be const-only");
    }

    // -- §24.16  Input captured by a text field never reaches the viewport -----
    {
        CHECK(shouldViewportReceiveInput({/*inRect*/true, false, false, false}));
        CHECK(!shouldViewportReceiveInput({true, false, /*textFocus*/true, false}));
        CHECK(!shouldViewportReceiveInput({true, /*rmlConsumed*/true, false, false}));
        CHECK(!shouldViewportReceiveInput({/*inRect*/false, false, false, false}));
        CHECK(!shouldViewportReceiveInput({true, false, false, /*popup*/true}));
    }

    // -- §24.18  Position X path: UI callback → command → document → invalidation
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.consumeInvalidations();

        const auto r = commitInspectorPositionX(c, kHero, "256");
        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::EntityChanged);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 256.f);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.y == 20.f);
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(inv == (EditorInvalidation::Inspector | EditorInvalidation::Viewport));
        // The change is undoable and the inverse is exact.
        CHECK(c.canUndo());
        c.undo();
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
    }

    // -- Undo / rename / scene + background commands round-trip ----------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(RenameEntityCommand{kSceneA, kHero, "Champion"}).ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->instanceName == "Champion");
        CHECK(!c.execute(RenameEntityCommand{kSceneA, kHero, ""}).ok); // empty rejected

        CHECK(c.execute(CreateSceneCommand{"scene-c", "Scene C"}).ok);
        CHECK(c.document().hasScene("scene-c"));
        CHECK(!c.execute(CreateSceneCommand{"scene-a", "dup"}).ok); // duplicate rejected

        CHECK(c.execute(SetSceneBackgroundCommand{kSceneA, {1.f, 0.f, 0.f, 1.f}}).ok);
        CHECK(c.document().findScene(kSceneA)->backgroundColor.r == 1.f);
        c.undo();                                                // undo background
        CHECK(c.document().findScene(kSceneA)->backgroundColor.r == 0.1f);
    }

    std::cout << "editor-core-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

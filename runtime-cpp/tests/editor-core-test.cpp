// editor-core-test.cpp — architectural guarantees of the native editor core.
//
// Each CHECK maps to a numbered requirement in the refactor prompt (§24). The
// core has no Raylib / RmlUi dependency, so these run in the plain CTest harness
// with no GL context and no stubs.

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/app/hierarchy_actions.h"
#include "editor-native/app/input_routing.h"
#include "editor-native/app/inspector_commit.h"
#include "editor-native/app/project_file.h"
#include "editor-native/app/project_load.h"
#include "editor-native/app/inspector_actions.h"
#include "editor-native/commands/entity_commands.h"
#include "editor-native/commands/scene_commands.h"
#include "editor-native/commands/sprite_commands.h"
#include "editor-native/model/project_io.h"
#include "editor-native/model/play_session.h"
#include "editor-native/model/sprite_render_view.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <system_error>
#include <type_traits>
#include <utility>

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

static ProjectDoc makeReplacementDoc() {
    ProjectDoc doc;
    doc.projectName = "replacement";
    doc.activeSceneId = "scene-replacement";

    SceneDef scene;
    scene.id = "scene-replacement";
    scene.name = "Replacement";
    SceneInstanceDef instance;
    instance.id = 77;
    instance.objectTypeId = "Enemy";
    instance.instanceName = "Enemy";
    instance.transform.position = {7.f, 8.f};
    scene.instances.push_back(instance);
    doc.scenes.emplace(scene.id, scene);
    return doc;
}

// makeDoc plus an image-asset catalog and a non-image (tileset) asset id, for
// the sprite-renderer slice.
static ProjectDoc makeSpriteDoc() {
    ProjectDoc doc = makeDoc();
    ImageAssetDef hero;  hero.assetId = "img-hero";  doc.imageAssets.push_back(hero);
    ImageAssetDef alt;   alt.assetId  = "img-alt";   doc.imageAssets.push_back(alt);
    TilesetAsset tiles;  tiles.assetId = "tiles-1";  doc.tilesets.push_back(tiles); // not an image
    return doc;
}

// makeSpriteDoc plus an object type "Hero" whose sprite carries an image, so the
// kHero instance (objectTypeId "Hero") inherits a sprite when it has no override.
static ProjectDoc makeInheritedDoc() {
    ProjectDoc doc = makeSpriteDoc();
    EntityDef hero;
    hero.className = "Hero";
    hero.name = "Hero";
    hero.visible = true;
    hero.sprite.spriteAssetId = "img-hero";
    doc.objectTypes.emplace("Hero", hero);
    return doc;
}

static ProjectDoc makeInvalidStartDoc() {
    ProjectDoc doc = makeReplacementDoc();
    doc.activeSceneId = "missing-start-scene";
    return doc;
}

static ProjectDoc makeEmptyDoc() {
    ProjectDoc doc;
    doc.projectName = "empty";
    doc.activeSceneId = "missing";
    return doc;
}

static std::string validProjectJson() {
    return R"json({
  "formatVersion": 1,
  "projectName": "LoadedProject",
  "activeSceneId": "loaded-scene",
  "scenes": [
    {
      "id": "loaded-scene",
      "name": "Loaded Scene",
      "instances": [
        {
          "id": 88,
          "objectTypeId": "LoadedType",
          "instanceName": "Loaded Entity",
          "transform": { "position": { "x": 123, "y": 456 } }
        }
      ]
    }
  ]
})json";
}

static std::string danglingStartJson() {
    return R"json({
  "formatVersion": 1,
  "projectName": "Dangling",
  "activeSceneId": "missing",
  "scenes": [
    { "id": "real-scene", "name": "Real Scene" }
  ]
})json";
}

static std::string unsupportedVersionJson() {
    return R"json({
  "formatVersion": 99,
  "projectName": "Future",
  "activeSceneId": "future-scene",
  "scenes": [
    { "id": "future-scene", "name": "Future Scene" }
  ]
})json";
}

static std::string zeroSceneJson() {
    return R"json({
  "formatVersion": 1,
  "projectName": "No Scenes",
  "activeSceneId": "missing",
  "scenes": []
})json";
}

static std::string duplicateSceneJson() {
    return R"json({
  "formatVersion": 1,
  "projectName": "Duplicate Scene",
  "activeSceneId": "dupe",
  "scenes": [
    { "id": "dupe", "name": "First" },
    { "id": "dupe", "name": "Second" }
  ]
})json";
}

static std::filesystem::path testTempDir() {
    std::filesystem::path dir =
        std::filesystem::temp_directory_path() / "artcade-editor-core-test";
    std::error_code ec;
    std::filesystem::remove_all(dir, ec);
    std::filesystem::create_directories(dir, ec);
    return dir;
}

static void writeTextFile(const std::filesystem::path& path, const std::string& text) {
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    out << text;
}

static std::string readTextFile(const std::filesystem::path& path) {
    std::ifstream in(path, std::ios::binary);
    return std::string(std::istreambuf_iterator<char>(in),
                       std::istreambuf_iterator<char>());
}

static bool hasTempSibling(const std::filesystem::path& destination) {
    const std::filesystem::path dir = destination.parent_path();
    const std::string prefix = destination.filename().string() + ".tmp-";
    if (!std::filesystem::exists(dir)) return false;
    for (const auto& entry : std::filesystem::directory_iterator(dir)) {
        if (entry.path().filename().string().rfind(prefix, 0) == 0) {
            return true;
        }
    }
    return false;
}

static void expectCoordinatorBaseline(const EditorCoordinator& c,
                                      const std::string& projectName,
                                      const SceneId& activeScene,
                                      EntityId selection,
                                      float leftPanel,
                                      std::size_t undoSize,
                                      uint64_t revision,
                                      uint64_t savedRevision,
                                      bool dirty) {
    CHECK(c.document().data().projectName == projectName);
    CHECK(c.state().activeSceneId == activeScene);
    CHECK(c.selection().primaryEntity == selection);
    CHECK(c.uiState().leftPanelWidth == leftPanel);
    CHECK(c.undoSize() == undoSize);
    CHECK(c.document().revision() == revision);
    CHECK(c.document().savedRevision() == savedRevision);
    CHECK(c.document().isDirty() == dirty);
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

    // -- Replace project is atomic at the coordinator boundary ----------------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 333.f});
        c.apply(SetHierarchyFilterIntent{"keep-me"});
        c.execute(SetEntityPositionCommand{kSceneA, kHero, {99.f, 20.f}});
        CHECK(c.canUndo());
        c.consumeInvalidations();

        const EditorUiState uiBefore = c.uiState();
        const auto r = c.replaceProject(ProjectDocument{makeReplacementDoc()});

        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::ProjectReplaced);
        CHECK(r.invalidation == (EditorInvalidation::Hierarchy | EditorInvalidation::Inspector
                                 | EditorInvalidation::Viewport | EditorInvalidation::Assets
                                 | EditorInvalidation::Toolbar | EditorInvalidation::Project));
        CHECK(c.document().data().projectName == "replacement");
        CHECK(c.state().activeSceneId == "scene-replacement");
        CHECK(c.selection().primaryEntity == INVALID_ENTITY);
        CHECK(!c.canUndo());
        CHECK(c.undoSize() == 0);
        CHECK(!c.document().isDirty());
        CHECK(c.document().revision() == c.document().savedRevision());
        CHECK(c.uiState().leftPanelWidth == uiBefore.leftPanelWidth);
        CHECK(c.uiState().hierarchyFilter == uiBefore.hierarchyFilter);
    }

    // -- Replace normalizes missing and empty scene focus ----------------------
    {
        EditorCoordinator invalidStart{makeDoc()};
        const auto invalid = invalidStart.replaceProject(ProjectDocument{makeInvalidStartDoc()});
        CHECK(invalid.ok);
        CHECK(invalidStart.document().startSceneId() == "missing-start-scene");
        CHECK(invalidStart.state().activeSceneId == "scene-replacement");
        CHECK(!invalidStart.document().isDirty());

        EditorCoordinator empty{makeDoc()};
        const auto emptyReplace = empty.replaceProject(ProjectDocument{makeEmptyDoc()});
        CHECK(emptyReplace.ok);
        CHECK(empty.state().activeSceneId.empty());
        CHECK(empty.selection().primaryEntity == INVALID_ENTITY);
        CHECK(!empty.document().isDirty());
    }

    // -- Load from text mutates only after deserialize/migrate/validate --------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 345.f});
        c.execute(SetEntityPositionCommand{kSceneA, kHero, {44.f, 55.f}});
        c.consumeInvalidations();

        const uint64_t revisionBefore = c.document().revision();
        const uint64_t savedBefore = c.document().savedRevision();
        const bool dirtyBefore = c.document().isDirty();
        const std::size_t undoBefore = c.undoSize();

        const auto malformed = loadProjectFromText(c, "{ not json");
        CHECK(!malformed.ok);
        CHECK(malformed.error.stage == ProjectLoadStage::Deserialize);
        expectCoordinatorBaseline(c, "spike", kSceneA, kHero, 345.f,
                                  undoBefore, revisionBefore, savedBefore, dirtyBefore);

        const auto migrationFailed = loadProjectFromText(c, unsupportedVersionJson());
        CHECK(!migrationFailed.ok);
        CHECK(migrationFailed.error.stage == ProjectLoadStage::Migration);
        expectCoordinatorBaseline(c, "spike", kSceneA, kHero, 345.f,
                                  undoBefore, revisionBefore, savedBefore, dirtyBefore);

        const auto validationFailed = loadProjectFromText(c, danglingStartJson());
        CHECK(!validationFailed.ok);
        CHECK(validationFailed.error.stage == ProjectLoadStage::Validation);
        expectCoordinatorBaseline(c, "spike", kSceneA, kHero, 345.f,
                                  undoBefore, revisionBefore, savedBefore, dirtyBefore);

        const auto duplicateScene = loadProjectFromText(c, duplicateSceneJson());
        CHECK(!duplicateScene.ok);
        CHECK(duplicateScene.error.stage == ProjectLoadStage::Validation);
        expectCoordinatorBaseline(c, "spike", kSceneA, kHero, 345.f,
                                  undoBefore, revisionBefore, savedBefore, dirtyBefore);

        const auto loaded = loadProjectFromText(c, validProjectJson());
        CHECK(loaded.ok);
        CHECK(loaded.operation.change.kind == DomainChangeKind::ProjectReplaced);
        CHECK(c.document().data().projectName == "LoadedProject");
        CHECK(c.document().startSceneId() == "loaded-scene");
        CHECK(c.state().activeSceneId == "loaded-scene");
        CHECK(c.selection().primaryEntity == INVALID_ENTITY);
        CHECK(c.uiState().leftPanelWidth == 345.f);
        CHECK(c.undoSize() == 0);
        CHECK(!c.document().isDirty());
        CHECK(c.document().revision() == c.document().savedRevision());
        CHECK(c.document().findInstanceInScene("loaded-scene", 88) != nullptr);
    }

    // -- Empty projects load without inventing a scene -------------------------
    {
        EditorCoordinator c{makeDoc()};
        const auto loaded = loadProjectFromText(c, zeroSceneJson());
        CHECK(loaded.ok);
        CHECK(c.document().data().scenes.empty());
        CHECK(c.state().activeSceneId.empty());
        CHECK(c.selection().primaryEntity == INVALID_ENTITY);
        CHECK(!c.document().isDirty());
    }

    // -- Serializer round-trip keeps authoring data, not workspace state ------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.apply(SetActiveToolIntent{EditorTool::Pan});
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 410.f});
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, {321.f, 20.f}}).ok);

        SerializeResult serialized = ProjectSerializer::serialize(c.document());
        CHECK(serialized.ok);
        CHECK(serialized.value.find("selection") == std::string::npos);
        CHECK(serialized.value.find("sceneViews") == std::string::npos);
        CHECK(serialized.value.find("activeTool") == std::string::npos);
        CHECK(serialized.value.find("leftPanelWidth") == std::string::npos);
        CHECK(serialized.value.find("consoleVisible") == std::string::npos);

        DeserializeResult deserialized = ProjectSerializer::deserialize(serialized.value);
        CHECK(deserialized.ok);
        DeserializeResult validated =
            ProjectValidator::validate(std::move(deserialized.value));
        CHECK(validated.ok);
        CHECK(validated.value.findInstanceInScene(kSceneA, kHero)->transform.position.x
              == 321.f);
    }

    // -- File load adapter: filesystem failure leaves the coordinator intact ---
    {
        const std::filesystem::path dir = testTempDir();
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 360.f});
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, {44.f, 55.f}}).ok);

        const uint64_t revisionBefore = c.document().revision();
        const uint64_t savedBefore = c.document().savedRevision();
        const bool dirtyBefore = c.document().isDirty();
        const std::size_t undoBefore = c.undoSize();

        const auto missing = loadProjectFromFile(c, dir / "missing.artcade-project");
        CHECK(!missing.ok);
        CHECK(missing.error.stage == ProjectLoadStage::FileRead);
        expectCoordinatorBaseline(c, "spike", kSceneA, kHero, 360.f,
                                  undoBefore, revisionBefore, savedBefore, dirtyBefore);

        const std::filesystem::path emptyFile = dir / "empty.artcade-project";
        writeTextFile(emptyFile, "");
        const auto empty = loadProjectFromFile(c, emptyFile);
        CHECK(!empty.ok);
        CHECK(empty.error.stage == ProjectLoadStage::Deserialize);
        expectCoordinatorBaseline(c, "spike", kSceneA, kHero, 360.f,
                                  undoBefore, revisionBefore, savedBefore, dirtyBefore);

        const std::filesystem::path validFile = dir / "valid.artcade-project";
        writeTextFile(validFile, validProjectJson());
        const auto loaded = loadProjectFromFile(c, validFile);
        CHECK(loaded.ok);
        CHECK(loaded.operation.change.kind == DomainChangeKind::ProjectReplaced);
        CHECK(c.document().data().projectName == "LoadedProject");
        CHECK(c.state().activeSceneId == "loaded-scene");
        CHECK(!c.document().isDirty());
    }

    // -- Atomic save: failure does not mark saved; success reloads from disk ---
    {
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path projectPath = dir / "project.artcade-project";

        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.apply(SetViewportZoomIntent{kSceneA, 2.5f});
        c.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 390.f});
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, {777.f, 20.f}}).ok);
        CHECK(c.canUndo());
        CHECK(c.document().isDirty());

        const uint64_t revisionBeforeFailedSave = c.document().revision();
        const uint64_t savedBeforeFailedSave = c.document().savedRevision();
        const std::size_t undoBeforeFailedSave = c.undoSize();
        const std::filesystem::path blockedDestination = dir / "blocked";
        std::filesystem::create_directory(blockedDestination);

        const auto failedSave = saveProjectToFile(c, blockedDestination);
        CHECK(!failedSave.ok);
        CHECK(failedSave.error.stage == ProjectSaveStage::FileWrite);
        CHECK(c.document().revision() == revisionBeforeFailedSave);
        CHECK(c.document().savedRevision() == savedBeforeFailedSave);
        CHECK(c.document().isDirty());
        CHECK(c.undoSize() == undoBeforeFailedSave);
        CHECK(std::filesystem::is_directory(blockedDestination));
        CHECK(!hasTempSibling(blockedDestination));

        const auto saved = saveProjectToFile(c, projectPath);
        CHECK(saved.ok);
        CHECK(saved.operation.change.kind == DomainChangeKind::None);
        CHECK(saved.operation.invalidation == EditorInvalidation::Toolbar);
        CHECK(!c.document().isDirty());
        CHECK(c.document().revision() == revisionBeforeFailedSave);
        CHECK(c.document().savedRevision() == c.document().revision());
        CHECK(c.undoSize() == undoBeforeFailedSave);
        CHECK(c.canUndo());

        const std::string bytes = readTextFile(projectPath);
        CHECK(bytes.find("activeSceneId") != std::string::npos); // persisted start scene
        CHECK(bytes.find("selection") == std::string::npos);
        CHECK(bytes.find("sceneViews") == std::string::npos);
        CHECK(bytes.find("activeTool") == std::string::npos);
        CHECK(bytes.find("splitter") == std::string::npos);
        CHECK(bytes.find("hierarchyFilter") == std::string::npos);
        CHECK(bytes.find("consoleVisible") == std::string::npos);
        CHECK(bytes.find("PlaySession") == std::string::npos);
        CHECK(bytes.find("Rml") == std::string::npos);

        EditorCoordinator sameCoordinator{makeReplacementDoc()};
        sameCoordinator.apply(ResizePanelIntent{ResizePanelIntent::Panel::Left, 444.f});
        sameCoordinator.apply(SelectEntityIntent{77});
        CHECK(sameCoordinator.execute(SetEntityPositionCommand{
            "scene-replacement", 77, {1.f, 2.f}}).ok);
        CHECK(sameCoordinator.canUndo());

        const auto reloadedSame = loadProjectFromFile(sameCoordinator, projectPath);
        CHECK(reloadedSame.ok);
        CHECK(sameCoordinator.document().findInstanceInScene(kSceneA, kHero)
                  ->transform.position.x == 777.f);
        CHECK(sameCoordinator.uiState().leftPanelWidth == 444.f);
        CHECK(sameCoordinator.selection().primaryEntity == INVALID_ENTITY);
        CHECK(sameCoordinator.undoSize() == 0);
        CHECK(!sameCoordinator.canUndo());
        CHECK(!sameCoordinator.document().isDirty());

        EditorCoordinator fresh{makeReplacementDoc()};
        const auto reloadedFresh = loadProjectFromFile(fresh, projectPath);
        CHECK(reloadedFresh.ok);
        CHECK(fresh.document().findInstanceInScene(kSceneA, kHero)
                  ->transform.position.x == 777.f);
        CHECK(fresh.uiState().leftPanelWidth == 280.f);
        CHECK(fresh.selection().primaryEntity == INVALID_ENTITY);
        CHECK(fresh.state().activeTool == EditorTool::Select);
        CHECK(!fresh.document().isDirty());
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

    // -- CreateEntityCommand: add, invalidation, DomainChange, undo -------------
    {
        EditorCoordinator c{makeDoc()};
        const auto r = c.execute(
            CreateEntityCommand{kSceneA, 100, "Enemy", "Enemy 1", {5.f, 6.f}});
        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::EntityAdded);
        CHECK(r.change.entityId == 100);
        CHECK(c.consumeInvalidations()
              == (EditorInvalidation::Hierarchy | EditorInvalidation::Viewport));
        const SceneInstanceDef* added = c.document().findInstanceInScene(kSceneA, 100);
        CHECK(added != nullptr);
        CHECK(added->objectTypeId == "Enemy");
        CHECK(added->transform.position.x == 5.f);
        // Undo removes exactly the placed instance.
        CHECK(c.canUndo());
        c.undo();
        CHECK(c.document().findInstanceInScene(kSceneA, 100) == nullptr);
    }

    // -- CreateEntityCommand: invalid input does not mutate or invalidate ------
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        const uint64_t revBefore = c.document().revision();
        // Each failed command returns no invalidation of its own (§24.3); the
        // coordinator only raises a Console error, never a structural flag.
        CHECK(c.execute(CreateEntityCommand{kSceneA, kHero, "Dup", "Dup", {}}).invalidation
              == EditorInvalidation::None);                                       // id clash
        CHECK(!c.execute(CreateEntityCommand{kSceneA, 0, "Enemy", "E", {}}).ok);  // zero id
        CHECK(!c.execute(CreateEntityCommand{kSceneA, 5, "", "E", {}}).ok);       // empty type
        CHECK(!c.execute(CreateEntityCommand{"missing", 5, "Enemy", "E", {}}).ok);// no scene
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(!has(inv, EditorInvalidation::Hierarchy));
        CHECK(!has(inv, EditorInvalidation::Viewport));
        CHECK(c.document().revision() == revBefore);                  // state untouched
        CHECK(!c.canUndo());
        CHECK(c.document().findScene(kSceneA)->instances.size() == 1); // only kHero
    }

    // -- DeleteEntityCommand: remove, then undo restores order -----------------
    {
        EditorCoordinator c{makeDoc()};
        // Two more instances so order restoration is observable.
        CHECK(c.execute(CreateEntityCommand{kSceneA, 101, "Enemy", "E1", {}}).ok);
        CHECK(c.execute(CreateEntityCommand{kSceneA, 102, "Enemy", "E2", {}}).ok);
        // instances: [kHero, 101, 102]; delete the middle one.
        const auto r = c.execute(DeleteEntityCommand{kSceneA, 101});
        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::EntityRemoved);
        CHECK(c.document().findInstanceInScene(kSceneA, 101) == nullptr);
        CHECK(c.document().findScene(kSceneA)->instances.size() == 2);
        // Undo restores it at its original index (1), not appended at the end.
        c.undo();
        const auto& instances = c.document().findScene(kSceneA)->instances;
        CHECK(instances.size() == 3);
        CHECK(instances[1].id == 101);
    }

    // -- DeleteEntityCommand: missing instance fails without side effects ------
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        const uint64_t revBefore = c.document().revision();
        const auto r = c.execute(DeleteEntityCommand{kSceneA, 9999});
        CHECK(!r.ok);
        CHECK(r.invalidation == EditorInvalidation::None);
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(!has(inv, EditorInvalidation::Hierarchy));
        CHECK(!has(inv, EditorInvalidation::Viewport));
        CHECK(c.document().revision() == revBefore);
        CHECK(!c.canUndo());
    }

    // -- DeleteSceneCommand: removes scene + instances, undo is exact ----------
    {
        EditorCoordinator c{makeDoc()};
        // kSceneA is the start scene and holds kHero.
        CHECK(c.document().startSceneId() == kSceneA);
        const auto r = c.execute(DeleteSceneCommand{kSceneA});
        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::SceneRemoved);
        // The command declares its own structural flags (incl. Toolbar: the set
        // of valid Play targets can change) …
        CHECK(r.invalidation == (EditorInvalidation::Hierarchy
                                 | EditorInvalidation::Viewport
                                 | EditorInvalidation::Project
                                 | EditorInvalidation::Toolbar));
        // … and the coordinator augments them after reconciling the workspace
        // (the active scene changed, so Inspector and Toolbar refresh too).
        const EditorInvalidation consumed = c.consumeInvalidations();
        CHECK(has(consumed, EditorInvalidation::Hierarchy));
        CHECK(has(consumed, EditorInvalidation::Viewport));
        CHECK(has(consumed, EditorInvalidation::Project));
        CHECK(has(consumed, EditorInvalidation::Inspector));
        CHECK(has(consumed, EditorInvalidation::Toolbar));
        CHECK(!c.document().hasScene(kSceneA));
        // Deleting the start scene reassigns it to a surviving scene.
        CHECK(c.document().startSceneId() == kSceneB);
        // Undo restores the scene, its instance, and the original start scene.
        c.undo();
        CHECK(c.document().hasScene(kSceneA));
        CHECK(c.document().findInstanceInScene(kSceneA, kHero) != nullptr);
        CHECK(c.document().startSceneId() == kSceneA);
    }

    // -- DeleteSceneCommand: structural commands never trigger a Replace -------
    {
        EditorCoordinator c{makeDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        CHECK(c.execute(CreateEntityCommand{kSceneA, 200, "Enemy", "E", {}}).ok);
        CHECK(c.execute(DeleteEntityCommand{kSceneA, 200}).ok);
        CHECK(c.execute(DeleteSceneCommand{kSceneB}).ok);
        CHECK(c.document().replaceCount() == replacesBefore); // Patch, not Replace
    }

    // == Workspace reconciliation after structural deletes =====================
    // The document is the authority; EditorState must stay valid in the SAME
    // operation, with no follow-up callbacks or observers.

    // -- (1)(2) Deleting the active scene normalizes it and clears selection ----
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.state().activeSceneId == kSceneA);     // start scene is the default focus
        c.apply(SelectEntityIntent{kHero});
        CHECK(c.state().selection.primaryEntity == kHero);
        c.consumeInvalidations();

        CHECK(c.execute(DeleteSceneCommand{kSceneA}).ok);
        // (1) active scene normalized to a surviving scene.
        CHECK(c.state().activeSceneId == kSceneB);
        CHECK(c.document().hasScene(c.state().activeSceneId));
        // (2) selection cleared — it belonged to the deleted scene.
        CHECK(!c.state().selection.hasEntity());
        // The coordinator augmented the command flags during reconciliation.
        CHECK(has(c.consumeInvalidations(), EditorInvalidation::Inspector));
    }

    // -- (3) Deleting a non-active scene keeps active scene and selection -------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.apply(SelectSceneIntent{kSceneB}).ok);
        CHECK(c.execute(CreateEntityCommand{kSceneB, 300, "Enemy", "E", {}}).ok);
        CHECK(c.apply(SelectEntityIntent{300}).ok);
        CHECK(c.state().activeSceneId == kSceneB);
        CHECK(c.state().selection.primaryEntity == 300);

        CHECK(c.execute(DeleteSceneCommand{kSceneA}).ok); // delete the OTHER scene
        CHECK(c.state().activeSceneId == kSceneB);        // unchanged
        CHECK(c.state().selection.primaryEntity == 300);  // unchanged
    }

    // -- (4) Deleting the selected entity clears the selection -----------------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        CHECK(c.state().selection.primaryEntity == kHero);
        c.consumeInvalidations();
        CHECK(c.execute(DeleteEntityCommand{kSceneA, kHero}).ok);
        CHECK(!c.state().selection.hasEntity());
        // DeleteEntity alone returns Hierarchy|Viewport; reconciliation adds
        // Inspector so the now-empty inspector refreshes.
        CHECK(has(c.consumeInvalidations(), EditorInvalidation::Inspector));
    }

    // -- (5) Deleting a different entity preserves the selection ---------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(CreateEntityCommand{kSceneA, 301, "Enemy", "E", {}}).ok);
        c.apply(SelectEntityIntent{kHero});
        CHECK(c.state().selection.primaryEntity == kHero);
        CHECK(c.execute(DeleteEntityCommand{kSceneA, 301}).ok); // delete the OTHER one
        CHECK(c.state().selection.primaryEntity == kHero);      // preserved
    }

    // -- (6) No per-scene view state outlives its scene ------------------------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SetViewportZoomIntent{kSceneA, 2.f});
        c.apply(SetViewportZoomIntent{kSceneB, 3.f});
        CHECK(c.state().sceneViews.count(kSceneA) == 1);
        CHECK(c.state().sceneViews.count(kSceneB) == 1);
        CHECK(c.execute(DeleteSceneCommand{kSceneA}).ok);
        CHECK(c.state().sceneViews.count(kSceneA) == 0);  // pruned
        CHECK(c.state().sceneViews.count(kSceneB) == 1);  // kept
    }

    // -- (7) No dangling workspace id after execute OR undo --------------------
    // Undo restores the DOCUMENT, not the workspace: the brought-back scene is
    // not re-activated and the brought-back entity is not re-selected.
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        CHECK(c.execute(DeleteSceneCommand{kSceneA}).ok);
        CHECK(c.document().hasScene(c.state().activeSceneId));        // valid after execute
        CHECK(!c.state().selection.hasEntity());

        c.undo();
        CHECK(c.document().hasScene(kSceneA));                        // document restored
        CHECK(c.state().activeSceneId == kSceneB);                   // workspace NOT rewound
        CHECK(c.document().hasScene(c.state().activeSceneId));        // still valid
        CHECK(!c.state().selection.hasEntity());                     // not auto-reselected
    }

    // -- Empty project is a valid state: no fabricated scene -------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(DeleteSceneCommand{kSceneA}).ok);
        CHECK(c.execute(DeleteSceneCommand{kSceneB}).ok);
        CHECK(c.document().data().scenes.empty());
        CHECK(c.state().activeSceneId.empty());   // no fake scene invented
        CHECK(!c.state().selection.hasEntity());
        CHECK(c.state().sceneViews.empty());
    }

    // == Hierarchy actions (the restricted UI wiring, tested UI-free) ==========
    // The Hierarchy panel is a thin shim over these functions; testing them here
    // proves the RmlUi click -> command -> reconcile -> invalidation path without
    // any RmlUi dependency.

    // (14) No action can reach a mutable ProjectDocument: document() is const-only.
    static_assert(std::is_same_v<decltype(std::declval<EditorCoordinator>().document()),
                                 const ProjectDocument&>,
                  "actions must only see a read-only document");

    // -- (1)(2)(13) Add Entity runs exactly one command with a non-colliding id -
    {
        EditorCoordinator c{makeDoc()};
        CHECK(nextAvailableEntityId(c.document(), kSceneA) == 43); // past kHero (42)
        const auto r = addEntity(c);
        CHECK(r.ok);
        CHECK(c.undoSize() == 1);                                  // exactly one command
        CHECK(c.document().findInstanceInScene(kSceneA, 43) != nullptr);
        CHECK(c.document().findInstanceInScene(kSceneA, 43)->id != kHero); // no collision
    }

    // -- (3) Add Entity invalidates only the expected views --------------------
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        CHECK(addEntity(c).ok);
        // CreateEntity declares Hierarchy|Viewport; selection unchanged and active
        // scene valid, so reconciliation adds nothing.
        CHECK(c.consumeInvalidations()
              == (EditorInvalidation::Hierarchy | EditorInvalidation::Viewport));
    }

    // -- (4) Add Entity without an active scene mutates nothing -----------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(deleteScene(c, kSceneA).ok);
        CHECK(deleteScene(c, kSceneB).ok);     // now the project has no scenes
        CHECK(c.state().activeSceneId.empty());
        const uint64_t revBefore = c.document().revision();
        const std::size_t undoBefore = c.undoSize();
        c.consumeInvalidations();
        CHECK(!addEntity(c).ok);               // precondition fails, no command runs
        CHECK(c.document().revision() == revBefore);
        CHECK(c.undoSize() == undoBefore);
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
    }

    // -- (5) Delete Entity uses the authoritative scene + selection ------------
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        CHECK(deleteSelectedEntity(c).ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero) == nullptr);
    }

    // -- (6) Deleting the selected entity empties the selection (reconcile) -----
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.consumeInvalidations();
        CHECK(deleteSelectedEntity(c).ok);
        CHECK(!c.state().selection.hasEntity());
        CHECK(has(c.consumeInvalidations(), EditorInvalidation::Inspector));
    }

    // -- (7) A failed Delete Entity triggers no panel refresh ------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(!c.selection().hasEntity());
        c.consumeInvalidations();
        const std::size_t undoBefore = c.undoSize();
        CHECK(!deleteSelectedEntity(c).ok);    // nothing selected -> no command
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(!has(inv, EditorInvalidation::Hierarchy));
        CHECK(!has(inv, EditorInvalidation::Viewport));
        CHECK(c.undoSize() == undoBefore);
    }

    // -- (8) Add Scene does not directly change EditorState --------------------
    {
        EditorCoordinator c{makeDoc()};
        const SceneId activeBefore = c.state().activeSceneId;
        const SceneId expectedId   = makeUniqueSceneId(c.document());   // "scene-1"
        const auto r = addScene(c);
        CHECK(r.ok);
        CHECK(c.state().activeSceneId == activeBefore);   // active scene unchanged
        CHECK(!c.state().selection.hasEntity());
        CHECK(c.document().hasScene(expectedId));          // the new scene now exists
    }

    // -- (9) Delete active scene normalizes the workspace in the same cycle ----
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.state().activeSceneId == kSceneA);
        CHECK(deleteScene(c, kSceneA).ok);
        CHECK(c.state().activeSceneId == kSceneB);
        CHECK(c.document().hasScene(c.state().activeSceneId));
    }

    // -- (10) Delete non-active scene preserves scene + selection --------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.apply(SelectSceneIntent{kSceneB}).ok);
        CHECK(addEntity(c).ok);                            // an entity in B
        const EntityId placed = nextAvailableEntityId(c.document(), kSceneB) - 1;
        CHECK(c.apply(SelectEntityIntent{placed}).ok);
        CHECK(deleteScene(c, kSceneA).ok);                 // delete the OTHER scene
        CHECK(c.state().activeSceneId == kSceneB);
        CHECK(c.state().selection.primaryEntity == placed);
    }

    // -- (11)(12) Undo refreshes via command invalidations, not the workspace --
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        CHECK(deleteSelectedEntity(c).ok);                 // selection cleared
        c.consumeInvalidations();
        c.undo();                                          // entity comes back
        // (11) the Hierarchy is told to refresh by the command's own invalidation.
        CHECK(has(c.consumeInvalidations(), EditorInvalidation::Hierarchy));
        CHECK(c.document().findInstanceInScene(kSceneA, kHero) != nullptr);
        // (12) the brought-back entity is NOT auto-reselected.
        CHECK(!c.state().selection.hasEntity());
    }

    // -- (12b) Undo of delete-active-scene does not re-activate the scene ------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(deleteScene(c, kSceneA).ok);                 // active -> kSceneB
        CHECK(c.state().activeSceneId == kSceneB);
        c.undo();                                          // scene A back in document
        CHECK(c.document().hasScene(kSceneA));
        CHECK(c.state().activeSceneId == kSceneB);         // workspace not rewound
    }

    // -- (15) No Hierarchy action path performs a Replace ----------------------
    {
        EditorCoordinator c{makeDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        CHECK(addScene(c).ok);
        CHECK(addEntity(c).ok);
        c.apply(SelectEntityIntent{nextAvailableEntityId(c.document(), kSceneA) - 1});
        CHECK(deleteSelectedEntity(c).ok);
        CHECK(deleteScene(c, kSceneB).ok);
        CHECK(c.document().replaceCount() == replacesBefore);   // Patch, never Replace
    }

    // == Play guards: an action without a valid target must be unavailable =====
    // The guard lives in the coordinator (the point that creates the session),
    // so a shortcut, menu or programmatic call cannot bypass a disabled button.

    // -- (1)(2)(3)(4) Empty project: both modes unavailable and rejected -------
    {
        EditorCoordinator c{ProjectDoc{}};             // zero scenes
        CHECK(c.document().data().scenes.empty());
        CHECK(!c.canPlayProject());                    // (1)
        CHECK(!c.canPlayCurrentScene());               // (2)
        c.consumeInvalidations();
        const auto r = c.playProject();
        CHECK(!r.ok);                                  // (3) application-level rejection
        CHECK(!c.isPlaying());                         // (4) no PlaySession created
        CHECK(c.playSession() == nullptr);
        CHECK(c.consumeInvalidations() == EditorInvalidation::None); // nothing invalidated
    }

    // -- (5) Creating the first scene invalidates the Toolbar ------------------
    {
        EditorCoordinator c{ProjectDoc{}};
        c.consumeInvalidations();
        CHECK(c.execute(CreateSceneCommand{"scene-1", "Scene 1"}).ok);
        CHECK(has(c.consumeInvalidations(), EditorInvalidation::Toolbar));
    }

    // -- (6) Play Project enables when the start scene is valid ----------------
    {
        EditorCoordinator c{makeDoc()};                // startSceneId == kSceneA
        CHECK(c.canPlayProject());
        const auto r = c.playProject();
        CHECK(r.ok);
        CHECK(c.isPlaying());
        CHECK(c.playSession() != nullptr);
        CHECK(c.playSession()->sceneId() == kSceneA);  // Play Project target = start scene
        // Play does not touch the authoring document.
        CHECK(!c.document().isDirty());
    }

    // -- (7) Without an active scene, Play Current Scene stays disabled --------
    {
        EditorCoordinator c{ProjectDoc{}};
        CHECK(c.state().activeSceneId.empty());
        CHECK(!c.canPlayCurrentScene());
        CHECK(!c.playCurrentScene().ok);
        CHECK(!c.isPlaying());
    }

    // -- (8) Selecting a scene enables Play Current Scene ----------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.apply(SelectSceneIntent{kSceneB}).ok);
        CHECK(c.canPlayCurrentScene());
        const auto r = c.playCurrentScene();
        CHECK(r.ok);
        CHECK(c.playSession()->sceneId() == kSceneB);  // target = active scene
    }

    // -- (9) Deleting the last scene disables both modes in the same cycle -----
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(DeleteSceneCommand{kSceneA}).ok);
        CHECK(c.execute(DeleteSceneCommand{kSceneB}).ok);
        CHECK(c.document().data().scenes.empty());
        CHECK(!c.canPlayProject());
        CHECK(!c.canPlayCurrentScene());
    }

    // -- (10) A direct (shortcut/programmatic) Play cannot bypass the guard ----
    {
        EditorCoordinator c{ProjectDoc{}};
        CHECK(!c.playProject().ok);        // no button involved — the app path itself rejects
        CHECK(!c.playCurrentScene().ok);
        CHECK(!c.isPlaying());
    }

    // -- (11) A dangling startSceneId prevents Play Project --------------------
    {
        EditorCoordinator c{makeInvalidStartDoc()};    // startSceneId references no scene
        CHECK(!c.document().hasScene(c.document().startSceneId()));
        CHECK(!c.canPlayProject());
        CHECK(!c.playProject().ok);
    }

    // -- (12) A dangling activeSceneId prevents Play Current Scene -------------
    {
        EditorCoordinator c{makeInvalidStartDoc()};    // active scene also dangling
        CHECK(!c.document().hasScene(c.state().activeSceneId));
        CHECK(!c.canPlayCurrentScene());
        CHECK(!c.playCurrentScene().ok);
    }

    // -- Play/Stop round-trip: Stop only while playing, document untouched -----
    {
        EditorCoordinator c{makeDoc()};
        CHECK(!c.stopPlaying().ok);        // not playing yet
        CHECK(c.playProject().ok);
        CHECK(c.isPlaying());
        CHECK(c.stopPlaying().ok);
        CHECK(!c.isPlaying());
        CHECK(!c.document().isDirty());    // never mutated by Play/Stop
    }

    // == Start-scene invariant: scenes exist => startSceneId is valid ==========

    // -- (1)(2)(3) First scene becomes the start scene; workspace untouched ----
    {
        EditorCoordinator c{ProjectDoc{}};
        CHECK(c.document().startSceneId().empty());
        const SceneId activeBefore = c.state().activeSceneId;
        CHECK(c.execute(CreateSceneCommand{"scene-1", "Scene 1"}).ok);
        CHECK(c.document().startSceneId() == "scene-1");   // (1) invariant maintained
        CHECK(c.state().activeSceneId == activeBefore);    // (2) no auto-select
        CHECK(!c.state().selection.hasEntity());           // (3) selection untouched
    }

    // -- (4) Undo of the first scene restores an empty start scene -------------
    {
        EditorCoordinator c{ProjectDoc{}};
        CHECK(c.execute(CreateSceneCommand{"scene-1", "Scene 1"}).ok);
        c.undo();
        CHECK(c.document().data().scenes.empty());
        CHECK(c.document().startSceneId().empty());
    }

    // -- (5) Creating a second scene does not change the start scene -----------
    {
        EditorCoordinator c{ProjectDoc{}};
        CHECK(c.execute(CreateSceneCommand{"scene-1", "Scene 1"}).ok);
        CHECK(c.execute(CreateSceneCommand{"scene-2", "Scene 2"}).ok);
        CHECK(c.document().startSceneId() == "scene-1");   // unchanged
    }

    // -- (6)(7)(8)(9) After the first scene: valid, saveable, playable ---------
    {
        EditorCoordinator c{ProjectDoc{}};
        CHECK(c.execute(CreateSceneCommand{"scene-1", "Scene 1"}).ok);
        // (6) the document now satisfies the validator (start scene is valid).
        CHECK(ProjectValidator::validate(ProjectDocument{c.document().data()}).ok);
        // (7) and saves successfully.
        const std::filesystem::path dir = testTempDir();
        const auto saved = saveProjectToFile(c, dir / "first.artcade-project");
        CHECK(saved.ok);
        // (8) Play Project is available, (9) Play Current Scene is not (no active scene).
        CHECK(c.canPlayProject());
        CHECK(!c.canPlayCurrentScene());
    }

    // -- (10) SetStartScene (valid) changes only the document ------------------
    {
        EditorCoordinator c{makeDoc()};                    // start scene = kSceneA
        const SceneId activeBefore = c.state().activeSceneId;
        c.apply(SelectEntityIntent{kHero});
        const auto r = c.execute(SetStartSceneCommand{kSceneB});
        CHECK(r.ok);
        CHECK(c.document().startSceneId() == kSceneB);
        CHECK(c.state().activeSceneId == activeBefore);    // workspace unchanged
        CHECK(c.state().selection.primaryEntity == kHero); // selection unchanged
    }

    // -- (11) SetStartScene to the current start is a no-op (no undo, no rev) --
    {
        EditorCoordinator c{makeDoc()};
        const uint64_t revBefore = c.document().revision();
        c.consumeInvalidations();
        const auto r = c.execute(SetStartSceneCommand{kSceneA}); // already the start
        CHECK(r.ok);
        CHECK(c.document().revision() == revBefore);       // no mutation
        CHECK(!c.canUndo());                               // not recorded
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
    }

    // -- (12) SetStartScene to a missing scene fails without structural change -
    {
        EditorCoordinator c{makeDoc()};
        const uint64_t revBefore = c.document().revision();
        c.consumeInvalidations();
        const auto r = c.execute(SetStartSceneCommand{"missing"});
        CHECK(!r.ok);
        CHECK(c.document().startSceneId() == kSceneA);     // unchanged
        CHECK(c.document().revision() == revBefore);
        CHECK(!c.canUndo());
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(!has(inv, EditorInvalidation::Hierarchy));
        CHECK(!has(inv, EditorInvalidation::Toolbar));
        CHECK(!has(inv, EditorInvalidation::Project));
    }

    // -- (13)(14) Undo restores the previous start; Hierarchy+Toolbar refresh --
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        CHECK(c.execute(SetStartSceneCommand{kSceneB}).ok);
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(has(inv, EditorInvalidation::Hierarchy));    // (14)
        CHECK(has(inv, EditorInvalidation::Toolbar));      // (14)
        c.undo();                                          // (13)
        CHECK(c.document().startSceneId() == kSceneA);
    }

    // -- (15) SetStartScene is a Patch, never a Replace ------------------------
    {
        EditorCoordinator c{makeDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        CHECK(c.execute(SetStartSceneCommand{kSceneB}).ok);
        CHECK(c.document().replaceCount() == replacesBefore);
    }

    // -- (16) Save/reload preserves the chosen start scene --------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetStartSceneCommand{kSceneB}).ok);
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "start.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        CHECK(reloaded.document().startSceneId() == kSceneB);
    }

    // == Sprite Renderer component + asset reference (vertical slice) ==========

    // -- (1)(15)(16) Add is a single Patch command, never a Replace -----------
    {
        EditorCoordinator c{makeSpriteDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        const auto r = c.execute(AddSpriteRendererCommand{kSceneA, kHero});
        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::ComponentAdded);
        CHECK(r.change.componentKind == ComponentKind::SpriteRenderer);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer.has_value());
        CHECK(c.document().replaceCount() == replacesBefore); // (15) Patch, not Replace
        CHECK(c.undoSize() == 1);                              // (16) one command
    }

    // -- (2) Adding a sprite renderer twice is rejected and not recorded -------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        const std::size_t undoBefore = c.undoSize();
        CHECK(!c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok); // duplicate
        CHECK(c.undoSize() == undoBefore);
    }

    // -- (3) Remove captures the component; undo restores it exactly ----------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-hero"}).ok);
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok);
        CHECK(c.execute(RemoveSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(!c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer.has_value());
        c.undo();
        const auto& comp = *c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer;
        CHECK(comp.imageAssetId == "img-hero");
        CHECK(comp.visible == false);
    }

    // -- (4) Setting the same visibility is a no-op (no undo, no mutation) -----
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok); // visible defaults true
        const std::size_t undoBefore = c.undoSize();
        const uint64_t revBefore = c.document().revision();
        c.consumeInvalidations();
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, true}).ok);
        CHECK(c.undoSize() == undoBefore);                       // not recorded
        CHECK(c.document().revision() == revBefore);             // not mutated
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
    }

    // -- (5) A missing asset id is rejected without mutation ------------------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(!c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "does-not-exist"}).ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer->imageAssetId.empty());
    }

    // -- (6) A non-image asset id (a tileset) is rejected ---------------------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(!c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "tiles-1"}).ok);
    }

    // -- (7) Setting a valid asset invalidates only Inspector | Viewport ------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        c.consumeInvalidations();
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-hero"}).ok);
        CHECK(c.consumeInvalidations()
              == (EditorInvalidation::Inspector | EditorInvalidation::Viewport));
    }

    // -- (8) Undo restores the previous asset ---------------------------------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-hero"}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer->imageAssetId == "img-alt");
        c.undo();
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer->imageAssetId == "img-hero");
    }

    // -- (9)(10) The render projection reflects presence, visibility and asset -
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(!spriteRenderViewOf(*c.document().findInstanceInScene(kSceneA, kHero)).present);
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-hero"}).ok);
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok);
        const SpriteRenderView v = spriteRenderViewOf(*c.document().findInstanceInScene(kSceneA, kHero));
        CHECK(v.present);
        CHECK(!v.visible);
        CHECK(v.assetId == "img-hero");
        // (10) the projection changes after execute and after undo.
        c.undo(); c.undo();   // undo asset, undo... visibility
        c.undo();             // undo add
        CHECK(!spriteRenderViewOf(*c.document().findInstanceInScene(kSceneA, kHero)).present);
    }

    // -- (11) Serializer round-trip preserves component + asset reference ------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-hero"}).ok);
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok);
        const auto ser = ProjectSerializer::serialize(c.document());
        CHECK(ser.ok);
        const auto de = ProjectSerializer::deserialize(ser.value);
        CHECK(de.ok);
        const SceneInstanceDef* inst = de.value.findInstanceInScene(kSceneA, kHero);
        CHECK(inst != nullptr && inst->spriteRenderer.has_value());
        CHECK(inst->spriteRenderer->imageAssetId == "img-hero");
        CHECK(inst->spriteRenderer->visible == false);
        CHECK(de.value.hasImageAsset("img-hero"));             // catalog round-tripped
    }

    // -- (12) Real save/reload preserves the component ------------------------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-hero"}).ok);
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "sprite.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const SceneInstanceDef* inst = reloaded.document().findInstanceInScene(kSceneA, kHero);
        CHECK(inst != nullptr && inst->spriteRenderer.has_value());
        CHECK(inst->spriteRenderer->imageAssetId == "img-hero");
    }

    // -- (13) No Inspector/workspace state leaks into the serialized project ---
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        const auto ser = ProjectSerializer::serialize(c.document());
        CHECK(ser.value.find("selection") == std::string::npos);
        CHECK(ser.value.find("Inspector") == std::string::npos);
        CHECK(ser.value.find("expanded") == std::string::npos);
    }

    // -- (14) Commands act on the explicit scene, never an implicit active one -
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(CreateEntityCommand{kSceneB, 500, "T", "T", {}}).ok);
        CHECK(c.state().activeSceneId == kSceneA);                       // active is A
        CHECK(c.execute(AddSpriteRendererCommand{kSceneB, 500}).ok);     // explicit B
        CHECK(c.document().findInstanceInScene(kSceneB, 500)->spriteRenderer.has_value());
        CHECK(!c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer.has_value());
    }

    // -- Inspector action: one click → one command on the authoritative target -
    {
        EditorCoordinator c{makeSpriteDoc()};
        c.apply(SelectEntityIntent{kHero});
        const std::size_t before = c.undoSize();
        CHECK(addSpriteRenderer(c).ok);
        CHECK(c.undoSize() == before + 1);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer.has_value());
        // No selection → no-op, no command.
        EditorCoordinator empty{makeSpriteDoc()};
        CHECK(!addSpriteRenderer(empty).ok);
        CHECK(empty.undoSize() == 0);
    }

    // == Sprite renderer resolution: instance override vs object type ==========

    // -- (1) No override + sprite on the object type → inherited projection ----
    {
        EditorCoordinator c{makeInheritedDoc()};
        const SpriteRenderView v = resolveSpriteRenderer(c.document(), kSceneA, kHero);
        CHECK(v.present);
        CHECK(v.origin == ComponentOrigin::EntityDefinition);
        CHECK(v.assetId == "img-hero");
    }

    // -- (2)(5) An instance override prevails over the inherited component -----
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(resolveSpriteRenderer(c.document(), kSceneA, kHero).origin
              == ComponentOrigin::EntityDefinition);             // (5) distinguished: inherited
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        const SpriteRenderView v = resolveSpriteRenderer(c.document(), kSceneA, kHero);
        CHECK(v.origin == ComponentOrigin::InstanceOverride);    // (5) distinguished: override
        CHECK(v.assetId == "img-alt");                           // (2) override wins
    }

    // -- (3) Removing the override falls back to the inherited component -------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(RemoveSpriteRendererCommand{kSceneA, kHero}).ok);
        const SpriteRenderView v = resolveSpriteRenderer(c.document(), kSceneA, kHero);
        CHECK(v.present);
        CHECK(v.origin == ComponentOrigin::EntityDefinition);
        CHECK(v.assetId == "img-hero");
    }

    // -- (4) Undo of Remove restores the exact override -----------------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok);
        CHECK(c.execute(RemoveSpriteRendererCommand{kSceneA, kHero}).ok);
        c.undo();
        const auto& comp = *c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer;
        CHECK(comp.imageAssetId == "img-alt");
        CHECK(comp.visible == false);
        CHECK(resolveSpriteRenderer(c.document(), kSceneA, kHero).origin
              == ComponentOrigin::InstanceOverride);
    }

    // -- (6) Save/reload keeps the instance override absent (no base duplicated) -
    {
        EditorCoordinator c{makeInheritedDoc()};
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "inherit.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);
        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const SceneInstanceDef* inst = reloaded.document().findInstanceInScene(kSceneA, kHero);
        CHECK(inst != nullptr);
        CHECK(!inst->spriteRenderer.has_value());   // the inherited component is not materialized
    }

    // -- (7) A dangling asset on the inherited component is rejected too -------
    {
        ProjectDoc doc = makeSpriteDoc();
        EntityDef hero;
        hero.className = "Hero";
        hero.sprite.spriteAssetId = "ghost-asset";  // not in imageAssets
        doc.objectTypes.emplace("Hero", hero);
        CHECK(!ProjectValidator::validate(ProjectDocument{doc}).ok);
    }

    // -- (8) Deleting the instance does not touch the object type component ----
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(DeleteEntityCommand{kSceneA, kHero}).ok);
        CHECK(c.document().data().objectTypes.at("Hero").sprite.spriteAssetId == "img-hero");
    }

    // -- Mutation detection is revision-based: no-op vs real change -----------
    {
        EditorCoordinator c{makeSpriteDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);  // visible defaults true
        const uint64_t rev = c.document().revision();
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, true}).ok); // no-op
        CHECK(c.document().revision() == rev);   // revision unchanged → not recorded
        const std::size_t undoBefore = c.undoSize();
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok); // real change
        CHECK(c.document().revision() != rev);   // revision moved → recorded
        CHECK(c.undoSize() == undoBefore + 1);
    }

    std::cout << "editor-core-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

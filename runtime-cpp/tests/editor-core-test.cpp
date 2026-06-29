// editor-core-test.cpp — architectural guarantees of the native editor core.
//
// Each CHECK maps to a numbered requirement in the refactor prompt (§24). The
// core has no Raylib / RmlUi dependency, so these run in the plain CTest harness
// with no GL context and no stubs.

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/app/hierarchy_actions.h"
#include "editor-native/app/input_routing.h"
#include "editor-native/app/inspector_commit.h"
#include "editor-native/app/asset_import.h"
#include "editor-native/app/project_file.h"
#include "editor-native/app/project_load.h"
#include "editor-native/app/unsaved_guard.h"
#include "editor-native/app/inspector_actions.h"
#include "editor-native/commands/box_collider_commands.h"
#include "editor-native/commands/linear_mover_commands.h"
#include "editor-native/commands/top_down_controller_commands.h"
#include "editor-native/commands/image_asset_commands.h"
#include "editor-native/commands/audio_asset_commands.h"
#include "editor-native/commands/font_asset_commands.h"
#include "editor-native/commands/entity_commands.h"
#include "editor-native/commands/scene_commands.h"
#include "editor-native/commands/sprite_commands.h"
#include "editor-native/model/project_io.h"
#include "editor-native/model/play_session.h"
#include "editor-native/model/box_collider_view.h"
#include "editor-native/model/scene_frame_snapshot.h"
#include "editor-native/model/sprite_render_view.h"
#include "editor-native/view/scene_view_camera.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <limits>
#include <optional>
#include <string>
#include <system_error>
#include <type_traits>
#include <utility>
#include <vector>

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
    ImageAssetDef hero;  hero.assetId = "img-hero";  hero.sourcePath = "sprites/hero.ppm";  doc.imageAssets.push_back(hero);
    ImageAssetDef alt;   alt.assetId  = "img-alt";   alt.sourcePath = "sprites/alt.ppm";   doc.imageAssets.push_back(alt);
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

// makeInheritedDoc plus an authored LinearMover on the "Hero" object type, so the
// kHero instance drifts during Play. Direction is deliberately non-unit (3,0) to
// exercise normalization.
static ProjectDoc makeMoverDoc() {
    ProjectDoc doc = makeInheritedDoc();
    LinearMoverComponent lm;
    lm.directionX = 3.f;
    lm.directionY = 0.f;
    lm.speed = 100.f;
    doc.objectTypes.at("Hero").linearMover = lm;
    return doc;
}

// makeInheritedDoc plus a TopDownController on "Hero" (speed = maxSpeed), so the
// kHero instance is input-driven during Play.
static ProjectDoc makeTopDownDoc(float speed = 100.f) {
    ProjectDoc doc = makeInheritedDoc();
    TopDownControllerComponent tdc;
    tdc.maxSpeed = speed;
    doc.objectTypes.at("Hero").topDownController = tdc;
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

    // -- New Project: replacing with an empty document yields the clean, blank
    //    lifecycle start the application's New action produces. The guard
    //    (Save/Discard/Cancel) and the Play rejection are exercised separately
    //    (resolveUnsavedGuard tests; replaceProject-during-Play test); the path
    //    clearing and "Untitled" title are application state. Here we pin the
    //    domain transition: dirty edits + history + selection + view state in,
    //    a truly empty, clean, history-less project out.
    {
        EditorCoordinator c{makeDoc()};
        c.apply(SelectEntityIntent{kHero});
        c.apply(SetViewportZoomIntent{kSceneA, 2.0f});   // populate per-scene view state
        c.execute(SetEntityPositionCommand{kSceneA, kHero, {7.f, 8.f}});
        c.execute(SetEntityPositionCommand{kSceneA, kHero, {9.f, 10.f}});
        c.undo();                                   // leave a redo branch too
        CHECK(c.canUndo());
        CHECK(c.canRedo());
        CHECK(c.document().isDirty());
        CHECK(!c.state().sceneViews.empty());
        c.consumeInvalidations();

        const EditorUiState uiBefore = c.uiState();
        const auto r = c.replaceProject(ProjectDocument{ProjectDoc{}});

        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::ProjectReplaced);
        CHECK(c.document().startSceneId().empty());           // 0 scenes -> empty start
        CHECK(c.document().data().scenes.empty());
        CHECK(c.document().data().entities.empty());
        CHECK(c.document().data().imageAssets.empty());
        CHECK(c.document().data().audioAssets.empty());
        CHECK(c.document().data().fontAssets.empty());
        CHECK(c.state().activeSceneId.empty());
        CHECK(c.state().sceneViews.empty());                  // view state pruned
        CHECK(c.selection().primaryEntity == INVALID_ENTITY); // selection cleared
        CHECK(!c.canUndo());                                  // history cleared
        CHECK(!c.canRedo());
        CHECK(c.undoSize() == 0);
        CHECK(c.redoSize() == 0);
        CHECK(!c.document().isDirty());                       // clean (no destination yet)
        CHECK(c.document().revision() == c.document().savedRevision());
        CHECK(!c.isPlaying());                                // no session carried over
        CHECK(c.uiState().leftPanelWidth == uiBefore.leftPanelWidth);  // UI prefs kept
    }

    // -- Console copy: clipboard formatting + safe indexed lookup -------------
    //    The selection itself is local panel state (not exercised here); these
    //    pin the editor-core pieces the copy entry point relies on.
    {
        CHECK(formatConsoleMessageForClipboard(
                  ConsoleMessage{ConsoleMessage::Level::Info, "ready"}) == "[Info] ready");
        CHECK(formatConsoleMessageForClipboard(
                  ConsoleMessage{ConsoleMessage::Level::Warning, "watch out"})
              == "[Warning] watch out");
        // The full, unabbreviated model text is copied (UI truncation must not leak in).
        const std::string longText =
            "Open failed: invalid TopDownController speed: -20 in scene-a/entity-7";
        CHECK(formatConsoleMessageForClipboard(
                  ConsoleMessage{ConsoleMessage::Level::Error, longText})
              == "[Error] " + longText);

        EditorCoordinator c{makeDoc()};
        CHECK(c.consoleMessage(std::nullopt) == nullptr);  // nothing selected
        CHECK(c.consoleMessage(0) == nullptr);             // empty log
        c.logInfo("first");
        c.logError("second");
        CHECK(c.consoleMessage(0) != nullptr);
        CHECK(c.consoleMessage(0)->text == "first");
        CHECK(c.consoleMessage(1)->level == ConsoleMessage::Level::Error);
        CHECK(c.consoleMessage(2) == nullptr);             // out of range -> safe
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
        std::optional<PlaySession> session = PlaySession::startProject(c.document());
        CHECK(session.has_value());
        CHECK(session->sceneId() == kSceneA);
        CHECK(session->entities().size() == 1);

        std::optional<PlaySession> currentSceneSession =
            PlaySession::startActiveScene(c.document(), c.state().activeSceneId);
        CHECK(currentSceneSession.has_value());
        CHECK(currentSceneSession->sceneId() == kSceneB);
        CHECK(currentSceneSession->entities().empty());

        // The simulation mutates the session freely...
        session->entities()[0].transform.position = {500.f, 600.f};
        // ...the authoring document is untouched.
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        CHECK(c.document().revision() == revBefore);

        // -- §24.12  Stop needs no reload: destroying the session restores
        //            nothing because the document was never changed.
        session->entities().clear();
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
        CHECK(parseNumberField("12.").has_value());
        CHECK(*parseNumberField("12.") == 12.f);
        CHECK(!parseNumberField("-").has_value());
        CHECK(!parseNumberField(".").has_value());
        CHECK(!parseNumberField("1e").has_value());
        CHECK(!parseNumberField("nan").has_value());
        CHECK(!parseNumberField("inf").has_value());
        CHECK(!parseNumberField("12.5xz").has_value());
        CHECK(!parseNumberField("12px").has_value());
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
        CHECK(inv == (EditorInvalidation::Inspector | EditorInvalidation::Viewport
                      | EditorInvalidation::Toolbar));
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
              == (EditorInvalidation::Hierarchy | EditorInvalidation::Viewport
                  | EditorInvalidation::Toolbar));
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
              == (EditorInvalidation::Hierarchy | EditorInvalidation::Viewport
                  | EditorInvalidation::Toolbar));
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

    // -- Empty catalog: Add Entity creates a real object type + instance -------
    //    Regression for "Unknown object type: Entity": the first entity in a
    //    catalog-less project must produce a real, persisted object type (never a
    //    sentinel id) so object-type-scoped components are usable at once.
    {
        ProjectDoc fresh;
        fresh.projectName = "fresh";
        fresh.activeSceneId = "s";
        SceneDef scene; scene.id = "s"; scene.name = "S";
        fresh.scenes.emplace("s", scene);

        EditorCoordinator c{fresh};
        CHECK(c.document().data().objectTypes.empty());     // empty catalog
        CHECK(addEntity(c).ok);
        CHECK(c.undoSize() == 1);                           // (1) one command / one undo entry

        // (1)(2) a real object type now exists and the instance points to it.
        CHECK(c.document().data().objectTypes.size() == 1);
        const std::string typeId = c.document().data().objectTypes.begin()->first;
        CHECK(typeId != "Entity");                          // (9) no sentinel id as objectTypeId
        const SceneInstanceDef* inst = c.document().findInstanceInScene("s", 1);
        CHECK(inst != nullptr);
        CHECK(inst->objectTypeId == typeId);                // (2) references the real type
        CHECK(c.document().hasObjectType(inst->objectTypeId));
        CHECK(c.document().findObjectType(typeId)->name == "Entity");  // visual name preserved

        // (3) object-type-scoped component commands work immediately.
        CHECK(c.execute(AddTopDownControllerCommand{typeId}).ok);
        CHECK(c.document().data().objectTypes.at(typeId).topDownController.has_value());
        CHECK(c.execute(AddBoxColliderCommand{typeId}).ok);
        CHECK(c.execute(AddLinearMoverCommand{typeId}).ok);
    }

    // -- Undo/redo of the first entity restores both type and instance ---------
    {
        ProjectDoc fresh;
        fresh.activeSceneId = "s";
        SceneDef scene; scene.id = "s"; scene.name = "S";
        fresh.scenes.emplace("s", scene);

        EditorCoordinator c{fresh};
        CHECK(addEntity(c).ok);
        const std::string typeId = c.document().data().objectTypes.begin()->first;

        // (4) undo removes BOTH the instance and the object type it created.
        CHECK(c.undo().ok);
        CHECK(c.document().findInstanceInScene("s", 1) == nullptr);
        CHECK(c.document().data().objectTypes.empty());

        // (5) redo restores both with the same ids (no fresh generation).
        CHECK(c.redo().ok);
        CHECK(c.document().findInstanceInScene("s", 1) != nullptr);
        CHECK(c.document().data().objectTypes.size() == 1);
        CHECK(c.document().data().objectTypes.begin()->first == typeId);
        CHECK(c.document().findInstanceInScene("s", 1)->objectTypeId == typeId);
    }

    // -- (6) Non-empty catalog: Add Entity reuses the existing type ------------
    {
        EditorCoordinator c{makeInheritedDoc()};            // catalog has a real "Hero" type
        CHECK(c.document().hasObjectType("Hero"));
        const std::size_t typesBefore = c.document().data().objectTypes.size();
        CHECK(addEntity(c).ok);
        CHECK(c.document().data().objectTypes.size() == typesBefore);   // no new type
        const EntityId placed = nextAvailableEntityId(c.document(), kSceneA) - 1;
        const SceneInstanceDef* inst = c.document().findInstanceInScene(kSceneA, placed);
        CHECK(inst != nullptr);
        CHECK(inst->objectTypeId == "Hero");                            // reuses the existing type
        CHECK(c.document().hasObjectType(inst->objectTypeId));
    }

    // -- (7) A failed create-with-default-type makes no partial mutation -------
    {
        EditorCoordinator c{makeInheritedDoc()};            // "Hero" already exists
        const std::size_t typesBefore = c.document().data().objectTypes.size();
        const uint64_t revBefore = c.document().revision();
        // objectTypeId collides -> apply fails before any mutation.
        CHECK(!c.execute(CreateEntityWithDefaultTypeCommand{
                  kSceneA, 999, "Hero", "Entity", "X"}).ok);
        CHECK(c.document().data().objectTypes.size() == typesBefore);
        CHECK(c.document().findInstanceInScene(kSceneA, 999) == nullptr);
        CHECK(c.document().revision() == revBefore);        // no partial state
    }

    // -- (8) Save/reload preserves the created type and instance ---------------
    {
        ProjectDoc fresh;
        fresh.activeSceneId = "s";
        SceneDef scene; scene.id = "s"; scene.name = "S";
        fresh.scenes.emplace("s", scene);

        EditorCoordinator c{fresh};
        CHECK(addEntity(c).ok);
        const std::string typeId = c.document().data().objectTypes.begin()->first;

        const std::filesystem::path path = testTempDir() / "default-type.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        CHECK(reloaded.document().hasObjectType(typeId));
        const SceneInstanceDef* inst = reloaded.document().findInstanceInScene("s", 1);
        CHECK(inst != nullptr);
        CHECK(inst->objectTypeId == typeId);                // reference survives the round-trip
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

    // -- Start/Stop Play re-render the authoring-affordance panels -------------
    //    The authoring document is frozen during Play, so the Inspector,
    //    Hierarchy and Assets panels must re-render to disable their authoring
    //    controls on Start — and re-enable them on Stop.
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        CHECK(c.playProject().ok);
        const EditorInvalidation started = c.consumeInvalidations();
        CHECK(has(started, EditorInvalidation::Inspector));
        CHECK(has(started, EditorInvalidation::Hierarchy));
        CHECK(has(started, EditorInvalidation::Assets));
        CHECK(c.stopPlaying().ok);
        const EditorInvalidation stopped = c.consumeInvalidations();
        CHECK(has(stopped, EditorInvalidation::Inspector));
        CHECK(has(stopped, EditorInvalidation::Hierarchy));
        CHECK(has(stopped, EditorInvalidation::Assets));
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

    // -- Play materializes runtime sprite data and used assets only ------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.playProject().ok);
        CHECK(c.playSession() != nullptr);
        CHECK(c.playSession()->entities().size() == 1);
        CHECK(c.playSession()->entities()[0].sprite.has_value());
        CHECK(c.playSession()->entities()[0].sprite->assetId == "img-hero");
        CHECK(c.playSession()->entities()[0].sprite->visible);
        CHECK(c.playSession()->assets().imageAssets.size() == 1);
        CHECK(c.playSession()->assets().imageAssets.count("img-hero") == 1);
        CHECK(c.playSession()->assets().imageAssets.count("img-alt") == 0);

        const SceneFrameSnapshot playFrame = collectSceneFrameSnapshot(*c.playSession());
        CHECK(playFrame.hasScene);
        CHECK(playFrame.sprites.size() == 1);
        CHECK(playFrame.sprites[0].assetId == "img-hero");
        CHECK(playFrame.sprites[0].destination.x == -14.f); // x=10, width=48
    }

    // -- A materialized PlaySession is independent from later authoring edits --
    {
        EditorCoordinator c{makeInheritedDoc()};
        std::optional<PlaySession> session = PlaySession::startProject(c.document());
        CHECK(session.has_value()); // inherited img-hero at x=10
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, {50.f, 20.f}}).ok);
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);

        const SceneFrameSnapshot editFrame =
            collectSceneFrameSnapshot(c.document(), kSceneA, INVALID_ENTITY);
        CHECK(editFrame.sprites.size() == 1);
        CHECK(editFrame.sprites[0].assetId == "img-alt");
        CHECK(editFrame.sprites[0].destination.x == 26.f); // x=50, width=48

        const SceneFrameSnapshot playFrame = collectSceneFrameSnapshot(*session);
        CHECK(playFrame.sprites.size() == 1);
        CHECK(playFrame.sprites[0].assetId == "img-hero");
        CHECK(playFrame.sprites[0].destination.x == -14.f); // still x=10

        session->entities()[0].transform.position = {500.f, 600.f};
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 50.f);
        CHECK(c.document().revision() > 0);
    }

    // -- Play materialization covers absence, visibility, and dangling assets ---
    {
        EditorCoordinator noSprite{makeSpriteDoc()};
        CHECK(noSprite.playProject().ok);
        CHECK(noSprite.playSession()->entities().size() == 1);
        CHECK(!noSprite.playSession()->entities()[0].sprite.has_value());
        CHECK(noSprite.playSession()->assets().imageAssets.empty());

        EditorCoordinator invisible{makeInheritedDoc()};
        CHECK(invisible.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(invisible.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        CHECK(invisible.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok);
        CHECK(invisible.playProject().ok);
        CHECK(invisible.playSession()->entities()[0].sprite.has_value());
        CHECK(invisible.playSession()->entities()[0].sprite->assetId == "img-alt");
        CHECK(!invisible.playSession()->entities()[0].sprite->visible);
        CHECK(invisible.playSession()->assets().imageAssets.size() == 1);
        CHECK(invisible.playSession()->assets().imageAssets.count("img-alt") == 1);

        ProjectDoc danglingDoc = makeInheritedDoc();
        danglingDoc.objectTypes.at("Hero").sprite.spriteAssetId = "missing-image";
        EditorCoordinator dangling{danglingDoc};
        CHECK(!dangling.playProject().ok);
        CHECK(!dangling.isPlaying());
    }

    // -- Project replace has an explicit policy during Play --------------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.playProject().ok);
        const uint32_t replacesBefore = c.document().replaceCount();
        CHECK(!c.replaceProject(ProjectDocument{makeReplacementDoc()}).ok);
        CHECK(c.isPlaying());
        CHECK(c.document().replaceCount() == replacesBefore);
    }

    // -- Authoring commands and undo are blocked while Play is running --------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, {25.f, 20.f}}).ok);
        CHECK(c.canUndo());
        const uint64_t revisionBefore = c.document().revision();
        const std::size_t undoBefore = c.undoSize();

        CHECK(c.playProject().ok);
        CHECK(c.isPlaying());
        CHECK(!c.execute(SetEntityPositionCommand{kSceneA, kHero, {99.f, 20.f}}).ok);
        CHECK(!c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(!c.undo().ok);
        CHECK(c.document().revision() == revisionBefore);
        CHECK(c.undoSize() == undoBefore);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 25.f);
    }

    // -- A blocked authoring command only emits an intentional Console warning -
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.playProject().ok);
        c.consumeInvalidations(); // discard Start Play Toolbar | Viewport | Console
        const std::size_t logBefore = c.consoleLog().size();
        const uint64_t revisionBefore = c.document().revision();

        CHECK(!c.execute(SetEntityPositionCommand{kSceneA, kHero, {99.f, 20.f}}).ok);
        CHECK(c.document().revision() == revisionBefore);
        CHECK(c.consoleLog().size() == logBefore + 1);
        CHECK(c.consoleLog().back().level == ConsoleMessage::Level::Warning);
        CHECK(c.consumeInvalidations() == EditorInvalidation::Console);
    }

    // -- Workspace intents remain allowed during Play and do not retarget Play -
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(CreateEntityCommand{kSceneB, 100, "Enemy", "Enemy B", {5.f, 6.f}}).ok);
        CHECK(c.playProject().ok);
        const SceneFrameSnapshot playBefore = collectSceneFrameSnapshot(*c.playSession());
        CHECK(playBefore.sceneId == kSceneA);
        CHECK(playBefore.sprites.size() == 1);

        CHECK(c.apply(SelectSceneIntent{kSceneB}).ok);
        CHECK(c.state().activeSceneId == kSceneB);
        CHECK(c.playSession()->sceneId() == kSceneA);
        const SceneFrameSnapshot playAfterIntent = collectSceneFrameSnapshot(*c.playSession());
        CHECK(playAfterIntent.sceneId == kSceneA);
        CHECK(playAfterIntent.sprites.size() == 1);

        CHECK(c.apply(SelectEntityIntent{100}).ok);
        CHECK(c.selection().primaryEntity == 100);
        const SceneFrameSnapshot playAfterSelection = collectSceneFrameSnapshot(*c.playSession());
        CHECK(playAfterSelection.sceneId == kSceneA);
        CHECK(!playAfterSelection.entities.empty());
        CHECK(!playAfterSelection.entities[0].selected);

        CHECK(c.stopPlaying().ok);
        CHECK(!c.isPlaying());
        const SceneFrameSnapshot editAfterStop =
            collectSceneFrameSnapshot(c.document(), c.state().activeSceneId,
                                      c.selection().primaryEntity);
        CHECK(editAfterStop.sceneId == kSceneB);
        CHECK(editAfterStop.entities.size() == 1);
        CHECK(editAfterStop.entities[0].entityId == 100);
        CHECK(editAfterStop.entities[0].selected);
        CHECK(editAfterStop.sprites.empty());
    }

    // == Authored runtime motion (LinearMover) ================================

    // -- materialize resolves authored direction*speed (normalized) -----------
    {
        EditorCoordinator c{makeMoverDoc()};
        CHECK(c.playProject().ok);
        c.consumeInvalidations();                 // Start Play Toolbar|Viewport|Console
        const RuntimeEntity* hero = c.playSession()->findEntity(kHero);
        CHECK(hero != nullptr);
        CHECK(hero->velocity.x == 100.f);         // (3,0) normalized -> (1,0) * 100
        CHECK(hero->velocity.y == 0.f);
        CHECK(hero->transform.position.x == 10.f);

        c.advanceRuntime(0.5f);
        const RuntimeEntity* moved = c.playSession()->findEntity(kHero);
        CHECK(moved->transform.position.x == 60.f);   // 10 + 100 * 0.5
        CHECK(moved->transform.position.y == 20.f);
        // Runtime tick, not authoring: document untouched, no invalidation.
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
    }

    // -- an entity without a mover has zero velocity and does not drift --------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.playProject().ok);
        const RuntimeEntity* hero = c.playSession()->findEntity(kHero);
        CHECK(hero->velocity.x == 0.f);
        CHECK(hero->velocity.y == 0.f);
        c.advanceRuntime(1.0f);
        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 10.f);
    }

    // -- a paused mover resolves to zero velocity -----------------------------
    {
        ProjectDoc doc = makeMoverDoc();
        doc.objectTypes.at("Hero").linearMover->_paused = true;
        EditorCoordinator c{doc};
        CHECK(c.playProject().ok);
        CHECK(c.playSession()->findEntity(kHero)->velocity.x == 0.f);
    }

    // -- advanceRuntime is inert when not playing -----------------------------
    {
        EditorCoordinator c{makeMoverDoc()};
        const uint64_t revisionBefore = c.document().revision();
        c.consumeInvalidations();
        CHECK(!c.isPlaying());
        c.advanceRuntime(1.0f);
        CHECK(c.document().revision() == revisionBefore);
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
    }

    // == Undo availability + toolbar refresh ==================================

    // -- A successful command enables Undo and refreshes the toolbar ----------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(!c.canUndo());
        c.consumeInvalidations();
        const EditorOperationResult moved =
            c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}});
        CHECK(moved.ok);
        CHECK(c.canUndo());
        // Toolbar is invalidated so the Undo button can re-derive its state.
        CHECK(has(c.consumeInvalidations(), EditorInvalidation::Toolbar));
    }

    // -- Undo restores the document, refreshes toolbar, and re-disables -------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 99.f);
        c.consumeInvalidations();

        const EditorOperationResult undone = c.undo();
        CHECK(undone.ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(has(inv, EditorInvalidation::Toolbar));
        CHECK(has(inv, EditorInvalidation::Inspector));   // the edited field re-reads
        CHECK(!c.canUndo());                              // back to empty history
    }

    // -- replaceProject clears the history (Undo disabled) -------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.canUndo());
        CHECK(c.replaceProject(ProjectDocument{makeReplacementDoc()}).ok);
        CHECK(!c.canUndo());
    }

    // -- Play disables Undo as affordance; Stop restores the existing history -
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.canUndo());
        CHECK(c.playProject().ok);
        CHECK(c.isPlaying());
        CHECK(!c.undo().ok);                 // coordinator guard rejects during Play
        CHECK(c.canUndo());                  // history survives Play
        CHECK(c.stopPlaying().ok);
        CHECK(!c.isPlaying());
        CHECK(c.canUndo());                  // derived state returns after Stop
    }

    // == Redo (history walk) ==================================================

    // -- (1) Execute -> Undo -> Redo restores the document exactly ------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.undo().ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        CHECK(c.canRedo());
        CHECK(c.redo().ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 99.f);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.y == 20.f);
        CHECK(!c.canRedo());
        CHECK(c.canUndo());
    }

    // -- (2) Redo restores the entry's recorded revision ----------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        const uint64_t revAfter = c.document().revision();
        CHECK(c.undo().ok);
        CHECK(c.document().revision() != revAfter);     // moved off the post-state
        CHECK(c.redo().ok);
        CHECK(c.document().revision() == revAfter);      // exactly the recorded id
    }

    // -- (3) Undo/Redo cross savedRevision (dirty correctness) ---------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.markProjectSaved().ok);
        CHECK(!c.document().isDirty());
        CHECK(c.undo().ok);
        CHECK(c.document().isDirty());                   // undone away from saved
        CHECK(c.redo().ok);
        CHECK(!c.document().isDirty());                  // redo back to the saved state
    }

    // -- (3b) Save taken at the post-undo state: redo dirties, undo cleans ----
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.undo().ok);                              // back to state A
        CHECK(c.markProjectSaved().ok);                 // save AT the post-undo state
        CHECK(!c.document().isDirty());
        CHECK(c.redo().ok);                             // to state B
        CHECK(c.document().isDirty());                  // away from the saved state
        CHECK(c.undo().ok);                             // back to state A
        CHECK(!c.document().isDirty());                 // saved state again
    }

    // -- (4) A new command after Undo discards the redo branch ----------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.undo().ok);
        CHECK(c.canRedo());
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{50.f, 20.f}}).ok);
        CHECK(!c.canRedo());                             // B is no longer redoable
        CHECK(!c.redo().ok);
    }

    // -- (5) replaceProject clears redo; (6) Save keeps it --------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.undo().ok);
        CHECK(c.canRedo());
        CHECK(c.markProjectSaved().ok);
        CHECK(c.canRedo());                              // (6) save does not clear redo
        CHECK(c.replaceProject(ProjectDocument{makeReplacementDoc()}).ok);
        CHECK(!c.canRedo());                             // (5) replace clears redo
    }

    // -- (7) Redo with no entry fails without effect --------------------------
    {
        EditorCoordinator c{makeDoc()};
        const uint64_t revisionBefore = c.document().revision();
        CHECK(!c.redo().ok);
        CHECK(c.document().revision() == revisionBefore);
    }

    // -- (8) Redo is rejected during Play ------------------------------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.undo().ok);
        CHECK(c.playProject().ok);
        CHECK(!c.redo().ok);                             // coordinator guard
        CHECK(c.canRedo());                              // entry preserved
        CHECK(c.stopPlaying().ok);
        CHECK(c.canRedo());
    }

    // -- (10) Redo's invalidation matches the original command ----------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(SetEntityPositionCommand{kSceneA, kHero, Vec2{99.f, 20.f}}).ok);
        CHECK(c.undo().ok);
        c.consumeInvalidations();
        CHECK(c.redo().ok);
        const EditorInvalidation inv = c.consumeInvalidations();
        CHECK(has(inv, EditorInvalidation::Inspector));
        CHECK(has(inv, EditorInvalidation::Viewport));
        CHECK(has(inv, EditorInvalidation::Toolbar));
    }

    // == Unsaved-changes guard (decision matrix) ==============================
    {
        // A clean project proceeds immediately, whatever the (unused) choice.
        CHECK(resolveUnsavedGuard(false, UnsavedChoice::Cancel, false) == GuardOutcome::Proceed);
        CHECK(resolveUnsavedGuard(false, UnsavedChoice::Save, false) == GuardOutcome::Proceed);

        // Dirty: Cancel aborts; Discard proceeds.
        CHECK(resolveUnsavedGuard(true, UnsavedChoice::Cancel, false) == GuardOutcome::Abort);
        CHECK(resolveUnsavedGuard(true, UnsavedChoice::Discard, false) == GuardOutcome::Proceed);

        // Dirty + Save: proceed only when the save succeeded.
        CHECK(resolveUnsavedGuard(true, UnsavedChoice::Save, true) == GuardOutcome::Proceed);
        CHECK(resolveUnsavedGuard(true, UnsavedChoice::Save, false) == GuardOutcome::Abort);
    }

    // == LinearMover editing + persistence ====================================

    // -- Add resolves a default mover and invalidates Inspector only ----------
    {
        EditorCoordinator c{makeInheritedDoc()};
        c.consumeInvalidations();
        const EditorOperationResult r = c.execute(AddLinearMoverCommand{"Hero"});
        CHECK(r.ok);
        CHECK(r.invalidation == EditorInvalidation::Inspector);   // no edit-viewport visual
        const EntityDef& hero = c.document().data().objectTypes.at("Hero");
        CHECK(hero.linearMover.has_value());
        CHECK(hero.linearMover->speed == 300.f);                  // component default
    }

    // -- Set speed / direction, then exact undo ------------------------------
    {
        EditorCoordinator c{makeMoverDoc()};                      // Hero mover (3,0) @ 100
        CHECK(c.execute(SetLinearMoverSpeedCommand{"Hero", 250.f}).ok);
        CHECK(c.document().data().objectTypes.at("Hero").linearMover->speed == 250.f);
        CHECK(c.execute(SetLinearMoverDirectionCommand{"Hero", Vec2{0.f, 1.f}}).ok);
        const auto& m = *c.document().data().objectTypes.at("Hero").linearMover;
        CHECK(m.directionX == 0.f);
        CHECK(m.directionY == 1.f);
        CHECK(c.undo().ok);                                       // undo direction
        CHECK(c.document().data().objectTypes.at("Hero").linearMover->directionX == 3.f);
        CHECK(c.undo().ok);                                       // undo speed
        CHECK(c.document().data().objectTypes.at("Hero").linearMover->speed == 100.f);
    }

    // -- Invalid edits are rejected and mutate nothing -----------------------
    {
        EditorCoordinator c{makeMoverDoc()};
        const uint64_t revisionBefore = c.document().revision();
        CHECK(!c.execute(SetLinearMoverSpeedCommand{"Hero", -5.f}).ok);
        CHECK(!c.execute(SetLinearMoverDirectionCommand{"Hero",
            Vec2{std::numeric_limits<float>::infinity(), 0.f}}).ok);
        CHECK(c.document().revision() == revisionBefore);
        CHECK(c.document().data().objectTypes.at("Hero").linearMover->speed == 100.f);
    }

    // -- Inspector action is a no-op without a selected object type -----------
    {
        EditorCoordinator c{makeInheritedDoc()};                  // nothing selected
        CHECK(!addLinearMover(c).ok);
    }

    // -- Mover survives save/load; _paused is not persisted ------------------
    {
        EditorCoordinator c{makeMoverDoc()};
        const std::filesystem::path path = testTempDir() / "mover.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);
        EditorCoordinator reloaded{ProjectDoc{}};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const auto& m = reloaded.document().data().objectTypes.at("Hero").linearMover;
        CHECK(m.has_value());
        CHECK(m->directionX == 3.f);
        CHECK(m->speed == 100.f);
        CHECK(m->_paused == false);
    }

    // == TopDownController (authoring + runtime input) ========================

    // -- Decisive: input moves the runtime entity; authoring untouched --------
    {
        EditorCoordinator c{makeTopDownDoc(100.f)};
        const uint64_t revisionBefore = c.document().revision();
        const bool dirtyBefore = c.document().isDirty();
        const std::size_t undoBefore = c.undoSize();

        CHECK(c.playProject().ok);
        RuntimeInputSnapshot in;
        in.moveRight = true;
        c.updateRuntime(in, 0.5f);                       // 100 * 0.5 = +50

        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 60.f);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
        CHECK(c.document().revision() == revisionBefore);
        CHECK(c.document().isDirty() == dirtyBefore);
        CHECK(c.undoSize() == undoBefore);

        CHECK(c.stopPlaying().ok);
        CHECK(c.document().findInstanceInScene(kSceneA, kHero)->transform.position.x == 10.f);
    }

    // -- No controller => no movement; restart re-materializes authoring ------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.playProject().ok);
        RuntimeInputSnapshot in; in.moveRight = true;
        c.updateRuntime(in, 1.0f);
        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 10.f);
        CHECK(c.stopPlaying().ok);
    }
    {
        EditorCoordinator c{makeTopDownDoc(100.f)};
        CHECK(c.playProject().ok);
        RuntimeInputSnapshot in; in.moveRight = true;
        c.updateRuntime(in, 1.0f);                       // moved to 110
        CHECK(c.stopPlaying().ok);
        CHECK(c.playProject().ok);                       // fresh session from authoring
        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 10.f);
    }

    // -- Opposite inputs cancel; non-finite/negative dt is a no-op -----------
    {
        EditorCoordinator c{makeTopDownDoc(100.f)};
        CHECK(c.playProject().ok);
        RuntimeInputSnapshot both; both.moveLeft = true; both.moveRight = true;
        c.updateRuntime(both, 1.0f);
        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 10.f);

        RuntimeInputSnapshot right; right.moveRight = true;
        c.updateRuntime(right, -1.0f);
        c.updateRuntime(right, std::numeric_limits<float>::infinity());
        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 10.f);
    }

    // -- Diagonal is normalized: never faster than a single axis --------------
    {
        EditorCoordinator c{makeTopDownDoc(100.f)};
        CHECK(c.playProject().ok);
        RuntimeInputSnapshot diag; diag.moveRight = true; diag.moveDown = true;
        c.updateRuntime(diag, 1.0f);
        const Transform& t = c.playSession()->findEntity(kHero)->transform;
        const float dx = t.position.x - 10.f;
        const float dy = t.position.y - 20.f;
        CHECK(dx == dy);                                 // symmetric
        CHECK(dx > 0.f && dx < 100.f);                   // each axis below full speed
        CHECK(std::abs((dx * dx + dy * dy) - 10000.f) < 0.5f);   // total step ≈ speed*dt
    }

    // -- Higher speed produces a larger displacement -------------------------
    {
        EditorCoordinator slow{makeTopDownDoc(100.f)};
        EditorCoordinator fast{makeTopDownDoc(200.f)};
        CHECK(slow.playProject().ok);
        CHECK(fast.playProject().ok);
        RuntimeInputSnapshot in; in.moveRight = true;
        slow.updateRuntime(in, 0.5f);
        fast.updateRuntime(in, 0.5f);
        CHECK(slow.playSession()->findEntity(kHero)->transform.position.x == 60.f);
        CHECK(fast.playSession()->findEntity(kHero)->transform.position.x == 110.f);
    }

    // -- Two controller entities both move -----------------------------------
    {
        EditorCoordinator c{makeTopDownDoc(100.f)};
        CHECK(c.execute(CreateEntityCommand{kSceneA, 201, "Hero", "Hero2", {30.f, 0.f}}).ok);
        CHECK(c.playProject().ok);
        RuntimeInputSnapshot in; in.moveRight = true;
        c.updateRuntime(in, 1.0f);
        CHECK(c.playSession()->findEntity(kHero)->transform.position.x == 110.f);
        CHECK(c.playSession()->findEntity(201)->transform.position.x == 130.f);
    }

    // -- save/load preserves the component; Add/Remove/SetSpeed undo+redo -----
    {
        EditorCoordinator c{makeTopDownDoc(140.f)};
        const std::filesystem::path path = testTempDir() / "topdown.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);
        EditorCoordinator reloaded{ProjectDoc{}};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const auto& tdc = reloaded.document().data().objectTypes.at("Hero").topDownController;
        CHECK(tdc.has_value());
        CHECK(tdc->maxSpeed == 140.f);
    }
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddTopDownControllerCommand{"Hero"}).ok);
        CHECK(c.execute(SetTopDownControllerSpeedCommand{"Hero", 250.f}).ok);
        CHECK(c.document().data().objectTypes.at("Hero").topDownController->maxSpeed == 250.f);
        CHECK(c.undo().ok);   // undo speed
        CHECK(c.document().data().objectTypes.at("Hero").topDownController->maxSpeed == 260.f);
        CHECK(c.undo().ok);   // undo add
        CHECK(!c.document().data().objectTypes.at("Hero").topDownController.has_value());
        CHECK(c.redo().ok);   // redo add
        CHECK(c.document().data().objectTypes.at("Hero").topDownController.has_value());
        CHECK(c.redo().ok);   // redo speed
        CHECK(c.document().data().objectTypes.at("Hero").topDownController->maxSpeed == 250.f);
    }

    // -- Invalid speed rejected; Add invalidates Inspector only --------------
    {
        EditorCoordinator c{makeTopDownDoc(100.f)};
        const uint64_t revisionBefore = c.document().revision();
        CHECK(!c.execute(SetTopDownControllerSpeedCommand{"Hero", -1.f}).ok);
        CHECK(c.document().revision() == revisionBefore);
        EditorCoordinator c2{makeInheritedDoc()};
        c2.consumeInvalidations();
        const EditorOperationResult r = c2.execute(AddTopDownControllerCommand{"Hero"});
        CHECK(r.ok);
        CHECK(r.invalidation == EditorInvalidation::Inspector);
    }

    // == Image asset catalog (import target) ==================================

    // -- Add: catalog gains the asset; duplicate rejected; undo/redo ----------
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        const EditorOperationResult r =
            c.execute(AddImageAssetCommand{"img-x", "assets/images/x.png"});
        CHECK(r.ok);
        CHECK(r.invalidation == (EditorInvalidation::Assets | EditorInvalidation::Inspector));
        CHECK(c.document().hasImageAsset("img-x"));
        CHECK(c.document().findImageAsset("img-x")->sourcePath == "assets/images/x.png");

        CHECK(!c.execute(AddImageAssetCommand{"img-x", "assets/images/y.png"}).ok);  // dup
        CHECK(c.undo().ok);
        CHECK(!c.document().hasImageAsset("img-x"));
        CHECK(c.redo().ok);
        CHECK(c.document().hasImageAsset("img-x"));
    }

    // -- Remove: exact undo restores the source path; unknown id fails --------
    {
        EditorCoordinator c{makeSpriteDoc()};   // img-hero -> sprites/hero.ppm
        CHECK(c.document().hasImageAsset("img-hero"));
        CHECK(c.execute(RemoveImageAssetCommand{"img-hero"}).ok);
        CHECK(!c.document().hasImageAsset("img-hero"));
        CHECK(c.undo().ok);
        CHECK(c.document().findImageAsset("img-hero")->sourcePath == "sprites/hero.ppm");
        CHECK(!c.execute(RemoveImageAssetCommand{"nope"}).ok);
    }

    // -- save/load preserves the catalog with the relative path ---------------
    {
        EditorCoordinator c{makeDoc()};
        CHECK(c.execute(AddImageAssetCommand{"img-x", "assets/images/x.png"}).ok);
        const std::filesystem::path path = testTempDir() / "assets.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);
        EditorCoordinator reloaded{ProjectDoc{}};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const ImageAssetDef* asset = reloaded.document().findImageAsset("img-x");
        CHECK(asset != nullptr);
        CHECK(asset->sourcePath == "assets/images/x.png");
    }

    // == Audio + Font catalogs (commands + persistence) =======================
    {
        EditorCoordinator c{makeDoc()};
        c.consumeInvalidations();
        const EditorOperationResult ra =
            c.execute(AddAudioAssetCommand{"sfx", "assets/audio/sfx.wav",
                                           AudioLoadMode::StaticSound});
        CHECK(ra.ok);
        CHECK(ra.invalidation == EditorInvalidation::Assets);
        CHECK(c.document().findAudioAsset("sfx")->loadMode == AudioLoadMode::StaticSound);
        CHECK(!c.execute(AddAudioAssetCommand{"sfx", "a/b.ogg", AudioLoadMode::Stream}).ok); // dup

        const EditorOperationResult rf =
            c.execute(AddFontAssetCommand{"ui", "assets/fonts/ui.ttf", 32,
                                          FontGlyphPreset::European});
        CHECK(rf.ok);
        CHECK(c.document().findFontAsset("ui")->defaultPixelSize == 32);

        // undo/redo across both catalogs
        CHECK(c.undo().ok);  CHECK(!c.document().hasFontAsset("ui"));
        CHECK(c.redo().ok);  CHECK(c.document().hasFontAsset("ui"));

        const std::filesystem::path path = testTempDir() / "media.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);
        EditorCoordinator reloaded{ProjectDoc{}};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        CHECK(reloaded.document().findAudioAsset("sfx")->sourcePath == "assets/audio/sfx.wav");
        CHECK(reloaded.document().findAudioAsset("sfx")->loadMode == AudioLoadMode::StaticSound);
        CHECK(reloaded.document().findFontAsset("ui")->glyphPreset == FontGlyphPreset::European);
    }

    // -- import audio/font: copy, kind dir, defaults, override ----------------
    {
        const std::filesystem::path base = testTempDir();   // call once: it wipes on each call
        const std::filesystem::path root = base / "import-media";
        std::error_code ec;
        std::filesystem::create_directories(root, ec);
        const std::filesystem::path ogg = base / "theme.ogg";
        { std::ofstream f(ogg, std::ios::binary); f << "OGG"; }
        const std::filesystem::path ttf = base / "type.ttf";
        { std::ofstream f(ttf, std::ios::binary); f << "TTF"; }

        EditorCoordinator c{makeDoc()};
        const ImportAssetResult a = importAsset(c, root, {AssetKind::Audio, ogg});
        CHECK(a.ok);
        CHECK(c.document().findAudioAsset("theme")->sourcePath == "assets/audio/theme.ogg");
        CHECK(c.document().findAudioAsset("theme")->loadMode == AudioLoadMode::Stream); // ogg default
        CHECK(std::filesystem::exists(root / "assets" / "audio" / "theme.ogg"));

        const ImportAssetResult f = importAsset(c, root, {AssetKind::Font, ttf});
        CHECK(f.ok);
        CHECK(c.document().findFontAsset("type")->sourcePath == "assets/fonts/type.ttf");
        CHECK(std::filesystem::exists(root / "assets" / "fonts" / "type.ttf"));

        // explicit load-mode override wins over the extension default
        const std::filesystem::path ogg2 = base / "blip.ogg";
        { std::ofstream g(ogg2, std::ios::binary); g << "OGG"; }
        ImportAssetRequest req;
        req.kind = AssetKind::Audio;
        req.sourcePath = ogg2;
        req.audioMode = AudioLoadMode::StaticSound;
        CHECK(importAsset(c, root, req).ok);
        CHECK(c.document().findAudioAsset("blip")->loadMode == AudioLoadMode::StaticSound);

        // wrong kind/format rejected
        CHECK(!importAsset(c, root, {AssetKind::Audio, ttf}).ok);   // .ttf as audio
    }

    // == Asset import pipeline (single canonical entry point) =================
    {
        const std::filesystem::path base = testTempDir();   // call once: it wipes on each call
        const std::filesystem::path root = base / "import-basic";
        std::error_code ec;
        std::filesystem::create_directories(root, ec);
        const std::filesystem::path src = base / "src.png";
        { std::ofstream f(src, std::ios::binary); f << "PNGDATA"; }

        EditorCoordinator c{makeDoc()};
        const ImportAssetResult r = importAsset(c, root, {AssetKind::Image, src});
        CHECK(r.ok);
        CHECK(r.assetId == "src");
        CHECK(c.document().findImageAsset("src")->sourcePath == "assets/images/src.png");
        CHECK(std::filesystem::exists(root / "assets" / "images" / "src.png"));
        CHECK(c.canUndo());   // import is an authoring command

        // Re-import the same source: unique file name + AssetId, no overwrite.
        const ImportAssetResult r2 = importAsset(c, root, {AssetKind::Image, src});
        CHECK(r2.ok);
        CHECK(r2.assetId == "src_2");
        CHECK(std::filesystem::exists(root / "assets" / "images" / "src_2.png"));
    }

    // -- import rejects: unsaved project, unsupported kind/format, during Play -
    {
        const std::filesystem::path base = testTempDir();   // call once: it wipes on each call
        const std::filesystem::path root = base / "import-reject";
        std::error_code ec; std::filesystem::create_directories(root, ec);
        const std::filesystem::path src = base / "reject.png";
        { std::ofstream f(src, std::ios::binary); f << "PNGDATA"; }
        const std::filesystem::path gif = base / "x.gif";
        { std::ofstream f(gif, std::ios::binary); f << "GIF"; }

        EditorCoordinator c{makeDoc()};
        CHECK(!importAsset(c, {}, {AssetKind::Image, src}).ok);          // unsaved
        CHECK(!importAsset(c, root, {AssetKind::Audio, src}).ok);        // .png as audio
        CHECK(!importAsset(c, root, {AssetKind::Image, gif}).ok);        // bad image format
        CHECK(c.document().data().imageAssets.empty());

        CHECK(c.playProject().ok);
        CHECK(!importAsset(c, root, {AssetKind::Image, src}).ok);        // during Play
    }

    // == Viewport camera transform + picking ==================================

    // -- screenToWorld inverts the renderer camera ----------------------------
    {
        ViewportRect rect{100, 50, 800, 600};
        EditorSceneViewState view;
        view.zoom = 2.f;
        view.pan = Vec2{10.f, -20.f};
        const SceneViewCamera cam = makeSceneViewCamera(rect, view, Vec2{640.f, 480.f});
        // Viewport centre maps to the camera target (world centre + pan).
        const Vec2 centre = screenToWorld(cam, Vec2{500.f, 350.f});
        CHECK(centre.x == 330.f);   // 640/2 + 10
        CHECK(centre.y == 220.f);   // 480/2 - 20
        // Two screen pixels right of centre is 1 world unit at zoom 2.
        const Vec2 off = screenToWorld(cam, Vec2{502.f, 350.f});
        CHECK(off.x == 331.f);
    }

    // -- pickEntityAt: topmost hit; miss returns INVALID ----------------------
    {
        SceneFrameSnapshot f;
        f.hasScene = true;
        f.entities.push_back(SceneFrameEntity{7, "A", {}, SceneFrameRect{0, 0, 50, 50}, false});
        f.entities.push_back(SceneFrameEntity{8, "B", {}, SceneFrameRect{40, 40, 50, 50}, false});
        CHECK(pickEntityAt(f, Vec2{10.f, 10.f}) == 7);
        CHECK(pickEntityAt(f, Vec2{45.f, 45.f}) == 8);   // overlap -> later wins
        CHECK(pickEntityAt(f, Vec2{200.f, 200.f}) == INVALID_ENTITY);
    }

    // -- pickEntityAt: a visible sprite occludes a placeholder ----------------
    {
        SceneFrameSnapshot f;
        f.hasScene = true;
        f.entities.push_back(SceneFrameEntity{1, "P", {}, SceneFrameRect{0, 0, 50, 50}, false});
        f.sprites.push_back(SceneFrameSprite{2, "img", SceneFrameRect{10, 10, 50, 50}, {}, true, false});
        f.sprites.push_back(SceneFrameSprite{3, "img", SceneFrameRect{10, 10, 50, 50}, {}, false, false});
        CHECK(pickEntityAt(f, Vec2{20.f, 20.f}) == 2);   // sprite over placeholder
        CHECK(pickEntityAt(f, Vec2{5.f, 5.f}) == 1);     // invisible sprite ignored
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
              == (EditorInvalidation::Inspector | EditorInvalidation::Viewport
                  | EditorInvalidation::Toolbar));
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
        CHECK(de.value.data().imageAssets[0].sourcePath == "sprites/hero.ppm");
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
        CHECK(reloaded.document().data().imageAssets[0].sourcePath == "sprites/hero.ppm");
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
        const SceneFrameSnapshot frame =
            collectSceneFrameSnapshot(c.document(), kSceneA, kHero);
        CHECK(frame.hasScene);
        CHECK(frame.sprites.size() == 1);
        CHECK(frame.sprites[0].entityId == kHero);
        CHECK(frame.sprites[0].assetId == "img-hero");
        CHECK(frame.sprites[0].visible);
        CHECK(frame.sprites[0].selected);
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
        const SceneFrameSnapshot frame =
            collectSceneFrameSnapshot(c.document(), kSceneA, INVALID_ENTITY);
        CHECK(frame.sprites.size() == 1);
        CHECK(frame.sprites[0].assetId == "img-alt");
    }

    // -- Snapshot keeps invisible sprites non-drawable without consulting UI ---
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        CHECK(c.execute(SetSpriteRendererVisibleCommand{kSceneA, kHero, false}).ok);
        const SceneFrameSnapshot frame =
            collectSceneFrameSnapshot(c.document(), kSceneA, INVALID_ENTITY);
        CHECK(frame.sprites.size() == 1);
        CHECK(frame.sprites[0].assetId == "img-alt");
        CHECK(!frame.sprites[0].visible);
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

    // == Object type persistence (the gate before more inherited components) ===

    // -- (1) A base component on the object type survives reload --------------
    {
        EditorCoordinator c{makeInheritedDoc()};   // object type "Hero" sprite=img-hero
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "ot-base.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        CHECK(reloaded.document().data().objectTypes.count("Hero") == 1);
        const SpriteRenderView v = resolveSpriteRenderer(reloaded.document(), kSceneA, kHero);
        CHECK(v.present);
        CHECK(v.origin == ComponentOrigin::EntityDefinition);  // inherited, restored
        CHECK(v.assetId == "img-hero");
    }

    // -- (2) An override still prevails after reload --------------------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "ot-override.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const SpriteRenderView v = resolveSpriteRenderer(reloaded.document(), kSceneA, kHero);
        CHECK(v.origin == ComponentOrigin::InstanceOverride);
        CHECK(v.assetId == "img-alt");
    }

    // -- (3) Removing the override falls back to the base even after reload ----
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddSpriteRendererCommand{kSceneA, kHero}).ok);
        CHECK(c.execute(SetSpriteRendererAssetCommand{kSceneA, kHero, "img-alt"}).ok);
        CHECK(c.execute(RemoveSpriteRendererCommand{kSceneA, kHero}).ok);
        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "ot-removed.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const SceneInstanceDef* inst = reloaded.document().findInstanceInScene(kSceneA, kHero);
        CHECK(!inst->spriteRenderer.has_value());                       // no override persisted
        const SpriteRenderView v = resolveSpriteRenderer(reloaded.document(), kSceneA, kHero);
        CHECK(v.origin == ComponentOrigin::EntityDefinition);          // back to base
        CHECK(v.assetId == "img-hero");
    }

    // -- (4) An instance with a dangling objectTypeId is rejected -------------
    {
        ProjectDoc doc = makeInheritedDoc();          // has the "Hero" catalog
        SceneInstanceDef ghost;
        ghost.id = 999;
        ghost.objectTypeId = "Ghost";                 // not in the catalog
        ghost.instanceName = "Ghost";
        doc.scenes.at(kSceneA).instances.push_back(ghost);
        CHECK(!ProjectValidator::validate(ProjectDocument{doc}).ok);
    }

    // -- (5) Duplicate object type ids are rejected on deserialize ------------
    {
        const std::string dup =
            R"({"scenes":[],"objectTypes":[{"id":"A"},{"id":"A"}]})";
        CHECK(!ProjectSerializer::deserialize(dup).ok);
    }

    // -- (6) The serializer does not copy the base component into instances ----
    {
        EditorCoordinator c{makeInheritedDoc()};      // kHero inherits, has no override
        const auto ser = ProjectSerializer::serialize(c.document());
        CHECK(ser.ok);
        // The instance has no override, so no per-instance spriteRenderer block.
        CHECK(ser.value.find("spriteRenderer") == std::string::npos);
        const auto de = ProjectSerializer::deserialize(ser.value);
        CHECK(de.ok);
        CHECK(!de.value.findInstanceInScene(kSceneA, kHero)->spriteRenderer.has_value());
    }

    // -- A catalog-less minimal project still validates (objectTypeId is a label)
    {
        // makeDoc has instances referencing "Hero" but defines no object types.
        CHECK(ProjectValidator::validate(ProjectDocument{makeDoc()}).ok);
    }

    // == BoxCollider2D component: object type only ============================

    // -- (1) Add targets objectTypeId, not scene/entity -----------------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        const uint32_t replacesBefore = c.document().replaceCount();
        const auto r = c.execute(AddBoxColliderCommand{"Hero"});
        CHECK(r.ok);
        CHECK(r.change.kind == DomainChangeKind::ComponentAdded);
        CHECK(r.change.componentKind == ComponentKind::BoxCollider2D);
        CHECK(r.change.objectTypeId == "Hero");
        CHECK(r.change.entityId == INVALID_ENTITY);
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D.has_value());
        CHECK(!c.document().findInstanceInScene(kSceneA, kHero)->spriteRenderer.has_value());
        CHECK(c.document().replaceCount() == replacesBefore);
        CHECK(c.undoSize() == 1);

        const uint64_t revBeforeDuplicate = c.document().revision();
        const std::size_t undoBeforeDuplicate = c.undoSize();
        c.consumeInvalidations();
        CHECK(c.execute(AddBoxColliderCommand{"Hero"}).ok);
        CHECK(c.document().revision() == revBeforeDuplicate);
        CHECK(c.undoSize() == undoBeforeDuplicate);
        CHECK(c.consumeInvalidations() == EditorInvalidation::None);
    }

    // -- (2) Setters validate finite/positive values and invalidate narrowly --
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddBoxColliderCommand{"Hero"}).ok);
        c.consumeInvalidations();

        CHECK(c.execute(SetBoxColliderOffsetCommand{"Hero", Vec2{4.f, -6.f}}).ok);
        CHECK(c.consumeInvalidations()
              == (EditorInvalidation::Inspector | EditorInvalidation::Viewport
                  | EditorInvalidation::Toolbar));
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D->offset.x == 4.f);
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D->offset.y == -6.f);

        const uint64_t revBeforeBadSize = c.document().revision();
        CHECK(!c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{0.f, 10.f}}).ok);
        CHECK(c.document().revision() == revBeforeBadSize);
        CHECK(!c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{-1.f, 10.f}}).ok);
        CHECK(!c.execute(SetBoxColliderSizeCommand{
            "Hero", Vec2{std::numeric_limits<float>::quiet_NaN(), 10.f}}).ok);
        CHECK(!c.execute(SetBoxColliderSizeCommand{
            "Hero", Vec2{std::numeric_limits<float>::infinity(), 10.f}}).ok);
        CHECK(!c.execute(SetBoxColliderOffsetCommand{
            "Hero", Vec2{std::numeric_limits<float>::quiet_NaN(), 0.f}}).ok);
        CHECK(c.document().revision() == revBeforeBadSize);
        CHECK(c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{64.f, 24.f}}).ok);
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D->size.x == 64.f);
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D->size.y == 24.f);
    }

    // -- (3) No-op setters do not mutate or enter undo ------------------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddBoxColliderCommand{"Hero"}).ok);
        const uint64_t rev = c.document().revision();
        const std::size_t undo = c.undoSize();
        CHECK(c.execute(SetBoxColliderEnabledCommand{"Hero", true}).ok);
        CHECK(c.document().revision() == rev);
        CHECK(c.undoSize() == undo);
        CHECK(c.execute(SetBoxColliderOffsetCommand{"Hero", Vec2{0.f, 0.f}}).ok);
        CHECK(c.document().revision() == rev);
        CHECK(c.undoSize() == undo);
        CHECK(c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{32.f, 32.f}}).ok);
        CHECK(c.document().revision() == rev);
        CHECK(c.undoSize() == undo);
    }

    // -- (4) Undo restores exact object-type component state ------------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddBoxColliderCommand{"Hero"}).ok);
        CHECK(c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{80.f, 30.f}}).ok);
        CHECK(c.execute(SetBoxColliderTriggerCommand{"Hero", true}).ok);
        CHECK(c.execute(RemoveBoxColliderCommand{"Hero"}).ok);
        CHECK(!c.document().data().objectTypes.at("Hero").boxCollider2D.has_value());
        c.undo();
        const BoxCollider2DComponent& collider =
            *c.document().data().objectTypes.at("Hero").boxCollider2D;
        CHECK(collider.size.x == 80.f);
        CHECK(collider.size.y == 30.f);
        CHECK(collider.isTrigger);
    }

    // -- (5) Inspector action resolves selection -> objectTypeId --------------
    {
        EditorCoordinator c{makeInheritedDoc()};
        c.apply(SelectEntityIntent{kHero});
        const std::size_t undoBefore = c.undoSize();
        CHECK(addBoxCollider(c).ok);
        CHECK(c.undoSize() == undoBefore + 1);
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D.has_value());

        EditorCoordinator empty{makeInheritedDoc()};
        CHECK(!addBoxCollider(empty).ok);
        CHECK(empty.undoSize() == 0);
    }

    // -- (6) Bounds projection updates every instance of the same object type -
    {
        ProjectDoc doc = makeInheritedDoc();
        SceneInstanceDef second;
        second.id = 314;
        second.objectTypeId = "Hero";
        second.instanceName = "Hero 2";
        second.transform.position = {100.f, 200.f};
        doc.scenes.at(kSceneA).instances.push_back(second);

        EditorCoordinator c{doc};
        CHECK(c.execute(AddBoxColliderCommand{"Hero"}).ok);
        CHECK(c.execute(SetBoxColliderOffsetCommand{"Hero", Vec2{2.f, 3.f}}).ok);
        CHECK(c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{10.f, 20.f}}).ok);

        c.execute(CreateEntityCommand{kSceneA, 777, "Enemy", "Enemy", {300.f, 400.f}});

        const std::vector<SceneFrameCollider> bounds =
            collectBoxColliderBounds(c.document(), kSceneA, kHero);
        CHECK(bounds.size() == 2);
        CHECK(bounds[0].worldBounds.width == 10.f);
        CHECK(bounds[0].worldBounds.height == 20.f);
        CHECK(bounds[0].worldBounds.x == 7.f);
        CHECK(bounds[0].worldBounds.y == 13.f);
        CHECK(bounds[0].selected);
        CHECK(bounds[0].enabled);
        CHECK(bounds[1].worldBounds.x == 97.f);
        CHECK(bounds[1].worldBounds.y == 193.f);
        CHECK(!bounds[1].selected);

        CHECK(c.execute(SetBoxColliderTriggerCommand{"Hero", true}).ok);
        const std::vector<SceneFrameCollider> triggerBounds =
            collectBoxColliderBounds(c.document(), kSceneA, INVALID_ENTITY);
        CHECK(triggerBounds.size() == 2);
        CHECK(triggerBounds[0].isTrigger);

        CHECK(c.execute(SetBoxColliderEnabledCommand{"Hero", false}).ok);
        CHECK(collectBoxColliderBounds(c.document(), kSceneA, INVALID_ENTITY).empty());
        CHECK(c.document().data().objectTypes.at("Hero").boxCollider2D.has_value());
        c.undo();
        CHECK(collectBoxColliderBounds(c.document(), kSceneA, INVALID_ENTITY).size() == 2);
    }

    // -- (7) Save/reload persists object-type collider, never per instance ----
    {
        EditorCoordinator c{makeInheritedDoc()};
        CHECK(c.execute(AddBoxColliderCommand{"Hero"}).ok);
        CHECK(c.execute(SetBoxColliderOffsetCommand{"Hero", Vec2{5.f, 6.f}}).ok);
        CHECK(c.execute(SetBoxColliderSizeCommand{"Hero", Vec2{70.f, 32.f}}).ok);
        CHECK(c.execute(SetBoxColliderEnabledCommand{"Hero", false}).ok);
        CHECK(c.execute(SetBoxColliderTriggerCommand{"Hero", true}).ok);

        const auto ser = ProjectSerializer::serialize(c.document());
        CHECK(ser.ok);
        CHECK(ser.value.find("boxCollider2D") != std::string::npos);
        CHECK(ser.value.find("spriteRenderer") == std::string::npos);
        const std::size_t instancePos = ser.value.find("\"instances\"");
        const std::size_t colliderPos = ser.value.find("boxCollider2D");
        CHECK(colliderPos < instancePos);

        const std::filesystem::path dir = testTempDir();
        const std::filesystem::path path = dir / "box-collider.artcade-project";
        CHECK(saveProjectToFile(c, path).ok);

        EditorCoordinator reloaded{makeReplacementDoc()};
        CHECK(loadProjectFromFile(reloaded, path).ok);
        const auto& type = reloaded.document().data().objectTypes.at("Hero");
        CHECK(type.boxCollider2D.has_value());
        CHECK(type.boxCollider2D->offset.x == 5.f);
        CHECK(type.boxCollider2D->offset.y == 6.f);
        CHECK(type.boxCollider2D->size.x == 70.f);
        CHECK(type.boxCollider2D->size.y == 32.f);
        CHECK(!type.boxCollider2D->enabled);
        CHECK(type.boxCollider2D->isTrigger);
    }

    // -- (8) Invalid persisted collider is rejected during validation ---------
    {
        const std::string bad =
            R"({"activeSceneId":"s","scenes":[{"id":"s","instances":[{"id":1,"objectTypeId":"Hero","instanceName":"Hero"}]}],"objectTypes":[{"id":"Hero","boxCollider2D":{"size":{"x":-1,"y":10}}}]})";
        const auto loaded = ProjectSerializer::deserialize(bad);
        CHECK(loaded.ok);
        CHECK(!ProjectValidator::validate(std::move(loaded.value)).ok);
    }

    std::cout << "editor-core-test: " << g_passed << " passed, "
              << g_failed << " failed\n";
    return g_failed == 0 ? 0 : 1;
}

// artcade_editor_core_roundtrip_test — single authority load/command/undo/save/reload

#include "artcade/editor_core/editor_core.h"
#include "logic_board_names.h"

#include "logic-core.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <limits>
#include <string>
#include <variant>

#ifndef ARTCADE_QT_SLICE_FIXTURE_DIR
#error ARTCADE_QT_SLICE_FIXTURE_DIR must be defined
#endif

static void expect(bool ok, const char *msg)
{
    if (!ok) {
        std::fprintf(stderr, "FAIL: %s\n", msg);
        std::exit(1);
    }
    std::printf("  [ok] %s\n", msg);
}

static const ArtCade::SceneDef *active_scene(const ArtCade::ProjectDoc &doc)
{
    const auto scene = doc.scenes.find(doc.activeSceneId);
    return scene == doc.scenes.end() ? nullptr : &scene->second;
}

static std::string read_text_file(const std::filesystem::path &path)
{
    std::ifstream file(path);
    return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}

static void write_text_file(const std::filesystem::path &path, const std::string &content)
{
    std::ofstream file(path);
    file << content;
}

int main()
{
    using namespace ArtCade::EditorCore;
    namespace fs = std::filesystem;

    const fs::path fixture_dir = ARTCADE_QT_SLICE_FIXTURE_DIR;
    const fs::path fixture = fixture_dir / "project.json";
    const fs::path out_path = fixture_dir / "project.roundtrip.json";

    EditorCoordinator coord;
    std::string error;

    expect(coord.openProject(fixture.string(), error), "open fixture");
    expect(!coord.isDirty(), "fresh open is clean");
    expect(coord.document().formatVersion == kCurrentProjectFormatVersion,
           "current format version");

    const fs::path invalid_format_path = fixture_dir / "project.invalid-format.json";
    std::string invalid_format = read_text_file(fixture);
    const std::size_t format_key = invalid_format.find("\"formatVersion\": 7");
    expect(format_key != std::string::npos, "fixture has canonical formatVersion key");
    invalid_format.replace(format_key, std::string("\"formatVersion\": 7").size(),
                           "\"projectFormatVersion\": 7");
    write_text_file(invalid_format_path, invalid_format);
    ArtCade::ProjectDoc invalid_document;
    expect(!project_file_io_load(invalid_format_path.string(), invalid_document, error),
           "obsolete format alias is rejected");
    std::error_code remove_error;
    fs::remove(invalid_format_path, remove_error);

    const fs::path invalid_variables_path = fixture_dir / "project.invalid-variables.json";
    std::string invalid_variables = read_text_file(fixture);
    const std::size_t variables_key = invalid_variables.find("\"globalVariables\": []");
    expect(variables_key != std::string::npos, "fixture has globalVariables");
    invalid_variables.replace(variables_key, std::string("\"globalVariables\": []").size(),
                              "\"globalVariables\": [{\"key\":\"score\",\"type\":\"number\",\"initialValue\":true}]");
    write_text_file(invalid_variables_path, invalid_variables);
    expect(!project_file_io_load(invalid_variables_path.string(), invalid_document, error),
           "invalid global variable is rejected");
    fs::remove(invalid_variables_path, remove_error);

    const fs::path unknown_variable_field_path = fixture_dir / "project.unknown-variable-field.json";
    std::string unknown_variable_field = read_text_file(fixture);
    unknown_variable_field.replace(
        variables_key, std::string("\"globalVariables\": []").size(),
        "\"globalVariables\": [{\"key\":\"score\",\"type\":\"number\","
        "\"initialValue\":0,\"obsoleteDefault\":0}]");
    write_text_file(unknown_variable_field_path, unknown_variable_field);
    expect(!project_file_io_load(unknown_variable_field_path.string(), invalid_document, error),
           "unknown global variable field is rejected");
    fs::remove(unknown_variable_field_path, remove_error);

    const ArtCade::SceneInstanceDef *hero =
        project_doc_find_instance(coord.document(), 1);
    expect(hero != nullptr, "find Hero id=1");
    expect(hero->instanceName == "Hero", "initial name Hero");
    expect(hero->transform.position.x == 10.f && hero->transform.position.y == 20.f,
           "initial position");

    coord.selectEntity(1);
    expect(coord.renameSelected("HeroRenamed", error), "rename");
    expect(coord.isDirty(), "rename dirties");
    expect(project_doc_find_instance(coord.document(), 1)->instanceName == "HeroRenamed",
           "name after rename");

    coord.undo();
    expect(project_doc_find_instance(coord.document(), 1)->instanceName == "Hero",
           "undo rename");
    coord.redo();
    expect(project_doc_find_instance(coord.document(), 1)->instanceName == "HeroRenamed",
           "redo rename");

    expect(coord.setSelectedPosition(33.f, 44.f, error), "set position");
    expect(project_doc_find_instance(coord.document(), 1)->transform.position.x == 33.f,
           "x after set");
    expect(project_doc_find_instance(coord.document(), 1)->transform.position.y == 44.f,
           "y after set");
    coord.undo();
    expect(project_doc_find_instance(coord.document(), 1)->transform.position.x == 10.f,
           "undo position x");

    // Transform: scale + rotation (SceneId + EntityId commands)
    constexpr float kPi = 3.14159265358979323846f;
    coord.selectEntity(1);
    const std::uint64_t rev_before_scale = coord.revision();
    expect(coord.setSelectedScale(2.f, 3.f, error), "set scale");
    expect(coord.revision() == rev_before_scale + 1, "scale bumps revision once");
    expect(coord.isDirty(), "scale dirties");
    expect(nearly_equal(project_doc_find_instance(coord.document(), 1)->transform.scale,
                        ArtCade::Vec2{2.f, 3.f}),
           "scale updated");
    coord.undo();
    expect(nearly_equal(project_doc_find_instance(coord.document(), 1)->transform.scale,
                        ArtCade::Vec2{1.f, 1.f}),
           "undo scale");
    coord.redo();
    expect(nearly_equal(project_doc_find_instance(coord.document(), 1)->transform.scale,
                        ArtCade::Vec2{2.f, 3.f}),
           "redo scale");

    const std::uint64_t rev_before_scale_noop = coord.revision();
    expect(coord.setSelectedScale(2.f, 3.f, error), "no-op scale succeeds");
    expect(coord.revision() == rev_before_scale_noop, "no-op scale does not bump revision");

    expect(!coord.setSelectedScale(0.f, 1.f, error), "scale zero rejected");
    expect(!coord.setSelectedScale(-1.f, 1.f, error), "scale negative rejected");
    expect(!coord.setSelectedScale(std::numeric_limits<float>::quiet_NaN(), 1.f, error),
           "scale NaN rejected");
    expect(!coord.setSelectedScale(1.f, std::numeric_limits<float>::infinity(), error),
           "scale Inf rejected");

    const std::uint64_t rev_before_rot = coord.revision();
    expect(coord.setSelectedRotation(kPi * 0.5f, error), "set rotation 90deg");
    expect(coord.revision() == rev_before_rot + 1, "rotation bumps revision once");
    expect(nearly_equal(project_doc_find_instance(coord.document(), 1)->transform.rotation,
                        kPi * 0.5f),
           "rotation ~ pi/2");
    coord.undo();
    expect(nearly_equal(project_doc_find_instance(coord.document(), 1)->transform.rotation, 0.f),
           "undo rotation");
    coord.redo();
    expect(nearly_equal(project_doc_find_instance(coord.document(), 1)->transform.rotation,
                        kPi * 0.5f),
           "redo rotation");

    const std::uint64_t rev_before_rot_noop = coord.revision();
    expect(coord.setSelectedRotation(kPi * 0.5f, error), "no-op rotation succeeds");
    expect(coord.revision() == rev_before_rot_noop, "no-op rotation does not bump revision");
    expect(!coord.setSelectedRotation(std::numeric_limits<float>::quiet_NaN(), error),
           "rotation NaN rejected");
    expect(!coord.setSelectedRotation(std::numeric_limits<float>::infinity(), error),
           "rotation Inf rejected");

    coord.clearSelection();
    expect(!coord.setSelectedScale(1.5f, 1.5f, error), "scale without selection fails");
    expect(!coord.setSelectedRotation(0.f, error), "rotation without selection fails");
    expect(!coord.setEntityScale("missing_scene", 1, 1.f, 1.f, error),
           "scale bad scene rejected");
    expect(!coord.setEntityRotation("scene_main", 9999, 0.f, error),
           "rotation missing entity rejected");

    // Leave a deterministic dirty state for save
    coord.selectEntity(1);
    expect(coord.renameEntity(1, "HeroSaved", error), "final rename");
    expect(coord.setEntityPosition(1, 55.f, 66.f, error), "final position");
    expect(coord.setEntityScale("scene_main", 1, 2.f, 3.f, error), "final scale");
    expect(coord.setEntityRotation("scene_main", 1, kPi * 0.5f, error), "final rotation");

    const std::uint64_t rev_before_select = coord.revision();
    coord.selectEntity(2);
    expect(coord.revision() == rev_before_select, "selection does not bump revision");

    const ArtCade::SceneDef *scene = active_scene(coord.document());
    expect(scene != nullptr && scene->layers.size() == 3, "fixture has 3 scene layers");
    expect(scene->defaultLayerId == "layer_main", "fixture defaultLayerId");
    expect(coord.document().imageAssets.size() == 2, "fixture has 2 image assets");
    expect(coord.activeLayerId() == "layer_main", "default active layer is defaultLayerId");
    expect(coord.layerVisible("layer_ui"), "ui layer play-visible initially");
    expect(!coord.layerHiddenInEditor("layer_ui"), "ui layer not editor-hidden");

    const std::uint64_t rev_before_active = coord.revision();
    coord.setActiveLayerId("layer_main");
    expect(coord.activeLayerId() == "layer_main", "active layer workspace change");
    expect(coord.revision() == rev_before_active, "active layer does not bump revision");

    // Eye toggle: workspace-only (no dirty / no undo / no ProjectDoc write)
    const std::uint64_t rev_before_hide = coord.revision();
    const bool dirty_before_hide = coord.isDirty();
    coord.setLayerHiddenInEditor("layer_ui", true);
    expect(coord.layerHiddenInEditor("layer_ui"), "ui layer editor-hidden");
    expect(coord.layerVisible("layer_ui"), "play visibility unchanged by eye");
    expect(coord.revision() == rev_before_hide, "editor hide does not bump revision");
    expect(coord.isDirty() == dirty_before_hide, "editor hide does not dirty");
    coord.setLayerHiddenInEditor("layer_ui", false);
    expect(!coord.layerHiddenInEditor("layer_ui"), "ui layer shown in editor again");

    // Workspace visibility is keyed by SceneId + layerId, not a global layer id.
    ArtCade::SceneDef second_scene = coord.document().scenes.at("scene_main");
    second_scene.id = "scene_second";
    second_scene.name = "Second Scene";
    coord.document().scenes.emplace(second_scene.id, second_scene);
    coord.setLayerHiddenInEditor("layer_ui", true);
    coord.document().activeSceneId = "scene_second";
    expect(!coord.layerHiddenInEditor("layer_ui"),
           "same layer id stays visible in another scene");
    coord.setLayerHiddenInEditor("layer_ui", true);
    coord.document().activeSceneId = "scene_main";
    expect(coord.layerHiddenInEditor("layer_ui"),
           "original scene retains its workspace visibility");
    coord.document().activeSceneId = "scene_second";
    expect(coord.layerHiddenInEditor("layer_ui"),
           "second scene owns separate workspace visibility");
    coord.document().activeSceneId = "scene_main";
    coord.document().scenes.erase("scene_second");
    coord.setLayerHiddenInEditor("layer_ui", false);

    // Lock: persistent SceneLayerDef.locked
    expect(coord.setLayerLocked("layer_ui", true, error), "lock ui layer");
    expect(coord.layerLocked("layer_ui"), "ui layer locked");
    expect(coord.isDirty(), "layer lock dirties");
    coord.undo();
    expect(!coord.layerLocked("layer_ui"), "undo layer lock");

    // Play/export visibility remains a ProjectDoc command (not the eye)
    expect(coord.setLayerVisible("layer_ui", false, error), "hide ui layer in play");
    expect(!coord.layerVisible("layer_ui"), "ui layer play-hidden");
    expect(coord.isDirty(), "play visibility dirties");
    coord.undo();
    expect(coord.layerVisible("layer_ui"), "undo play visibility");

    // Per-scene layer authoring (Add / Rename / Set Default)
    std::string added_layer_id;
    expect(coord.addSceneLayer(added_layer_id, error), "add scene layer");
    expect(!added_layer_id.empty(), "new layer id assigned");
    expect(coord.activeLayerId() == added_layer_id, "new layer becomes active");
    expect(coord.activeScene()->layers.size() == 4, "scene has 4 layers after add");
    expect(ArtCade::EditorCore::EditorCoordinator::sceneContainsLayer(*coord.activeScene(),
                                                                      added_layer_id),
           "new layer in active scene");
    expect(!coord.renameSceneLayer(added_layer_id, "  ", error), "empty rename rejected");
    expect(coord.renameSceneLayer(added_layer_id, "Gameplay", error), "rename new layer");
    expect(coord.activeScene()->layers.size() == 4, "rename keeps count");
    {
        const ArtCade::SceneLayerDef *renamed =
            ArtCade::EditorCore::EditorCoordinator::findSceneLayer(*coord.activeScene(),
                                                                  added_layer_id);
        expect(renamed && renamed->name == "Gameplay", "rename applied");
    }
    expect(!coord.renameSceneLayer(added_layer_id, "main", error),
           "case-insensitive duplicate rename rejected");
    expect(coord.setDefaultSceneLayer(added_layer_id, error), "set default to new layer");
    expect(coord.activeScene()->defaultLayerId == added_layer_id, "defaultLayerId updated");
    coord.undo(); // undo set default
    expect(coord.activeScene()->defaultLayerId == "layer_main", "undo default layer");
    coord.undo(); // undo rename
    coord.undo(); // undo add
    expect(coord.activeScene()->layers.size() == 3, "undo add restores layer count");

    // Reorder: Move Forward / to Front / Undo
    {
        const std::string first_id = coord.activeScene()->layers.front().id;
        const std::string last_id = coord.activeScene()->layers.back().id;
        expect(coord.moveSceneLayer(first_id, 2, error), "move background to front");
        expect(coord.activeScene()->layers.back().id == first_id,
               "moved layer is now foreground");
        expect(coord.moveSceneLayer(first_id, 0, error), "move back to background");
        expect(coord.activeScene()->layers.front().id == first_id,
               "restored background order");
        expect(coord.moveSceneLayer(last_id, 0, error), "move UI to back");
        expect(coord.activeScene()->layers.front().id == last_id, "UI is background");
        coord.undo();
        expect(coord.activeScene()->layers.back().id == last_id, "undo restores UI to front");
        expect(coord.moveSceneLayer(last_id, 2, error), "no-op same index");
    }

    // Assign instance to a different scene layer (SetEntityLayer)
    {
        expect(coord.setEntityLayer(1, "layer_ui", error), "move Hero to UI layer");
        const ArtCade::SceneInstanceDef *hero =
            ArtCade::EditorCore::project_doc_find_instance(coord.document(), 1);
        expect(hero && hero->layerId == "layer_ui", "Hero layerId is UI");
        expect(coord.setEntityLayer(1, "layer_ui", error), "no-op same layer");
        expect(!coord.setEntityLayer(1, "missing_layer", error), "unknown layer rejected");
        expect(!coord.setEntityLayer(0, "layer_main", error), "entity 0 rejected");
        coord.undo();
        hero = ArtCade::EditorCore::project_doc_find_instance(coord.document(), 1);
        expect(hero && hero->layerId == "layer_main", "undo restores Hero layer");
        coord.redo();
        hero = ArtCade::EditorCore::project_doc_find_instance(coord.document(), 1);
        expect(hero && hero->layerId == "layer_ui", "redo restores UI layer");
        expect(coord.setEntityLayer(1, "layer_main", error), "restore Hero to Main");
    }

    // Delete layer with instance transfer + undo
    {
        expect(coord.setEntityLayer(2, "layer_ui", error), "move Coin to UI for delete test");
        expect(coord.countInstancesOnLayer("layer_ui") == 1, "one instance on UI");
        expect(!coord.removeSceneLayer("layer_main", "layer_ui", error),
               "cannot delete default layer");
        expect(coord.removeSceneLayer("layer_ui", "layer_main", error),
               "delete UI transferring to Main");
        expect(coord.activeScene()->layers.size() == 2, "two layers after delete");
        expect(!ArtCade::EditorCore::EditorCoordinator::sceneContainsLayer(
                   *coord.activeScene(), "layer_ui"),
               "UI layer gone");
        const ArtCade::SceneInstanceDef *coin =
            ArtCade::EditorCore::project_doc_find_instance(coord.document(), 2);
        expect(coin && coin->layerId == "layer_main", "Coin transferred to Main");
        coord.undo();
        expect(coord.activeScene()->layers.size() == 3, "undo restores layer count");
        expect(ArtCade::EditorCore::EditorCoordinator::sceneContainsLayer(
                   *coord.activeScene(), "layer_ui"),
               "UI layer restored");
        coin = ArtCade::EditorCore::project_doc_find_instance(coord.document(), 2);
        expect(coin && coin->layerId == "layer_ui", "Coin membership restored");
        expect(coord.setEntityLayer(2, "layer_main", error), "restore Coin to Main");
    }

    // Duplicate layer + instances
    {
        expect(coord.setEntityLayer(2, "layer_ui", error), "Coin on UI before duplicate");
        std::string dup_id;
        expect(coord.duplicateSceneLayer("layer_ui", dup_id, error), "duplicate UI layer");
        expect(!dup_id.empty() && dup_id != "layer_ui", "new layer id assigned");
        expect(coord.activeLayerId() == dup_id, "duplicate becomes active");
        expect(coord.activeScene()->layers.size() == 4, "four layers after duplicate");
        const ArtCade::SceneLayerDef *dup =
            ArtCade::EditorCore::EditorCoordinator::findSceneLayer(*coord.activeScene(),
                                                                  dup_id);
        expect(dup && dup->name == "UI Copy", "duplicate name is UI Copy");
        const std::size_t ui_index =
            ArtCade::EditorCore::EditorCoordinator::sceneLayerIndex(*coord.activeScene(),
                                                                   "layer_ui");
        const std::size_t dup_index =
            ArtCade::EditorCore::EditorCoordinator::sceneLayerIndex(*coord.activeScene(),
                                                                   dup_id);
        expect(dup_index == ui_index + 1, "copy inserted toward foreground of source");
        expect(coord.countInstancesOnLayer(dup_id) == 1, "instance duplicated onto copy");
        expect(coord.countInstancesOnLayer("layer_ui") == 1, "source instance kept");
        ArtCade::EntityId coin_copy_id = 0;
        for (const ArtCade::SceneInstanceDef &inst : coord.activeScene()->instances) {
            if (inst.layerId == dup_id) {
                coin_copy_id = inst.id;
                expect(inst.id != 2, "duplicated instance has new EntityId");
                expect(inst.instanceName == "Coin_A Copy", "duplicated instance name");
                expect(inst.objectTypeId == "Coin", "same object type ref");
            }
        }
        expect(coin_copy_id != 0, "found duplicated Coin");
        coord.undo();
        expect(coord.activeScene()->layers.size() == 3, "undo removes duplicated layer");
        expect(!ArtCade::EditorCore::EditorCoordinator::sceneContainsLayer(
                   *coord.activeScene(), dup_id),
               "duplicate layer gone after undo");
        expect(coord.countInstancesOnLayer("layer_ui") == 1, "source Coin remains");
        expect(coord.setEntityLayer(2, "layer_main", error), "restore Coin after duplicate test");
    }

    expect(coord.setLayerVisible("layer_ui", false, error), "hide ui again for save");
    expect(coord.setLayerLocked("layer_bg", true, error), "lock bg for save");

    expect(coord.pickEntityAt(60.f, 70.f) == 1, "pick Hero inside placeholder");
    expect(coord.pickEntityAt(0.f, 0.f) == 0, "pick empty world misses");
    expect(coord.pickEntityAt(110.f, 55.f) == 2, "pick Coin_A");

    const std::uint64_t revision_before_variable = coord.revision();
    expect(coord.addGameVariable("score", "number", error), "add Number variable");
    expect(coord.revision() == revision_before_variable + 1,
           "add variable bumps revision once");
    expect(coord.document().globalVariables.size() == 1, "one global variable");
    expect(coord.setGameVariableInitialNumber("score", 42.0, error),
           "set Number initial value");
    expect(std::get<double>(coord.document().globalVariables.front().initialValue) == 42.0,
           "Number initial value updated");
    coord.undo();
    expect(std::get<double>(coord.document().globalVariables.front().initialValue) == 0.0,
           "undo restores Number initial value");
    coord.redo();
    expect(std::get<double>(coord.document().globalVariables.front().initialValue) == 42.0,
           "redo restores Number initial value");
    const std::uint64_t revision_before_variable_noop = coord.revision();
    expect(coord.setGameVariableInitialNumber("score", 42.0, error),
           "same Number initial value is a no-op");
    expect(coord.setGameVariableType("score", "number", error),
           "same variable type is a no-op");
    expect(coord.revision() == revision_before_variable_noop,
           "variable no-ops do not bump revision");
    expect(coord.addGameVariable("temporary", "boolean", error), "add temporary Boolean variable");
    expect(coord.setGameVariableType("temporary", "string", error),
           "change unreferenced variable type");
    expect(coord.document().globalVariables.back().type == ArtCade::GameVariableDefinition::Type::String,
           "variable type changed");
    coord.undo();
    expect(coord.document().globalVariables.back().type == ArtCade::GameVariableDefinition::Type::Boolean,
           "undo restores variable type");
    coord.redo();
    expect(coord.document().globalVariables.back().type == ArtCade::GameVariableDefinition::Type::String,
           "redo restores variable type change");
    expect(coord.removeGameVariable("temporary", error), "remove unreferenced variable");
    coord.undo();
    expect(coord.document().globalVariables.size() == 2, "undo restores removed variable");
    coord.redo();
    expect(coord.document().globalVariables.size() == 1, "redo removes variable again");

    ArtCade::LogicRuleId rule_id;
    expect(coord.addLogicRule("Player", rule_id, error), "add logic rule on Player");
    expect(coord.isDirty(), "add logic rule dirties");
    expect(!rule_id.empty(), "rule id assigned");
    const auto player_it = coord.document().objectTypes.find("Player");
    expect(player_it != coord.document().objectTypes.end(), "Player type exists");
    expect(player_it->second.logicBoard.has_value(), "Player has logicBoard");
    expect(player_it->second.logicBoard->rules.size() == 1, "one rule after add");
    expect(player_it->second.logicBoard->rules.front().id == rule_id, "rule id matches");
    expect(player_it->second.logicBoard->rules.front().name == "Logic 01",
           "first rule receives persisted default name");
    expect(coord.setLogicRulePrimaryAction("Player", rule_id, ArtCade::Logic::kStateSet, error),
           "set Number variable action");
    expect(coord.logicReferenceCount("score") == 1, "Logic references score");
    {
        expect(!coord.setLogicRuleBlockProperty(
                   "Player",
                   rule_id,
                   ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                   "key",
                   "missing_variable",
                   error),
               "unknown Variable key is rejected");
        expect(coord.addGameVariable("flag", "boolean", error), "add Boolean for type mismatch");
        expect(!coord.setLogicRuleBlockProperty(
                   "Player",
                   rule_id,
                   ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                   "key",
                   "flag",
                   error),
               "Boolean Variable is rejected on Number state action");
        expect(coord.setLogicRuleBlockProperty(
                   "Player",
                   rule_id,
                   ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                   "key",
                   "",
                   error),
               "empty Variable key remains an authoring draft");
        expect(coord.logicReferenceCount("score") == 0,
               "empty draft clears score reference count");
        // Pop the applied edits so later undo/redo of StateSet stays intact.
        coord.undo(); // restore score key
        coord.undo(); // remove temporary Boolean add
        expect(coord.logicReferenceCount("score") == 1,
               "score reference restored after validation undos");
        expect(coord.document().globalVariables.size() == 1,
               "temporary Boolean removed from catalog after validation undos");
    }
    const std::uint64_t revision_before_referenced_variable_change = coord.revision();
    expect(!coord.removeGameVariable("score", error), "referenced variable cannot be removed");
    expect(!coord.setGameVariableType("score", "boolean", error),
           "referenced variable type cannot change");
    expect(coord.revision() == revision_before_referenced_variable_change,
           "rejected referenced-variable changes do not bump revision");
    expect(coord.setLogicRulePrimaryAction("Player", rule_id, ArtCade::Logic::kSetVisible, error),
           "restore default action after variable reference test");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().actions.front().typeId
               == ArtCade::Logic::kStateSet,
           "undo restores variable reference action");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().actions.front().typeId
               == ArtCade::Logic::kSetVisible,
           "undo restores the new rule default action");
    coord.undo();
    expect(!coord.document().objectTypes.at("Player").logicBoard.has_value(),
           "undo removes created board");
    coord.redo();
    coord.redo();
    coord.redo();
    expect(coord.document().objectTypes.at("Player").logicBoard.has_value(),
           "redo restores board");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.size() == 1,
           "redo restores rule");

    ArtCade::LogicRuleId rule_b;
    expect(coord.addLogicRule("Player", rule_b, error), "add second rule");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.size() == 2,
           "two rules");
    expect(rule_b != rule_id, "second rule id distinct");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[1].name == "Logic 02",
           "second rule receives next available name");

    expect(coord.renameLogicRule("Player", rule_id, "  Player Movement  ", error),
           "rename Logic rule trims name");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].name
               == "Player Movement",
           "renamed Logic label persists");
    expect(!coord.renameLogicRule("Player", rule_b, "player movement", error),
           "case-insensitive duplicate Logic name rejected");
    const std::uint64_t rev_before_name_noop = coord.revision();
    expect(coord.renameLogicRule("Player", rule_id, "Player Movement", error),
           "same Logic name is a no-op");
    expect(coord.revision() == rev_before_name_noop, "no-op rename does not bump revision");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].name == "Logic 01",
           "undo restores default Logic name");
    coord.redo();
    expect(coord.renameLogicRule("Player", rule_id, "Logic 01", error),
           "restore first canonical name before gap reuse");
    expect(coord.renameLogicRule("Player", rule_b, "Jump", error),
           "rename second rule before gap reuse");
    ArtCade::LogicRuleId rule_c;
    expect(coord.addLogicRule("Player", rule_c, error), "add rule reuses available Logic label");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.back().name == "Logic 02",
           "new rule uses first available canonical Logic name");
    coord.undo();

    expect(coord.setLogicRuleTrigger("Player",
                                     rule_id,
                                     ArtCade::Logic::kKeyPressed,
                                     error),
           "set trigger to key pressed");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].trigger.typeId
               == ArtCade::Logic::kKeyPressed,
           "trigger updated");
    expect(coord.setLogicRuleBlockProperty("Player",
                                           rule_id,
                                           ArtCade::EditorCore::LogicRuleBlockSlot::Trigger,
                                           "key",
                                           "W",
                                           error),
           "set key property to W");
    {
        const ArtCade::LogicPropertyDef *key_prop = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].trigger, "key");
        expect(key_prop != nullptr, "key property present");
        expect(std::holds_alternative<ArtCade::LogicKey>(key_prop->value)
                   && std::get<ArtCade::LogicKey>(key_prop->value) == ArtCade::LogicKey::W,
               "key is W");
    }
    const std::uint64_t rev_before_key_noop = coord.revision();
    expect(coord.setLogicRuleBlockProperty("Player",
                                           rule_id,
                                           ArtCade::EditorCore::LogicRuleBlockSlot::Trigger,
                                           "key",
                                           "W",
                                           error),
           "no-op key set succeeds");
    expect(coord.revision() == rev_before_key_noop, "no-op key does not bump revision");
    coord.undo();
    {
        const ArtCade::LogicPropertyDef *key_prop = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].trigger, "key");
        expect(key_prop != nullptr, "key after undo");
        expect(std::holds_alternative<ArtCade::LogicKey>(key_prop->value)
                   && std::get<ArtCade::LogicKey>(key_prop->value) == ArtCade::LogicKey::Space,
               "undo restores default Space key");
    }
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].trigger.typeId
               == ArtCade::Logic::kOnStart,
           "undo trigger");

    expect(coord.setLogicRulePrimaryAction("Player",
                                           rule_id,
                                           ArtCade::Logic::kDestroySelf,
                                           error),
           "set primary action");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front().typeId
               == ArtCade::Logic::kDestroySelf,
           "action updated");
    coord.undo();
    expect(coord.setLogicRuleBlockProperty("Player",
                                           rule_id,
                                           ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                                           "visible",
                                           "false",
                                           error),
           "set visible false on default Set Visible");
    {
        const ArtCade::LogicPropertyDef *vis = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front(),
            "visible");
        expect(vis != nullptr && std::holds_alternative<bool>(vis->value)
                   && std::get<bool>(vis->value) == false,
               "visible is false");
    }
    coord.undo();

    expect(coord.setLogicRulePrimaryAction("Player",
                                           rule_id,
                                           ArtCade::Logic::kSetPosition,
                                           error),
           "set action to Set Position");
    expect(coord.setLogicRuleBlockProperty("Player",
                                           rule_id,
                                           ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                                           "position",
                                           "12, 34.5",
                                           error),
           "set position vec2 property");
    {
        const ArtCade::LogicPropertyDef *pos = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front(),
            "position");
        expect(pos != nullptr && std::holds_alternative<ArtCade::Vec2>(pos->value)
                   && std::get<ArtCade::Vec2>(pos->value).x == 12.f
                   && std::get<ArtCade::Vec2>(pos->value).y == 34.5f,
               "position is 12,34.5");
    }
    expect(!coord.setLogicRuleBlockProperty("Player",
                                            rule_id,
                                            ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                                            "position",
                                            "12",
                                            error),
           "vec2 without comma is rejected");
    coord.undo();
    {
        const ArtCade::LogicPropertyDef *pos = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front(),
            "position");
        expect(pos != nullptr && std::holds_alternative<ArtCade::Vec2>(pos->value)
                   && std::get<ArtCade::Vec2>(pos->value).x == 0.f
                   && std::get<ArtCade::Vec2>(pos->value).y == 0.f,
               "undo restores default position");
    }

    expect(coord.setLogicRulePrimaryAction("Player",
                                           rule_id,
                                           ArtCade::Logic::kAudioPlaySound,
                                           error),
           "set action to Play Sound");
    expect(coord.setLogicRuleBlockProperty("Player",
                                           rule_id,
                                           ArtCade::EditorCore::LogicRuleBlockSlot::PrimaryAction,
                                           "audioAssetId",
                                           "sfx-coin",
                                           error),
           "set audio asset id");
    {
        const ArtCade::LogicPropertyDef *asset = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front(),
            "audioAssetId");
        expect(asset != nullptr
                   && std::holds_alternative<ArtCade::LogicAssetReference>(asset->value)
                   && std::get<ArtCade::LogicAssetReference>(asset->value).id == "sfx-coin",
               "audio asset id set");
    }
    coord.undo();
    {
        const ArtCade::LogicPropertyDef *asset = ArtCade::Logic::findProperty(
            coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front(),
            "audioAssetId");
        expect(asset != nullptr
                   && std::holds_alternative<ArtCade::LogicAssetReference>(asset->value)
                   && std::get<ArtCade::LogicAssetReference>(asset->value).id.empty(),
               "undo clears audio asset id");
    }
    coord.undo();
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].actions.front().typeId
               == ArtCade::Logic::kSetVisible,
           "undo chain restores default Set Visible action");

    expect(coord.setLogicRuleTrigger("Player",
                                      rule_id,
                                      ArtCade::Logic::kCollisionEnter,
                                      error),
           "set collision trigger");
    expect(coord.setLogicRulePrimaryCondition("Player",
                                               rule_id,
                                               ArtCade::Logic::kOtherIsObjectType,
                                               error),
           "set condition compatible with collision trigger");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].conditions.size() == 1,
           "one condition");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].conditions.front().typeId
               == ArtCade::Logic::kOtherIsObjectType,
           "condition uses collision context");
    const std::uint64_t rev_before_incompatible_trigger = coord.revision();
    expect(!coord.setLogicRuleTrigger("Player", rule_id, ArtCade::Logic::kOnStart, error),
           "trigger that breaks existing condition is rejected");
    expect(coord.revision() == rev_before_incompatible_trigger,
           "incompatible trigger does not bump revision");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].trigger.typeId
               == ArtCade::Logic::kCollisionEnter,
           "rejected trigger leaves rule unchanged");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].conditions.empty(),
            "undo clears inserted condition");
    expect(coord.setLogicRulePrimaryCondition("Player",
                                               rule_id,
                                               ArtCade::Logic::kOtherIsObjectType,
                                               error),
           "set collision condition again");
    expect(coord.clearLogicRuleConditions("Player", rule_id, error), "clear conditions");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].conditions.empty(),
           "conditions cleared");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].conditions.size() == 1,
           "undo clear restores condition");
    coord.redo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].conditions.empty(),
           "redo clear");

    expect(coord.removeLogicRule("Player", rule_id, error), "remove first rule");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.size() == 1,
           "one rule remains");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().id == rule_b,
           "remaining is second rule");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.size() == 2,
           "undo remove restores two rules");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].id == rule_id,
           "undo restore at index 0");
    coord.redo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.size() == 1,
           "redo remove");

    // Leave one rule (rule_b) for save persistence checks.
    ArtCade::LogicRuleId deleted_id = rule_b;
    expect(coord.removeLogicRule("Player", deleted_id, error), "remove last rule");
    expect(!coord.document().objectTypes.at("Player").logicBoard.has_value(),
           "remove last rule clears board");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard.has_value(),
           "undo remove restores board");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.size() == 1,
           "undo remove restores rule");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().id == deleted_id,
           "undo remove restores same rule id");

    expect(coord.setLogicRuleEnabled("Player", deleted_id, false, error), "disable rule");
    expect(coord.isDirty(), "disable rule dirties");
    expect(!coord.document().objectTypes.at("Player").logicBoard->rules.front().enabled,
           "rule disabled");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().enabled,
           "undo re-enables rule");
    coord.redo();
    expect(!coord.document().objectTypes.at("Player").logicBoard->rules.front().enabled,
           "redo disables rule");
    const std::uint64_t rev_before_enable_noop = coord.revision();
    expect(coord.setLogicRuleEnabled("Player", deleted_id, false, error),
           "no-op disable succeeds");
    expect(coord.revision() == rev_before_enable_noop,
           "no-op disable does not bump revision");

    // Incompatible selections are rejected before they can dirty or invalidate the document.
    expect(coord.validateLogicForPlay(error), "configured rule validates for Play");
    const std::uint64_t rev_before_incompatible_condition = coord.revision();
    expect(!coord.setLogicRulePrimaryCondition("Player",
                                               deleted_id,
                                               ArtCade::Logic::kIsGrounded,
                                               error),
           "grounded without Platformer is rejected");
    expect(coord.revision() == rev_before_incompatible_condition,
           "incompatible condition does not bump revision");
    expect(coord.validateLogicForPlay(error), "rejected condition leaves board valid");
    expect(!coord.setLogicRulePrimaryAction("Player",
                                            deleted_id,
                                            ArtCade::Logic::kMoveHorizontal,
                                            error),
           "platformer action without component is rejected");

    // Object-type components: authorable + persisted (Logic Catalog "Add …").
    const std::uint64_t rev_before_platformer = coord.revision();
    expect(coord.ensureObjectTypeComponent("Player", "platformerController", error),
           "add Platformer Controller");
    expect(coord.document().objectTypes.at("Player").platformerController.has_value(),
           "platformerController present");
    expect(coord.revision() > rev_before_platformer, "add component bumps revision");
    coord.undo();
    expect(!coord.document().objectTypes.at("Player").platformerController.has_value(),
           "undo removes added Platformer Controller");
    coord.redo();
    expect(coord.document().objectTypes.at("Player").platformerController.has_value(),
           "redo restores added Platformer Controller");
    const std::uint64_t rev_before_platformer_noop = coord.revision();
    expect(coord.ensureObjectTypeComponent("Player", "platformerController", error),
           "duplicate Platformer is a no-op");
    expect(coord.revision() == rev_before_platformer_noop,
           "no-op component ensure does not bump revision");
    expect(coord.setLogicRulePrimaryAction("Player",
                                           deleted_id,
                                           ArtCade::Logic::kJump,
                                           error),
           "Jump available after Platformer Controller");
    coord.undo(); // undo Jump
    ArtCade::SpriteRendererComponent original_renderer;
    original_renderer.imageAssetId = "hero-image";
    original_renderer.animationAssetId = "hero-animation";
    original_renderer.visible = false;
    coord.document().objectTypes.at("Player").spriteRenderer = original_renderer;
    expect(coord.ensureObjectTypeComponent("Player", "spriteAnimator", error),
           "add Sprite Animator");
    expect(coord.document().objectTypes.at("Player").spriteRenderer.has_value()
               && coord.document().objectTypes.at("Player").spriteAnimator.has_value(),
           "spriteRenderer + spriteAnimator present");
    coord.undo();
    const auto &renderer_after_undo =
        *coord.document().objectTypes.at("Player").spriteRenderer;
    expect(!coord.document().objectTypes.at("Player").spriteAnimator.has_value(),
           "undo removes added Sprite Animator");
    expect(renderer_after_undo.imageAssetId == original_renderer.imageAssetId
               && renderer_after_undo.animationAssetId == original_renderer.animationAssetId
               && renderer_after_undo.visible == original_renderer.visible,
           "undo preserves pre-existing Sprite Renderer");
    coord.redo();
    expect(coord.document().objectTypes.at("Player").spriteAnimator.has_value(),
           "redo restores Sprite Animator");

    // Display sections: grouping metadata only, undoable, persisted.
    std::string section_id;
    expect(coord.addLogicSection("Player", "", section_id, error), "add section");
    expect(!section_id.empty(), "section id assigned");
    expect(coord.document().objectTypes.at("Player").logicBoard->sections.size() == 1,
           "one section");
    expect(coord.renameLogicSection("Player", section_id, "  Collection  ", error),
           "rename section (trims)");
    expect(coord.document().objectTypes.at("Player").logicBoard->sections.front().name
               == "Collection",
           "section name trimmed");
    expect(!coord.renameLogicSection("Player", section_id, "   ", error),
           "blank section name rejected");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->sections.front().name
               == "Section 1",
           "undo rename restores default name");
    coord.redo();

    expect(coord.setLogicRuleSection("Player", deleted_id, section_id, error),
           "assign rule to section");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().sectionId
               == section_id,
           "rule sectionId set");
    expect(!coord.setLogicRuleSection("Player", deleted_id, "section-missing", error),
           "unknown section rejected");
    const std::uint64_t rev_before_section_noop = coord.revision();
    expect(coord.setLogicRuleSection("Player", deleted_id, section_id, error),
           "no-op section assign succeeds");
    expect(coord.revision() == rev_before_section_noop,
           "no-op section assign does not bump revision");

    expect(coord.removeLogicSection("Player", section_id, error), "remove section");
    expect(coord.document().objectTypes.at("Player").logicBoard->sections.empty(),
           "sections empty after remove");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().sectionId.empty(),
           "member rule unsectioned after remove");
    coord.undo();
    expect(coord.document().objectTypes.at("Player").logicBoard->sections.size() == 1,
           "undo remove restores section");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules.front().sectionId
               == section_id,
           "undo remove restores rule membership");
    expect(coord.validateLogicForPlay(error), "sections do not affect Play validation");

    ArtCade::SceneLayerSettings &background_settings =
        coord.document().scenes.at("scene_main").layerSettings["layer_bg"];
    background_settings.parallax = {0.5f, 0.75f};
    background_settings.background.imageId = "img_hero";
    background_settings.background.tileX = false;
    background_settings.background.scrollY = 12.f;
    expect(coord.saveProjectAs(out_path.string(), error), "save roundtrip file");
    expect(!coord.isDirty(), "clean after save");

    EditorCoordinator reloaded;
    expect(reloaded.openProject(out_path.string(), error), "reload saved file");
    expect(reloaded.document().objectTypes.at("Player").platformerController.has_value(),
           "platformerController persisted");
    expect(reloaded.document().objectTypes.at("Player").spriteRenderer.has_value()
               && reloaded.document().objectTypes.at("Player").spriteAnimator.has_value(),
           "spriteAnimator persisted");
    const auto &reloaded_renderer =
        *reloaded.document().objectTypes.at("Player").spriteRenderer;
    expect(reloaded_renderer.imageAssetId == original_renderer.imageAssetId
               && reloaded_renderer.animationAssetId == original_renderer.animationAssetId
               && reloaded_renderer.visible == original_renderer.visible,
           "Sprite Renderer values persisted");
    const ArtCade::SceneInstanceDef *again =
        project_doc_find_instance(reloaded.document(), 1);
    expect(again != nullptr, "reloaded instance");
    expect(again->instanceName == "HeroSaved", "persisted name");
    expect(again->transform.position.x == 55.f && again->transform.position.y == 66.f,
           "persisted position");
    expect(nearly_equal(again->transform.scale, ArtCade::Vec2{2.f, 3.f}), "persisted scale");
    expect(nearly_equal(again->transform.rotation, 3.14159265358979323846f * 0.5f),
           "persisted rotation");
    const ArtCade::SceneDef *reloaded_scene = active_scene(reloaded.document());
    expect(reloaded_scene != nullptr && reloaded_scene->layers.size() == 3,
           "persisted scene layers");
    expect(reloaded_scene->defaultLayerId == "layer_main",
           "persisted defaultLayerId");
    expect(reloaded.document().imageAssets.size() == 2, "persisted image assets");
    expect(reloaded.document().globalVariables.size() == 1,
           "persisted global variable count");
    expect(reloaded.document().globalVariables.front().key == "score"
               && reloaded.document().globalVariables.front().type
                      == ArtCade::GameVariableDefinition::Type::Number
               && std::get<double>(reloaded.document().globalVariables.front().initialValue) == 42.0,
           "persisted global variable value");
    expect(!reloaded.layerVisible("layer_ui"), "persisted play layer visibility");
    expect(reloaded.layerLocked("layer_bg"), "persisted layer lock");
    const ArtCade::SceneLayerSettings &reloaded_background =
        reloaded.document().scenes.at("scene_main").layerSettings.at("layer_bg");
    expect(nearly_equal(reloaded_background.parallax.x, 0.5f)
               && nearly_equal(reloaded_background.parallax.y, 0.75f),
           "persisted layer parallax");
    expect(reloaded_background.background.imageId == "img_hero"
               && !reloaded_background.background.tileX
               && nearly_equal(reloaded_background.background.scrollY, 12.f),
           "persisted layer background settings");
    expect(!reloaded.layerHiddenInEditor("layer_ui"),
           "editor hide does not survive reload");
    const auto reloaded_player = reloaded.document().objectTypes.find("Player");
    expect(reloaded_player != reloaded.document().objectTypes.end(), "reloaded Player");
    expect(reloaded_player->second.logicBoard.has_value(), "persisted logicBoard");
    expect(reloaded_player->second.logicBoard->rules.size() == 1, "persisted rule count");
    expect(reloaded_player->second.logicBoard->rules.front().id == deleted_id,
           "persisted rule id");
    expect(!reloaded_player->second.logicBoard->rules.front().enabled,
           "persisted rule disabled state");
    expect(reloaded_player->second.logicBoard->sections.size() == 1,
           "persisted section count");
    expect(reloaded_player->second.logicBoard->sections.front().id == section_id
               && reloaded_player->second.logicBoard->sections.front().name == "Collection",
           "persisted section id and name");
    expect(reloaded_player->second.logicBoard->rules.front().sectionId == section_id,
           "persisted rule section membership");

    std::error_code ec;
    fs::remove(out_path, ec);

    const fs::path created_path = fixture_dir / "created_blank.json";
    EditorCoordinator blank;
    expect(blank.createNewProject(created_path.string(), "Blank Project", error),
           "createNewProject writes and opens");
    expect(blank.hasProject(), "blank project open");
    expect(blank.document().projectName == "Blank Project", "blank project name");
    expect(blank.document().formatVersion == kCurrentProjectFormatVersion,
           "blank formatVersion");
    expect(blank.document().scenes.size() == 1, "blank has one scene");
    const ArtCade::SceneDef *blank_scene = active_scene(blank.document());
    expect(blank_scene != nullptr && blank_scene->layers.size() == 1,
           "blank has one scene layer");
    expect(blank_scene->defaultLayerId == "layer_main",
           "blank defaultLayerId");
    expect(blank.document().scenes.begin()->second.instances.empty(),
           "blank scene has no instances");
    expect(!blank.isDirty(), "fresh create is clean");
    fs::remove(created_path, ec);

    std::printf("artcade_editor_core_roundtrip_test: PASS\n");
    return 0;
}

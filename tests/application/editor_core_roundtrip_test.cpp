// artcade_editor_core_roundtrip_test — single authority load/command/undo/save/reload

#include "artcade/editor_core/editor_core.h"

#include "logic-core.h"

#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <string>

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
    expect(coord.document().formatVersion == kCurrentProjectFormatVersion, "format v5");

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

    // Leave a deterministic dirty state for save
    expect(coord.renameEntity(1, "HeroSaved", error), "final rename");
    expect(coord.setEntityPosition(1, 55.f, 66.f, error), "final position");

    const std::uint64_t rev_before_select = coord.revision();
    coord.selectEntity(2);
    expect(coord.revision() == rev_before_select, "selection does not bump revision");

    expect(coord.document().layers.size() == 3, "fixture has 3 layers");
    expect(coord.document().imageAssets.size() == 2, "fixture has 2 image assets");
    expect(coord.activeLayerId() == "layer_bg", "default active layer is first");
    expect(coord.layerVisible("layer_ui"), "ui layer visible initially");

    const std::uint64_t rev_before_active = coord.revision();
    coord.setActiveLayerId("layer_main");
    expect(coord.activeLayerId() == "layer_main", "active layer workspace change");
    expect(coord.revision() == rev_before_active, "active layer does not bump revision");

    expect(coord.setLayerVisible("layer_ui", false, error), "hide ui layer");
    expect(!coord.layerVisible("layer_ui"), "ui layer hidden");
    expect(coord.isDirty(), "layer visibility dirties");
    coord.undo();
    expect(coord.layerVisible("layer_ui"), "undo layer visibility");

    expect(coord.setLayerVisible("layer_ui", false, error), "hide ui again for save");

    expect(coord.pickEntityAt(60.f, 70.f) == 1, "pick Hero inside placeholder");
    expect(coord.pickEntityAt(0.f, 0.f) == 0, "pick empty world misses");
    expect(coord.pickEntityAt(110.f, 55.f) == 2, "pick Coin_A");

    ArtCade::LogicRuleId rule_id;
    expect(coord.addLogicRule("Player", rule_id, error), "add logic rule on Player");
    expect(coord.isDirty(), "add logic rule dirties");
    expect(!rule_id.empty(), "rule id assigned");
    const auto player_it = coord.document().objectTypes.find("Player");
    expect(player_it != coord.document().objectTypes.end(), "Player type exists");
    expect(player_it->second.logicBoard.has_value(), "Player has logicBoard");
    expect(player_it->second.logicBoard->rules.size() == 1, "one rule after add");
    expect(player_it->second.logicBoard->rules.front().id == rule_id, "rule id matches");
    coord.undo();
    expect(!coord.document().objectTypes.at("Player").logicBoard.has_value(),
           "undo removes created board");
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

    expect(coord.setLogicRuleTrigger("Player",
                                     rule_id,
                                     ArtCade::Logic::kKeyPressed,
                                     error),
           "set trigger to key pressed");
    expect(coord.document().objectTypes.at("Player").logicBoard->rules[0].trigger.typeId
               == ArtCade::Logic::kKeyPressed,
           "trigger updated");
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

    expect(coord.saveProjectAs(out_path.string(), error), "save roundtrip file");
    expect(!coord.isDirty(), "clean after save");

    EditorCoordinator reloaded;
    expect(reloaded.openProject(out_path.string(), error), "reload saved file");
    const ArtCade::SceneInstanceDef *again =
        project_doc_find_instance(reloaded.document(), 1);
    expect(again != nullptr, "reloaded instance");
    expect(again->instanceName == "HeroSaved", "persisted name");
    expect(again->transform.position.x == 55.f && again->transform.position.y == 66.f,
           "persisted position");
    expect(reloaded.document().layers.size() == 3, "persisted layers");
    expect(reloaded.document().imageAssets.size() == 2, "persisted image assets");
    expect(!reloaded.layerVisible("layer_ui"), "persisted layer visibility");
    const auto reloaded_player = reloaded.document().objectTypes.find("Player");
    expect(reloaded_player != reloaded.document().objectTypes.end(), "reloaded Player");
    expect(reloaded_player->second.logicBoard.has_value(), "persisted logicBoard");
    expect(reloaded_player->second.logicBoard->rules.size() == 1, "persisted rule count");
    expect(reloaded_player->second.logicBoard->rules.front().id == deleted_id,
           "persisted rule id");
    expect(!reloaded_player->second.logicBoard->rules.front().enabled,
           "persisted rule disabled state");

    std::error_code ec;
    fs::remove(out_path, ec);

    std::printf("artcade_editor_core_roundtrip_test: PASS\n");
    return 0;
}

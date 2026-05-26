// save-load-test.cpp
// Compile from runtime-cpp/tests/:
//   g++ -std=c++17 -I../src \
//       save-load-test.cpp \
//       ../src/modules/save-load/src/save-load-manager.cpp \
//       ../src/modules/variable-manager/src/variable-manager.cpp \
//       -o save_load_test && ./save_load_test
//
// NOTE: writes temporary files to ./test_saves/ and cleans up after itself.

#include <cassert>
#include <cstdio>
#include <filesystem>
#include <string>

#include "../src/modules/save-load/include/save-load-manager.h"
#include "../src/modules/variable-manager/include/variable-manager.h"

namespace fs = std::filesystem;
using SL  = ArtCade::Modules::SaveLoadManager;
using VM  = ArtCade::Modules::VariableManager;

static const std::string kTestDir = "test_saves/";

static void cleanup() {
    std::error_code ec;
    fs::remove_all(kTestDir, ec);
    fs::remove("escape.sav", ec);
}

static VM::Snapshot makeSnap() {
    VM vm; vm.init();
    vm.setInt   ("score",  42);
    vm.setFloat ("speed",  3.14f);
    vm.setBool  ("dead",   false);
    vm.setString("name",   "hero");
    return vm.takeSnapshot();
}

static void test_init_shutdown() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);
    assert(sl.saveDirectory() == kTestDir);
    sl.shutdown();
    std::puts("  [ok] init / shutdown");
}

static void test_save_and_load() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);

    auto snap = makeSnap();
    bool ok = sl.save("slot1", snap);
    assert(ok);
    assert(sl.hasSave("slot1"));

    auto loaded = sl.load("slot1");
    assert(loaded.has_value());

    VM vm; vm.init();
    vm.restoreSnapshot(*loaded);
    assert(vm.getInt   ("score")  == 42);
    assert(vm.getBool  ("dead")   == false);
    assert(vm.getString("name")   == "hero");
    // float comparison with tolerance
    float spd = vm.getFloat("speed");
    assert(spd > 3.13f && spd < 3.15f);

    cleanup();
    std::puts("  [ok] save → load roundtrip preserves all types");
}

static void test_has_save_false_when_missing() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);
    assert(!sl.hasSave("nonexistent"));
    std::puts("  [ok] hasSave returns false for missing slot");
}

static void test_load_returns_nullopt_when_missing() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);
    auto result = sl.load("ghost");
    assert(!result.has_value());
    std::puts("  [ok] load returns nullopt for missing slot");
}

static void test_delete_save() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);
    sl.save("slot2", makeSnap());
    assert(sl.hasSave("slot2"));
    sl.deleteSave("slot2");
    assert(!sl.hasSave("slot2"));
    cleanup();
    std::puts("  [ok] deleteSave removes file");
}

static void test_list_slots() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);
    sl.save("alpha", makeSnap());
    sl.save("beta",  makeSnap());
    sl.save("gamma", makeSnap());
    auto slots = sl.listSlots();
    assert(slots.size() == 3);
    assert(slots[0] == "alpha" && slots[1] == "beta" && slots[2] == "gamma");
    cleanup();
    std::puts("  [ok] listSlots returns sorted slot names");
}

static void test_overwrite_slot() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);

    VM::Snapshot snap1;
    snap1["score"] = (int32_t)10;
    sl.save("s", snap1);

    VM::Snapshot snap2;
    snap2["score"] = (int32_t)99;
    sl.save("s", snap2);

    auto loaded = sl.load("s");
    assert(loaded.has_value());
    assert(std::get<int32_t>((*loaded)["score"]) == 99);
    cleanup();
    std::puts("  [ok] saving to existing slot overwrites it");
}

static void test_rejects_path_traversal_slots() {
    SL sl; sl.init();
    sl.setSaveDirectory(kTestDir);

    auto snap = makeSnap();
    assert(!sl.save("../escape", snap));
    assert(!sl.save("nested/slot", snap));
    assert(!sl.save("C:\\escape", snap));
    assert(!sl.hasSave("../escape"));
    assert(!sl.load("../escape").has_value());
    sl.deleteSave("../escape");
    assert(!fs::exists("escape.sav"));
    cleanup();
    std::puts("  [ok] invalid slot names cannot escape save directory");
}

int main() {
    std::puts("=== SaveLoadManager check ===");
    cleanup();   // start clean
    test_init_shutdown();
    test_save_and_load();
    test_has_save_false_when_missing();
    test_load_returns_nullopt_when_missing();
    test_delete_save();
    test_list_slots();
    test_overwrite_slot();
    test_rejects_path_traversal_slots();
    std::puts("=== all 8 tests passed ===");
    return 0;
}

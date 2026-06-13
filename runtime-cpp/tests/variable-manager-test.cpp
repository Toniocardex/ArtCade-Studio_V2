// variable-manager-test.cpp
// Compile from runtime-cpp/tests/:
//   g++ -std=c++17 -I../src \
//       variable-manager-test.cpp \
//       ../src/modules/variable-manager/src/variable-manager.cpp \
//       -o variable_manager_test && ./variable_manager_test

#include <cassert>
#include <cstdio>
#include <string>

#include "../src/modules/variable-manager/include/variable-manager.h"

using VM = ArtCade::Modules::VariableManager;

static ArtCade::GameVariableDefinition numberDef(const char* key, double value) {
    return {key, ArtCade::GameVariableDefinition::Type::Number, value, {}};
}
static ArtCade::GameVariableDefinition boolDef(const char* key, bool value) {
    return {key, ArtCade::GameVariableDefinition::Type::Boolean, value, {}};
}
static ArtCade::GameVariableDefinition stringDef(const char* key, const char* value) {
    return {key, ArtCade::GameVariableDefinition::Type::String, std::string(value), {}};
}
static void configure(VM& vm) {
    vm.configureGlobals({numberDef("score", 0), numberDef("speed", 0),
        numberDef("lives", 0), numberDef("hp", 0), numberDef("x", 0),
        boolDef("dead", false), boolDef("muted", false),
        stringDef("name", ""), stringDef("level", "")});
}

static void test_init_shutdown() {
    VM vm; vm.init(); configure(vm);
    assert(!vm.exists("x"));
    vm.shutdown();
    std::puts("  [ok] init / shutdown");
}

static void test_set_get_int() {
    VM vm; vm.init(); configure(vm);
    vm.setInt("score", 100);
    assert(vm.getInt("score") == 100);
    assert(vm.exists("score"));
    std::puts("  [ok] setInt / getInt");
}

static void test_set_get_float() {
    VM vm; vm.init(); configure(vm);
    vm.setFloat("speed", 3.14f);
    assert(vm.getFloat("speed") > 3.13f && vm.getFloat("speed") < 3.15f);
    std::puts("  [ok] setFloat / getFloat");
}

static void test_set_get_bool() {
    VM vm; vm.init(); configure(vm);
    vm.setBool("dead", true);
    assert(vm.getBool("dead") == true);
    std::puts("  [ok] setBool / getBool");
}

static void test_set_get_string() {
    VM vm; vm.init(); configure(vm);
    vm.setString("name", "hero");
    assert(vm.getString("name") == "hero");
    std::puts("  [ok] setString / getString");
}

static void test_default_on_missing() {
    VM vm; vm.init(); configure(vm);
    assert(vm.getInt("missing", 99) == 99);
    assert(vm.getFloat("missing", 1.f) > 0.9f);
    assert(vm.getBool("missing", true) == true);
    assert(vm.getString("missing", "fb") == "fb");
    std::puts("  [ok] default fallback for missing keys");
}

static void test_add_int() {
    VM vm; vm.init(); configure(vm);
    vm.setInt("lives", 3);
    int32_t r = vm.addInt("lives", -1);
    assert(r == 2 && vm.getInt("lives") == 2);
    std::puts("  [ok] addInt");
}

static void test_add_int_clamped() {
    VM vm; vm.init(); configure(vm);
    vm.setInt("hp", 95);
    int32_t r = vm.addInt("hp", 10, {}, {100});
    assert(r == 100);
    r = vm.addInt("hp", -200, {0}, {});
    assert(r == 0);
    std::puts("  [ok] addInt with min/max clamp");
}

static void test_add_float() {
    VM vm; vm.init(); configure(vm);
    float r = vm.addFloat("x", 1.5f);
    assert(r > 1.4f && r < 1.6f);
    std::puts("  [ok] addFloat");
}

static void test_toggle() {
    VM vm; vm.init(); configure(vm);
    assert(vm.toggle("muted") == true);
    assert(vm.toggle("muted") == false);
    std::puts("  [ok] toggle");
}

static void test_remove_and_clear() {
    VM vm; vm.init(); configure(vm);
    vm.setInt("a", 1);
    vm.setInt("b", 2);
    vm.remove("a");
    assert(!vm.exists("a") && vm.exists("b"));
    vm.clear();
    assert(!vm.exists("b"));
    std::puts("  [ok] remove + clear");
}

static void test_observer_fired_on_set() {
    VM vm; vm.init();
    int calls = 0;
    int32_t last = -1;
    vm.observe("score", [&](const std::string&, const VM::Value& v){
        ++calls;
        last = static_cast<int32_t>(std::get<double>(v));
    });
    vm.setInt("score", 50);
    vm.setInt("score", 75);
    assert(calls == 2 && last == 75);
    std::puts("  [ok] observer fires on set");
}

static void test_observer_key_scoped() {
    VM vm; vm.init(); configure(vm);
    int hits = 0;
    vm.observe("a", [&](const std::string&, const VM::Value&){ ++hits; });
    vm.setInt("b", 1);   // different key — observer must NOT fire
    assert(hits == 0);
    vm.setInt("a", 1);
    assert(hits == 1);
    std::puts("  [ok] observer is key-scoped");
}

static void test_stop_observing() {
    VM vm; vm.init(); configure(vm);
    int hits = 0;
    auto tok = vm.observe("k", [&](const std::string&, const VM::Value&){ ++hits; });
    vm.setInt("k", 1);
    vm.stopObserving(tok);
    vm.setInt("k", 2);
    assert(hits == 1);
    std::puts("  [ok] stopObserving");
}

static void test_snapshot_restore() {
    VM vm; vm.init(); configure(vm);
    vm.setInt("score", 10);
    vm.setString("level", "A");
    auto snap = vm.takeSnapshot();

    vm.setInt("score", 999);
    vm.restoreSnapshot(snap);
    assert(vm.getInt("score") == 10);
    assert(vm.getString("level") == "A");
    std::puts("  [ok] takeSnapshot / restoreSnapshot");
}

static void test_local_variables_and_persistent_snapshot() {
    VM vm; vm.init(); configure(vm);
    vm.createEntity(7, {numberDef("health", 100), boolDef("enabled", true)}, {{"health", 75.0}});
    vm.createEntity(8, {numberDef("health", 100)});
    assert(vm.getEntity(7, "health") == VM::Value{75.0});
    assert(vm.addEntity(7, "health", -5).value() == 70.0);
    assert(!vm.setEntity(7, "missing", 1.0));

    const auto snapshot = vm.takeGameSnapshot({7});
    assert(snapshot.entities.count(7) == 1);
    assert(snapshot.entities.count(8) == 0);
    vm.setEntity(7, "health", 1.0);
    assert(vm.restoreGameSnapshot(snapshot, {7}));
    assert(vm.getEntity(7, "health") == VM::Value{70.0});
    std::puts("  [ok] local variables + persistent game snapshot");
}

int main() {
    std::puts("=== VariableManager check ===");
    test_init_shutdown();
    test_set_get_int();
    test_set_get_float();
    test_set_get_bool();
    test_set_get_string();
    test_default_on_missing();
    test_add_int();
    test_add_int_clamped();
    test_add_float();
    test_toggle();
    test_remove_and_clear();
    test_observer_fired_on_set();
    test_observer_key_scoped();
    test_stop_observing();
    test_snapshot_restore();
    test_local_variables_and_persistent_snapshot();
    std::puts("=== all 16 tests passed ===");
    return 0;
}

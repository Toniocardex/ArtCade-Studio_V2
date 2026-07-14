#include "modules/logic-core/include/logic-core.h"
#include "modules/logic-runtime/include/logic-runtime.h"
#include "modules/lua-runtime/include/lua-host.h"

#include <algorithm>
#include <iostream>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

using namespace ArtCade;
using namespace ArtCade::Logic;

static int passed = 0;
static int failed = 0;
#define CHECK(x) do { if (x) ++passed; else { ++failed; std::cerr << "FAIL " #x " line " << __LINE__ << "\n"; } } while (0)

struct Host final : ILogicRuntimeHost {
    std::vector<std::string> calls;
    LogicRuntime* runtime = nullptr;
    std::optional<ScopeToken> cancelOnVisible;
    bool failVisible = false;
    std::unordered_set<EntityId> grounded;
    bool setVisible(EntityId owner, bool value) override {
        calls.push_back("visible:" + std::to_string(owner) + ":" + (value ? "1" : "0"));
        if (runtime && cancelOnVisible) runtime->cancelScope(*cancelOnVisible);
        return !failVisible;
    }
    bool setPosition(EntityId owner, Vec2 value) override {
        calls.push_back("position:" + std::to_string(owner) + ":"
                        + std::to_string(static_cast<int>(value.x)) + ","
                        + std::to_string(static_cast<int>(value.y)));
        return true;
    }
    bool isGrounded(EntityId owner) override {
        return grounded.count(owner) != 0;
    }
};

static LogicBoardDef makeBoard() {
    LogicBoardDef board;
    board.id = "logic:Hero";
    LogicRuleDef start = makeDefaultRule("rule-1");
    std::get<bool>(start.actions[0].properties[1].value) = false;
    board.rules.push_back(start);

    LogicRuleDef key = makeDefaultRule("rule-2");
    key.trigger = {kKeyPressed, {{"key", LogicKey::Space}}};
    key.actions[0] = {kSetPosition,
        {{"target", LogicEntityReference{}}, {"position", Vec2{12.f, 34.f}}}};
    board.rules.push_back(key);
    return board;
}

static void testCompilerAndJson() {
    LogicBoardDef board = makeBoard();
    LogicCompileResult a = compileBoard("Hero", board);
    LogicCompileResult b = compileBoard("Hero", board);
    CHECK(a.ok());
    CHECK(a.programs.size() == 1);
    CHECK(a.programs[0].source == b.programs[0].source);
    CHECK(!a.programs[0].requiresTick);

    const auto json = logicBoardToJson(board);
    LogicBoardDef loaded;
    CHECK(logicBoardFromJson(json, loaded).ok);
    CHECK(logicBoardToJson(loaded) == json);

    loaded.apiVersion = 999;
    CHECK(!validateBoard("Hero", loaded).empty());
    loaded = board;
    loaded.rules[0].trigger.typeId = "unknown.trigger";
    CHECK(!compileBoard("Hero", loaded).ok());

    ProjectDoc project;
    EntityDef z; z.logicBoard = board; z.logicBoard->id = "logic:Z";
    EntityDef aType; aType.logicBoard = board; aType.logicBoard->id = "logic:A";
    project.objectTypes.emplace("Z", z);
    project.objectTypes.emplace("A", aType);
    const LogicCompileResult projectCompiled = compileProjectLogic(project);
    CHECK(projectCompiled.ok());
    CHECK(projectCompiled.programs.size() == 2);
    CHECK(projectCompiled.programs[0].objectTypeId == "A");
    CHECK(projectCompiled.programs[1].objectTypeId == "Z");
}

static void testRuntime() {
    const LogicCompileResult compiled = compileBoard("Hero", makeBoard());
    Host host;
    LogicRuntime runtime(host);
    std::string error;
    CHECK(runtime.loadPrograms(compiled.programs, &error));
    const auto one = runtime.install("Hero", 10, &error);
    const auto two = runtime.install("Hero", 20, &error);
    CHECK(one.has_value());
    CHECK(two.has_value());

    runtime.dispatchStart();
    CHECK(host.calls.size() == 2);
    CHECK(host.calls[0] == "visible:10:0");
    CHECK(host.calls[1] == "visible:20:0");

    runtime.dispatchKeyPressed(LogicKey::Space);
    CHECK(host.calls.size() == 4);
    CHECK(host.calls[2] == "position:10:12,34");
    CHECK(host.calls[3] == "position:20:12,34");
    CHECK(runtime.cancelScope(*one));
    CHECK(!runtime.cancelScope(*one));
    runtime.dispatchKeyPressed(LogicKey::Space);
    CHECK(host.calls.size() == 5);
    CHECK(host.calls.back() == "position:20:12,34");
    runtime.shutdown();
}

static void testStrictSandboxAndBudget() {
    using namespace ArtCade::Modules;
    LuaHost host({LuaSandboxProfile::LogicBoardStrict, 1024u * 1024u});
    CHECK(host.init());
    CHECK(host.loadLuaSource(
        "assert(io == nil and os == nil and package == nil and require == nil)\n"
        "assert(debug == nil and dofile == nil and loadfile == nil and load == nil)\n"
        "assert(coroutine == nil and collectgarbage == nil)\n"
        "__artcade_requires_tick = false"));
    CHECK(!host.isScriptTickRequired());
    host.shutdown();

    Host runtimeHost;
    LogicRuntimeLimits limits;
    limits.maxInstructionsPerCallback = 2000;
    LogicRuntime runtime(runtimeHost, limits);
    LogicProgram program;
    program.objectTypeId = "Loop";
    program.boardId = "logic:Loop";
    program.source =
        "logic.require_api_version(2)\n"
        "logic.define_board('logic:Loop', 'Loop', function(context)\n"
        " context:on_start('rule-loop', function() while true do end end)\n"
        "end)\n";
    std::string error;
    CHECK(runtime.loadPrograms({program}, &error));
    CHECK(runtime.install("Loop", 1, &error).has_value());
    runtime.dispatchStart();
    CHECK(!runtime.diagnostics().empty());
    runtime.dispatchStart(); // disabled subscription is not retried
    CHECK(runtime.diagnostics().size() == 1);
}

static LogicProgram customProgram(std::string objectTypeId, std::string body) {
    LogicProgram program;
    program.objectTypeId = objectTypeId;
    program.boardId = "logic:" + objectTypeId;
    program.source = "logic.require_api_version(2)\nlogic.define_board('" + program.boardId
        + "', '" + objectTypeId + "', function(context)\n" + body + "\nend)\n";
    return program;
}

static void testLimitsSnapshotAndIsolation() {
    {
        Host host;
        LogicRuntimeLimits limits;
        limits.maxEventDepth = 0;
        LogicRuntime runtime(host, limits);
        const auto compiled = compileBoard("Hero", makeBoard());
        std::string error;
        CHECK(runtime.loadPrograms(compiled.programs, &error));
        CHECK(runtime.install("Hero", 1, &error).has_value());
        runtime.beginFrame();
        runtime.dispatchStart();
        CHECK(host.calls.empty());
        CHECK(!runtime.diagnostics().empty());
    }
    {
        Host host;
        LogicRuntimeLimits limits;
        limits.maxScopes = 1;
        LogicRuntime runtime(host, limits);
        const auto compiled = compileBoard("Hero", makeBoard());
        std::string error;
        CHECK(runtime.loadPrograms(compiled.programs, &error));
        CHECK(runtime.install("Hero", 1, &error).has_value());
        CHECK(!runtime.install("Hero", 2, &error).has_value());
    }
    {
        Host host;
        LogicRuntimeLimits limits;
        limits.maxSubscriptionsPerScope = 1;
        LogicRuntime runtime(host, limits);
        std::string error;
        const LogicProgram two = customProgram("Two",
            " context:on_start('one', function() end)\n"
            " context:on_start('two', function() end)");
        CHECK(runtime.loadPrograms({two}, &error));
        CHECK(!runtime.install("Two", 1, &error).has_value());
    }
    {
        Host host;
        LogicRuntimeLimits limits;
        limits.maxEventsPerDispatch = 1;
        LogicRuntime runtime(host, limits);
        const auto compiled = compileBoard("Hero", makeBoard());
        std::string error;
        CHECK(runtime.loadPrograms(compiled.programs, &error));
        CHECK(runtime.install("Hero", 1, &error).has_value());
        CHECK(runtime.install("Hero", 2, &error).has_value());
        runtime.beginFrame();
        runtime.dispatchStart();
        CHECK(host.calls.size() == 1);
        CHECK(!runtime.diagnostics().empty());
    }
    {
        Host host;
        LogicRuntime runtime(host);
        host.runtime = &runtime;
        const auto compiled = compileBoard("Hero", makeBoard());
        std::string error;
        CHECK(runtime.loadPrograms(compiled.programs, &error));
        CHECK(runtime.install("Hero", 1, &error).has_value());
        const auto second = runtime.install("Hero", 2, &error);
        CHECK(second.has_value());
        host.cancelOnVisible = second;
        runtime.beginFrame();
        runtime.dispatchStart();
        CHECK(host.calls.size() == 1); // snapshot token re-check observes unsubscribe
    }
    {
        Host host;
        host.failVisible = true;
        LogicRuntime runtime(host);
        std::string error;
        const LogicProgram isolated = customProgram("Isolated",
            " context:on_start('bad', function() context.self:set_visible(false) end)\n"
            " context:on_start('good', function() context.self:set_position(7, 8) end)");
        CHECK(runtime.loadPrograms({isolated}, &error));
        CHECK(runtime.install("Isolated", 1, &error).has_value());
        runtime.beginFrame();
        runtime.dispatchStart();
        CHECK(host.calls.size() == 2);
        CHECK(host.calls.back() == "position:1:7,8");
        CHECK(runtime.diagnostics().size() == 1);
    }
    {
        Host host;
        LogicRuntimeLimits limits;
        limits.maxMemoryBytes = 2u * 1024u * 1024u;
        LogicRuntime runtime(host, limits);
        std::string error;
        const LogicProgram memory = customProgram("Memory",
            " context:on_start('memory', function() local x = string.rep('x', 8388608) end)");
        CHECK(runtime.loadPrograms({memory}, &error));
        CHECK(runtime.install("Memory", 1, &error).has_value());
        runtime.beginFrame();
        runtime.dispatchStart();
        CHECK(!runtime.isEnabled());
        CHECK(!runtime.diagnostics().empty());
    }
}

static void testIsGroundedCondition() {
    // Registry: Is Grounded exists and is a Condition.
    const LogicBlockDescriptor* descriptor = findDescriptor(kIsGrounded);
    CHECK(descriptor != nullptr);
    CHECK(descriptor && descriptor->kind == BlockKind::Condition);

    LogicBlockDef condition = makeDefaultCondition();
    CHECK(condition.typeId == kIsGrounded);

    LogicBoardDef board;
    board.id = "logic:Grounded";
    LogicRuleDef rule = makeDefaultRule("rule-1");
    rule.trigger = {kKeyPressed, {{"key", LogicKey::Space}}};
    rule.conditions.push_back(condition);
    board.rules.push_back(rule);

    // Validation: expected is a required boolean property.
    CHECK(validateBoard("Hero", board).empty());

    // Compiler: expected=true compiles to `== true`; declares the capability.
    LogicCompileResult trueCompiled = compileBoard("Hero", board);
    CHECK(trueCompiled.ok());
    CHECK(trueCompiled.programs[0].source.find("is_grounded() == true") != std::string::npos);
    const auto& trueFeatures = trueCompiled.programs[0].requiredFeatures;
    CHECK(std::find(trueFeatures.begin(), trueFeatures.end(), "platformer.grounded") != trueFeatures.end());

    // Compiler: expected=false compiles to a real negation, not a no-op.
    LogicBoardDef falseBoard = board;
    std::get<bool>(falseBoard.rules[0].conditions[0].properties[0].value) = false;
    LogicCompileResult falseCompiled = compileBoard("Hero", falseBoard);
    CHECK(falseCompiled.ok());
    CHECK(falseCompiled.programs[0].source.find("is_grounded() == false") != std::string::npos);

    // Zero conditions: actions run directly, no guard emitted.
    LogicCompileResult noCondCompiled = compileBoard("Hero", makeBoard());
    CHECK(noCondCompiled.programs[0].source.find("is_grounded") == std::string::npos);

    // Multiple conditions: deterministic AND.
    LogicBoardDef multi = board;
    multi.rules[0].conditions.push_back(condition);
    LogicCompileResult multiCompiled = compileBoard("Hero", multi);
    CHECK(multiCompiled.ok());
    CHECK(multiCompiled.programs[0].source.find(" and ") != std::string::npos);

    // Runtime: grounded=false blocks the action, grounded=true runs it.
    {
        Host host;
        LogicRuntime runtime(host);
        std::string error;
        CHECK(runtime.loadPrograms(trueCompiled.programs, &error));
        CHECK(runtime.install("Hero", 1, &error).has_value());
        runtime.beginFrame();
        runtime.dispatchKeyPressed(LogicKey::Space);
        CHECK(host.calls.empty());
        host.grounded.insert(1);
        runtime.beginFrame();
        runtime.dispatchKeyPressed(LogicKey::Space);
        CHECK(!host.calls.empty());
    }

    // Compatibility: an unrecognized required feature is rejected up front,
    // not silently executed against a nonexistent Lua method.
    {
        Host host;
        LogicRuntime runtime(host);
        LogicProgram program = customProgram("Hero", " context:on_start('r', function() end)");
        program.requiredFeatures = {"future.unsupported"};
        std::string error;
        CHECK(!runtime.loadPrograms({program}, &error));
        CHECK(!error.empty());
    }
}

int main() {
    testCompilerAndJson();
    testRuntime();
    testStrictSandboxAndBudget();
    testLimitsSnapshotAndIsolation();
    testIsGroundedCondition();
    std::cout << passed << " passed, " << failed << " failed\n";
    return failed == 0 ? 0 : 1;
}

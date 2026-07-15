#include "../include/lua-host.h"
#include <memory>
#include <cstdlib>
#include <cstdint>

// Sol2 is a heavyweight header; include only in this TU.
#define SOL_ALL_SAFETIES_ON 1
#include <sol/sol.hpp>
extern "C" {
#include <lauxlib.h>
#include <lua.h>
}

namespace ArtCade::Modules {

// ------------------------------------------------------------------ Pimpl

struct LuaHost::Impl {
    struct MemoryBudget {
        size_t used = 0;
        size_t limit = 0;
        bool exceeded = false;
    } memory;

    static void* budgetAllocator(void* ud, void* ptr, size_t oldSize, size_t newSize) {
        auto* budget = static_cast<MemoryBudget*>(ud);
        if (newSize == 0) {
            if (ptr) {
                budget->used = oldSize > budget->used ? 0 : budget->used - oldSize;
                std::free(ptr);
            }
            return nullptr;
        }
        const size_t withoutOld = oldSize > budget->used ? 0 : budget->used - oldSize;
        if (budget->limit != 0 && newSize > budget->limit - withoutOld) {
            budget->exceeded = true;
            return nullptr;
        }
        void* next = std::realloc(ptr, newSize);
        if (!next) return nullptr;
        budget->used = withoutOld + newSize;
        return next;
    }

    explicit Impl(const LuaHostOptions& options)
        : memory{0, options.maxMemoryBytes, false},
          lua(options.maxMemoryBytes == 0
                  ? sol::state{}
                  : sol::state{sol::default_at_panic, &budgetAllocator, &memory}) {}

    sol::state lua;
    bool       scriptLoaded = false;
    bool       scriptTickRequired = true;
    bool       manualApiRequested = false;
    uint32_t   manualSupportedApiVersion = 0;
    int        manualOnStartRef = LUA_NOREF;
    int        manualOnUpdateRef = LUA_NOREF;

    static int requireManualApiVersion(lua_State* state) {
        auto* impl = static_cast<Impl*>(lua_touserdata(state, lua_upvalueindex(1)));
        const lua_Integer requested = luaL_checkinteger(state, 1);
        if (!impl) return luaL_error(state, "Manual script host is unavailable");
        impl->manualApiRequested = true;
        if (requested != static_cast<lua_Integer>(impl->manualSupportedApiVersion)) {
            return luaL_error(state, "Unsupported ArtCade script API version %d",
                              static_cast<int>(requested));
        }
        return 0;
    }

    void clearManualCallbacks() {
        lua_State* state = lua.lua_state();
        if (manualOnStartRef != LUA_NOREF) luaL_unref(state, LUA_REGISTRYINDEX, manualOnStartRef);
        if (manualOnUpdateRef != LUA_NOREF) luaL_unref(state, LUA_REGISTRYINDEX, manualOnUpdateRef);
        manualOnStartRef = LUA_NOREF;
        manualOnUpdateRef = LUA_NOREF;
        manualApiRequested = false;
    }
};

namespace {
thread_local int64_t g_manualInstructionBudget = 0;
thread_local uint32_t g_manualCallDepth = 0;
thread_local uint32_t g_manualMaxCallDepth = 0;
thread_local bool g_manualInstructionLimitExceeded = false;
thread_local bool g_manualCallDepthExceeded = false;

void manualInstructionHook(lua_State* state, lua_Debug* debug) {
    if (debug->event == LUA_HOOKCOUNT) {
        g_manualInstructionBudget -= 1000;
        if (g_manualInstructionBudget <= 0) {
            g_manualInstructionLimitExceeded = true;
            luaL_error(state, "Manual script instruction budget exceeded");
        }
    } else if (debug->event == LUA_HOOKCALL) {
        ++g_manualCallDepth;
        if (g_manualCallDepth > g_manualMaxCallDepth) {
            g_manualCallDepthExceeded = true;
            luaL_error(state, "Manual script call depth exceeded");
        }
    } else if (debug->event == LUA_HOOKRET && g_manualCallDepth > 0) {
        --g_manualCallDepth;
    }
}

class ManualHookGuard {
public:
    ManualHookGuard(lua_State* state, uint32_t budget, uint32_t maxCallDepth)
        : state_(state) {
        g_manualInstructionBudget = budget;
        g_manualCallDepth = 0;
        g_manualMaxCallDepth = maxCallDepth;
        g_manualInstructionLimitExceeded = false;
        g_manualCallDepthExceeded = false;
        lua_sethook(state_, manualInstructionHook,
                    LUA_MASKCOUNT | LUA_MASKCALL | LUA_MASKRET, 1000);
    }
    ~ManualHookGuard() { lua_sethook(state_, nullptr, 0, 0); }
private:
    lua_State* state_ = nullptr;
};

std::string luaStackError(lua_State* state, const char* fallback) {
    const char* error = lua_tostring(state, -1);
    return error ? std::string(error) : std::string(fallback);
}

int controlledManualRequire(lua_State* state) {
    const char* requested = luaL_checkstring(state, 1);
    for (const char* allowed : {"math", "string", "table", "utf8"}) {
        if (std::string(requested) != allowed) continue;
        lua_getglobal(state, allowed);
        return 1;
    }
    return luaL_error(state, "Module '%s' is not available in the Script sandbox", requested);
}

IGameplayRuntimeHost* manualGameplayHost(lua_State* state) {
    return static_cast<IGameplayRuntimeHost*>(
        lua_touserdata(state, lua_upvalueindex(1)));
}

EntityId manualOwner(lua_State* state) {
    return static_cast<EntityId>(lua_tointeger(state, lua_upvalueindex(2)));
}

int manualSetVisible(lua_State* state) {
    IGameplayRuntimeHost* host = manualGameplayHost(state);
    luaL_checktype(state, 1, LUA_TTABLE);
    luaL_checktype(state, 2, LUA_TBOOLEAN);
    if (!host || !host->setVisible(manualOwner(state), lua_toboolean(state, 2) != 0))
        return luaL_error(state, "ctx.self:set_visible failed");
    return 0;
}

int manualSetPosition(lua_State* state) {
    IGameplayRuntimeHost* host = manualGameplayHost(state);
    luaL_checktype(state, 1, LUA_TTABLE);
    const float x = static_cast<float>(luaL_checknumber(state, 2));
    const float y = static_cast<float>(luaL_checknumber(state, 3));
    if (!host || !host->setPosition(manualOwner(state), Vec2{x, y}))
        return luaL_error(state, "ctx.self:set_position failed");
    return 0;
}

void setManualSelfMethod(lua_State* state, IGameplayRuntimeHost* host,
                         EntityId owner, const char* name, lua_CFunction function) {
    lua_pushlightuserdata(state, host);
    lua_pushinteger(state, static_cast<lua_Integer>(owner));
    lua_pushcclosure(state, function, 2);
    lua_setfield(state, -2, name);
}

void pushManualContext(lua_State* state, IGameplayRuntimeHost* host, EntityId owner) {
    lua_newtable(state);
    lua_pushinteger(state, static_cast<lua_Integer>(owner));
    lua_setfield(state, -2, "entity_id");
    lua_newtable(state);
    setManualSelfMethod(state, host, owner, "set_visible", manualSetVisible);
    setManualSelfMethod(state, host, owner, "set_position", manualSetPosition);
    lua_setfield(state, -2, "self");
}

bool readTickRequirement(sol::state& lua) {
    sol::object flag = lua["__artcade_requires_tick"];
    if (flag.is<bool>())
        return flag.as<bool>();
    return true;
}
}

// ------------------------------------------------------------------ lifecycle

LuaHost::LuaHost(LuaHostOptions options)
    : impl_(std::make_unique<Impl>(options)), options_(options) {}
LuaHost::~LuaHost() = default;

bool LuaHost::init() {
    // Open only deterministic/sandboxed standard libraries (no io/os).
    if (options_.profile == LuaSandboxProfile::LogicBoardStrict
        || options_.profile == LuaSandboxProfile::ManualScriptStrict) {
        impl_->lua.open_libraries(sol::lib::base, sol::lib::math,
                                  sol::lib::string, sol::lib::table);
        if (options_.profile == LuaSandboxProfile::ManualScriptStrict)
            impl_->lua.open_libraries(sol::lib::utf8);
        // Lua's base library includes filesystem-capable loaders even when io/os
        // are not opened. Remove them explicitly for the generated-board VM.
        for (const char* name : {"dofile", "loadfile", "load", "collectgarbage"})
            impl_->lua[name] = sol::nil;
        impl_->lua["io"] = sol::nil;
        impl_->lua["os"] = sol::nil;
        impl_->lua["package"] = sol::nil;
        impl_->lua["require"] = sol::nil;
        impl_->lua["debug"] = sol::nil;
        impl_->lua["coroutine"] = sol::nil;
        if (options_.profile == LuaSandboxProfile::ManualScriptStrict) {
            impl_->lua["print"] = sol::nil;
            impl_->lua["warn"] = sol::nil;
            lua_pushcfunction(impl_->lua.lua_state(), controlledManualRequire);
            lua_setglobal(impl_->lua.lua_state(), "require");
        }
    } else {
        impl_->lua.open_libraries(
            sol::lib::base, sol::lib::math, sol::lib::string,
            sol::lib::table, sol::lib::coroutine);
        // Filesystem access is forbidden for every runtime profile.
        impl_->lua["dofile"] = sol::nil;
        impl_->lua["loadfile"] = sol::nil;
    }

    // Switch Lua 5.4 to generational GC mode.
    // Generational GC is ideal for games: short-lived objects (coins, bullets,
    // particles) are collected quickly in the minor cycle without touching
    // long-lived entities.  This eliminates the "frame spike" that occurs when
    // the standard incremental collector finally kicks in on a busy frame.
    lua_State* L = impl_->lua.lua_state();
    lua_gc(L, LUA_GCGEN,
           0,   // minor multiplier  (0 = use Lua default, ~20)
           0);  // major multiplier  (0 = use Lua default, ~100)

    // Run any pending C++ → Lua binding registrations
    for (auto& cb : pendingBindings_)
        cb(impl_->lua);
    pendingBindings_.clear();

    return true;
}

void LuaHost::shutdown() {
    impl_->clearManualCallbacks();
    impl_->scriptLoaded = false;
    // sol::state destructor handles Lua VM cleanup
}

// ------------------------------------------------------------------ bindings

void LuaHost::registerBindings(BindingCallback cb) {
    pendingBindings_.push_back(std::move(cb));
}

// ------------------------------------------------------------------ script loading

bool LuaHost::loadBytecodeBuffer(const uint8_t* data, size_t size) {
    auto result = impl_->lua.load_buffer(
        reinterpret_cast<const char*>(data), size, "@main.luac");

    if (!result.valid()) {
        sol::error err = result;
        lastError_ = std::string("load: ") + err.what();
        return false;
    }

    // Execute the chunk (defines globals like 'tick', 'init', …)
    sol::protected_function chunk = result;
    auto run = chunk();
    if (!run.valid()) {
        sol::error err = run;
        lastError_ = std::string("exec: ") + err.what();
        return false;
    }

    impl_->scriptLoaded = true;
    impl_->scriptTickRequired = readTickRequirement(impl_->lua);
    lastError_.clear();
    return true;
}

bool LuaHost::loadLuaSource(const std::string& sourceCode) {
    // safe_script compiles + runs the chunk; script_pass_on_error keeps the
    // VM alive (and the previous tick/globals intact) if the new code throws.
    auto result = impl_->lua.safe_script(
        sourceCode, sol::script_pass_on_error, "@logic-board.lua");

    if (!result.valid()) {
        sol::error err = result;
        lastError_ = std::string("hot-reload: ") + err.what();
        return false;
    }

    impl_->scriptLoaded = true;
    impl_->scriptTickRequired = readTickRequirement(impl_->lua);
    lastError_.clear();
    return true;
}

bool LuaHost::loadManualProgramSource(
    const std::string& sourceCode,
    const std::string& sourcePath,
    uint32_t supportedApiVersion,
    uint32_t maxInstructions,
    uint32_t maxCallDepth) {
    if (options_.profile != LuaSandboxProfile::ManualScriptStrict) {
        lastError_ = "Manual programs require the ManualScriptStrict sandbox";
        return false;
    }
    impl_->clearManualCallbacks();
    impl_->manualSupportedApiVersion = supportedApiVersion;
    lua_State* state = impl_->lua.lua_state();

    lua_newtable(state);
    lua_pushlightuserdata(state, impl_.get());
    lua_pushcclosure(state, Impl::requireManualApiVersion, 1);
    lua_setfield(state, -2, "require_api_version");
    lua_setglobal(state, "artcade");

    const std::string chunkName = "@" + sourcePath;
    if (luaL_loadbufferx(state, sourceCode.data(), sourceCode.size(),
                         chunkName.c_str(), "t") != LUA_OK) {
        lastError_ = "load: " + luaStackError(state, "Manual script load failed");
        lua_pop(state, 1);
        return false;
    }
    {
        ManualHookGuard hook(state, maxInstructions, maxCallDepth);
        const int callResult = lua_pcall(state, 0, 1, 0);
        if (callResult != LUA_OK) {
            lastError_ = "exec: " + luaStackError(state, "Manual script execution failed");
            lua_pop(state, 1);
            return false;
        }
    }
    if (g_manualInstructionLimitExceeded || g_manualCallDepthExceeded
        || impl_->memory.exceeded) {
        lua_pop(state, 1);
        lastError_ = impl_->memory.exceeded
            ? "Manual script memory limit exceeded"
            : g_manualCallDepthExceeded
                ? "Manual script call depth exceeded"
                : "Manual script instruction budget exceeded";
        return false;
    }
    if (!impl_->manualApiRequested) {
        lua_pop(state, 1);
        lastError_ = "Script must call artcade.require_api_version";
        return false;
    }
    if (!lua_istable(state, -1)) {
        lua_pop(state, 1);
        lastError_ = "Script chunk must return a table";
        return false;
    }

    const auto captureCallback = [&](const char* name, int& target) -> bool {
        lua_pushstring(state, name);
        lua_rawget(state, -2);
        if (lua_isnil(state, -1)) {
            lua_pop(state, 1);
            return true;
        }
        if (!lua_isfunction(state, -1)) {
            lua_pop(state, 1);
            lastError_ = std::string("Script field '") + name + "' must be a function";
            return false;
        }
        target = luaL_ref(state, LUA_REGISTRYINDEX);
        return true;
    };
    const bool valid = captureCallback("on_start", impl_->manualOnStartRef)
        && captureCallback("on_update", impl_->manualOnUpdateRef);
    lua_pop(state, 1);
    if (!valid) {
        impl_->clearManualCallbacks();
        return false;
    }
    impl_->scriptLoaded = true;
    lastError_.clear();
    return true;
}

namespace {
bool callManualCallback(lua_State* state, int callbackRef,
                        IGameplayRuntimeHost* host, EntityId owner,
                        const float* dt, uint32_t maxInstructions,
                        uint32_t maxCallDepth,
                        std::string& error) {
    if (callbackRef == LUA_NOREF) return true;
    lua_rawgeti(state, LUA_REGISTRYINDEX, callbackRef);
    pushManualContext(state, host, owner);
    int arguments = 1;
    if (dt) {
        lua_pushnumber(state, static_cast<lua_Number>(*dt));
        ++arguments;
    }
    ManualHookGuard hook(state, maxInstructions, maxCallDepth);
    const int callResult = lua_pcall(state, arguments, 0, 0);
    if (g_manualInstructionLimitExceeded || g_manualCallDepthExceeded) {
        if (callResult != LUA_OK) lua_pop(state, 1);
        error = g_manualCallDepthExceeded
            ? "Manual script call depth exceeded"
            : "Manual script instruction budget exceeded";
        return false;
    }
    if (callResult == LUA_OK) return true;
    error = luaStackError(state, "Manual script callback failed");
    lua_pop(state, 1);
    return false;
}
}

bool LuaHost::callManualOnStart(IGameplayRuntimeHost* host, EntityId owner,
                                uint32_t maxInstructions,
                                uint32_t maxCallDepth) {
    lastError_.clear();
    const bool ok = callManualCallback(impl_->lua.lua_state(), impl_->manualOnStartRef,
                                       host, owner, nullptr, maxInstructions,
                                       maxCallDepth, lastError_);
    if (ok && impl_->memory.exceeded) lastError_ = "Manual script memory limit exceeded";
    return ok && !impl_->memory.exceeded;
}

bool LuaHost::callManualOnUpdate(IGameplayRuntimeHost* host, EntityId owner, float dt,
                                 uint32_t maxInstructions,
                                 uint32_t maxCallDepth) {
    lastError_.clear();
    const bool ok = callManualCallback(impl_->lua.lua_state(), impl_->manualOnUpdateRef,
                                       host, owner, &dt, maxInstructions,
                                       maxCallDepth, lastError_);
    if (ok && impl_->memory.exceeded) lastError_ = "Manual script memory limit exceeded";
    return ok && !impl_->memory.exceeded;
}

bool LuaHost::hasManualOnUpdate() const {
    return impl_->manualOnUpdateRef != LUA_NOREF;
}

// ------------------------------------------------------------------ calls

void LuaHost::tick(float dt) {
    if (!impl_->scriptLoaded) return;

    // Advance internal timer system (injected by time-api.cpp).
    // Safe no-op if time API was not registered (e.g. in unit tests).
    sol::protected_function timeUpdate = impl_->lua["_time_update"];
    if (timeUpdate.valid()) {
        auto r = timeUpdate(dt);
        if (!r.valid()) {
            sol::error err = r;
            lastError_ = err.what();
            return;
        }
    }

    if (!impl_->scriptTickRequired) {
        return;
    }

    sol::protected_function fn = impl_->lua["tick"];
    if (!fn.valid()) return;

    auto result = fn(dt);
    if (!result.valid()) {
        sol::error err = result;
        lastError_ = err.what();
    }

    // Intentionally no per-tick lua_gc(LUA_GCSTEP) call here. Per the Lua 5.4
    // reference manual, LUA_GCSTEP switches the collector back to incremental
    // mode — which would silently defeat the LUA_GCGEN configured in init().
    // Generational mode runs minor cycles automatically on allocation, with
    // no help needed from the host. Tune via LUA_GCGEN(minor, major) if a
    // particular game profile spikes on the major cycle.
}

bool LuaHost::isScriptTickRequired() const {
    return impl_->scriptTickRequired;
}

bool LuaHost::memoryLimitExceeded() const {
    return impl_->memory.exceeded;
}

} // namespace ArtCade::Modules

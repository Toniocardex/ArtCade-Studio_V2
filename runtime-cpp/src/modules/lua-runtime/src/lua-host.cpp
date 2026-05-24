#include "../include/lua-host.h"
#include <memory>

// Sol2 is a heavyweight header; include only in this TU.
#define SOL_ALL_SAFETIES_ON 1
#include <sol/sol.hpp>

namespace ArtCade::Modules {

// ------------------------------------------------------------------ Pimpl

struct LuaHost::Impl {
    sol::state lua;
    bool       scriptLoaded = false;
    bool       scriptTickRequired = true;
};

namespace {
bool readTickRequirement(sol::state& lua) {
    sol::object flag = lua["__artcade_requires_tick"];
    if (flag.is<bool>())
        return flag.as<bool>();
    return true;
}
}

// ------------------------------------------------------------------ lifecycle

LuaHost::LuaHost()  : impl_(std::make_unique<Impl>()) {}
LuaHost::~LuaHost() = default;

bool LuaHost::init() {
    // Open only the safe standard libraries (no io/os by default)
    impl_->lua.open_libraries(
        sol::lib::base,
        sol::lib::math,
        sol::lib::string,
        sol::lib::table,
        sol::lib::coroutine,
        sol::lib::io          // needed for log file writing in scripts
    );

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

bool LuaHost::loadBytecodeFile(const std::string& path) {
    // Open file in binary mode
    auto result = impl_->lua.load_file(path);
    if (!result.valid()) {
        sol::error err = result;
        lastError_ = std::string("load_file: ") + err.what();
        return false;
    }

    sol::protected_function chunk = result;
    auto run = chunk();
    if (!run.valid()) {
        sol::error err = run;
        lastError_ = std::string("exec_file: ") + err.what();
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
        lua_gc(impl_->lua.lua_state(), LUA_GCSTEP, 5);
        return;
    }

    sol::protected_function fn = impl_->lua["tick"];
    if (!fn.valid()) return;

    auto result = fn(dt);
    if (!result.valid()) {
        sol::error err = result;
        lastError_ = err.what();
    }

    // Run a tiny incremental GC step after every tick (~5 KB worth of work).
    // This spreads collection across frames so no single frame pays the full
    // GC cost when a burst of objects (coin, particles, callbacks) is freed.
    lua_gc(impl_->lua.lua_state(), LUA_GCSTEP, 5);
}

bool LuaHost::isScriptTickRequired() const {
    return impl_->scriptTickRequired;
}

void LuaHost::callFunction(const std::string& name) {
    sol::protected_function fn = impl_->lua[name];
    if (!fn.valid()) return;

    auto result = fn();
    if (!result.valid()) {
        sol::error err = result;
        lastError_ = err.what();
    }
}

} // namespace ArtCade::Modules

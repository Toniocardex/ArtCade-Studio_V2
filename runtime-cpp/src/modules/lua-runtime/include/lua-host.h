#pragma once

#include "../../../core/module.h"
#include <string>
#include <vector>
#include <functional>

// Forward-declare sol::state to avoid leaking sol2 into public API
namespace sol { class state; }

namespace ArtCade::Modules {

/**
 * LuaHost — Lua 5.4 VM wrapper.
 *
 * Loads compiled bytecode (.luac) and drives the game-logic tick.
 * Sol2 and Lua internals are confined to src/lua-host.cpp.
 */
class LuaHost final : public IModule {
public:
    LuaHost() = default;

    bool init() override;
    void shutdown() override;

    // Register bindings before loading any script
    // Callback receives a sol::state& to register C++ -> Lua functions
    using BindingCallback = std::function<void(sol::state&)>;
    void registerBindings(BindingCallback cb);

    // Load compiled Lua bytecode
    bool loadBytecodeFile(const std::string& path);
    bool loadBytecodeBuffer(const uint8_t* data, size_t size);

    // Execute the global "tick" function (called every fixed step)
    void tick(float dt);

    // Execute an arbitrary named global function
    void callFunction(const std::string& name);

    bool        hasError()     const { return !lastError_.empty(); }
    std::string lastError()    const { return lastError_; }
    void        clearError()         { lastError_.clear(); }

private:
    std::unique_ptr<sol::state> lua_;
    std::string                 lastError_;
    std::vector<BindingCallback> pendingBindings_;

    void setupSafeLibraries();
};

} // namespace ArtCade::Modules

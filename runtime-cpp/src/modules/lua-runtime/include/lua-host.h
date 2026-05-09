#pragma once

#include "../../../core/module.h"
#include <string>
#include <vector>
#include <functional>
#include <memory>

// Forward-declare sol::state so BindingCallback can reference it without
// pulling all of Sol2 into every translation unit that includes this header.
// The full definition is only needed in lua-host.cpp and game-api.cpp.
namespace sol { class state; }

namespace ArtCade::Modules {

/**
 * LuaHost — Lua 5.4 VM wrapper.
 *
 * Loads compiled bytecode (.luac) and drives the game-logic tick.
 * Sol2 and Lua internals are confined to src/lua-host.cpp via Pimpl.
 */
class LuaHost final : public IModule {
public:
    LuaHost();
    ~LuaHost();  // defined in .cpp where Impl (and sol::state) are complete

    bool init()     override;
    void shutdown() override;

    // Register bindings before loading any script.
    // Callback receives a sol::state& to register C++ ↔ Lua functions.
    using BindingCallback = std::function<void(sol::state&)>;
    void registerBindings(BindingCallback cb);

    // Load compiled Lua bytecode
    bool loadBytecodeFile(const std::string& path);
    bool loadBytecodeBuffer(const uint8_t* data, size_t size);

    // Execute the global "tick" function (called every fixed step)
    void tick(float dt);

    // Execute an arbitrary named global function
    void callFunction(const std::string& name);

    bool        hasError()  const { return !lastError_.empty(); }
    std::string lastError() const { return lastError_; }
    void        clearError()      { lastError_.clear(); }

private:
    struct Impl;               // defined in lua-host.cpp
    std::unique_ptr<Impl> impl_;

    std::string                  lastError_;
    std::vector<BindingCallback> pendingBindings_;
};

} // namespace ArtCade::Modules

#pragma once

#include <sol/sol.hpp>
#include <string>

namespace ArtCade {

class GameAPI;

/**
 * LuaHost: Manages Lua VM and script execution
 *
 * Loads compiled Lua bytecode and executes game logic.
 */
class LuaHost {
public:
    LuaHost();
    ~LuaHost();

    void init(GameAPI* gameAPI);
    void shutdown();

    // Load compiled Lua bytecode from file or buffer
    bool loadBytecode(const std::string& path);
    bool loadBytecodeFromBuffer(const uint8_t* data, size_t size);

    // Execute main tick function
    // Called once per game frame with deltaTime
    void tick(float deltaTime);

    // Execute arbitrary Lua function
    void callFunction(const std::string& functionName, const sol::object& arg = sol::nil);

    // Get/set global Lua variables
    sol::object getGlobal(const std::string& varName) const;
    void setGlobal(const std::string& varName, const sol::object& value);

    // Error handling
    bool hasErrors() const;
    std::string getLastError() const;

private:
    sol::state lua_;
    bool isInitialized_ = false;
    std::string lastError_;

    void setupDefaultLibraries();
};

} // namespace ArtCade

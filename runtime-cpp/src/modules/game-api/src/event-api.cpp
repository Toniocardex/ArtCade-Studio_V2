// event-api.cpp — Lua-side EventBus
//
// Exposes:
//   event.on(name, callback)    → unsubscribe handle (function)
//   event.once(name, callback)  → fires once then auto-removes
//   event.off(name, callback)   → remove a specific listener
//   event.emit(name, payload?)  → call all listeners for 'name'
//
// Implemented entirely in Lua (no C++ dependency) for simplicity.
// Payload is an optional Lua value passed to every listener.

#include "../include/game-api.h"
#include <sol/sol.hpp>

namespace ArtCade::Modules {

void GameAPI::bindEventAPI(sol::state& lua) {
    lua.script(R"(
        local _listeners = {}

        event = {}

        -- Register a persistent listener.
        -- Returns an unsubscribe function: call it to remove this listener.
        function event.on(name, cb)
            if not _listeners[name] then _listeners[name] = {} end
            local entry = { cb = cb, once = false }
            table.insert(_listeners[name], entry)
            return function()
                local list = _listeners[name]
                if not list then return end
                for i = #list, 1, -1 do
                    if list[i] == entry then table.remove(list, i) end
                end
            end
        end

        -- Register a one-shot listener (auto-removed after first fire).
        function event.once(name, cb)
            if not _listeners[name] then _listeners[name] = {} end
            table.insert(_listeners[name], { cb = cb, once = true })
        end

        -- Manually remove all copies of cb from name.
        function event.off(name, cb)
            local list = _listeners[name]
            if not list then return end
            for i = #list, 1, -1 do
                if list[i].cb == cb then table.remove(list, i) end
            end
        end

        -- Emit name with optional payload; calls all registered listeners.
        function event.emit(name, payload)
            local list = _listeners[name]
            if not list then return end
            -- iterate on a copy so listeners can safely call event.off
            local snapshot = {}
            for _, e in ipairs(list) do snapshot[#snapshot+1] = e end
            for _, entry in ipairs(snapshot) do
                entry.cb(payload)
            end
            -- remove once-entries
            local newList = {}
            for _, e in ipairs(list) do
                if not e.once then newList[#newList+1] = e end
            end
            _listeners[name] = newList
        end
    )");
}

} // namespace ArtCade::Modules

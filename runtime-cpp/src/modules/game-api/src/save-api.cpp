// save-api.cpp — Lua bindings for SaveLoadManager
//
// Exposes:
//   save.write(slot, table)  — persist a flat key/value Lua table to disk
//   save.read(slot)          — load a slot; returns table or nil
//   save.exists(slot)        — bool
//   save.delete(slot)        — remove the .sav file
//   save.list()              — array of slot-name strings
//
// Value types supported: integer, float, bool, string.
// Keys must be strings; non-string keys are silently skipped.

#include "../include/game-api.h"
#include "../../save-load/include/save-load-manager.h"

#include <sol/sol.hpp>
#include <variant>

namespace ArtCade::Modules {

void GameAPI::bindSaveAPI(sol::state& lua) {
    auto* slm = ctx_.saveLoadManager;

    // ------------------------------------------------------------------
    // save.write(slot, table) → bool
    // Iterates the Lua table and serialises each string-keyed entry.
    // ------------------------------------------------------------------
    lua.set_function("save_write",
        [slm](const std::string& slot, sol::table tbl) -> bool
        {
            if (!slm) return false;

            SaveLoadManager::Snapshot snap;

            tbl.for_each([&](sol::object k, sol::object v) {
                if (!k.is<std::string>()) return;   // skip non-string keys
                const std::string key = k.as<std::string>();

                // Order matters: check bool before int (both numeric in some impls)
                if      (v.is<bool>())        snap[key] = v.as<bool>();
                else if (v.is<int>())         snap[key] = v.as<int32_t>();
                else if (v.is<double>())      snap[key] = static_cast<float>(v.as<double>());
                else if (v.is<std::string>()) snap[key] = v.as<std::string>();
                // silently skip unsupported types (tables, functions, …)
            });

            return slm->save(slot, snap);
        });

    // ------------------------------------------------------------------
    // save.read(slot) → table | nil
    // ------------------------------------------------------------------
    lua.set_function("save_read",
        [slm](sol::this_state ts, const std::string& slot) -> sol::object
        {
            if (!slm) return sol::lua_nil;

            auto snap = slm->load(slot);
            if (!snap) return sol::lua_nil;  // file not found or parse error

            sol::state_view L(ts);
            sol::table tbl = L.create_table(0, static_cast<int>(snap->size()));

            for (auto& [k, v] : *snap) {
                // VariableManager::Value = variant<int32_t, float, bool, string>
                if (auto* i = std::get_if<int32_t>    (&v)) tbl[k] = *i;
                else if (auto* f = std::get_if<float> (&v)) tbl[k] = *f;
                else if (auto* b = std::get_if<bool>  (&v)) tbl[k] = *b;
                else if (auto* s = std::get_if<std::string>(&v)) tbl[k] = *s;
            }

            return sol::make_object(L, tbl);
        });

    // ------------------------------------------------------------------
    // save.exists(slot) → bool
    // ------------------------------------------------------------------
    lua.set_function("save_exists",
        [slm](const std::string& slot) -> bool {
            return slm && slm->hasSave(slot);
        });

    // ------------------------------------------------------------------
    // save.delete(slot)
    // ------------------------------------------------------------------
    lua.set_function("save_delete",
        [slm](const std::string& slot) {
            if (slm) slm->deleteSave(slot);
        });

    // ------------------------------------------------------------------
    // save.list() → array table of slot name strings
    // ------------------------------------------------------------------
    lua.set_function("save_list",
        [slm](sol::this_state ts) -> sol::object {
            sol::state_view L(ts);
            sol::table tbl = L.create_table();
            if (!slm) return sol::make_object(L, tbl);

            auto slots = slm->listSlots();
            for (size_t i = 0; i < slots.size(); ++i)
                tbl[static_cast<int>(i) + 1] = slots[i];   // 1-based Lua index

            return sol::make_object(L, tbl);
        });

    // Lua-side convenience table
    lua.script(R"(
        save = {}
        save.write  = function(slot, t)  return save_write(slot, t)   end
        save.read   = function(slot)     return save_read(slot)        end
        save.exists = function(slot)     return save_exists(slot)      end
        save.delete = function(slot)     return save_delete(slot)      end
        save.list   = function()         return save_list()            end
    )");
}

} // namespace ArtCade::Modules

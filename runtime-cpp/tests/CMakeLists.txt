cmake_minimum_required(VERSION 3.20)

# ============================================================================
# Helper
# ============================================================================
function(artcade_test TARGET SOURCES LIBS)
    add_executable(${TARGET} ${SOURCES})
    target_include_directories(${TARGET} PRIVATE ${CMAKE_SOURCE_DIR}/src)
    target_link_libraries(${TARGET} PRIVATE ${LIBS})
    add_test(NAME ${TARGET} COMMAND ${TARGET})
endfunction()

# ============================================================================
# Fase 1-2: moduli stateless (nessuna dipendenza da Raylib)
# Sempre compilati — il checkpoint di Fase 3 li esegue tutti.
# ============================================================================
artcade_test(time_manager_test
    time-manager-test.cpp
    artcade-time)

artcade_test(event_bus_test
    event-bus-test.cpp
    artcade-event-bus)

artcade_test(variable_manager_test
    variable-manager-test.cpp
    artcade-variable-manager)

artcade_test(game_state_test
    game-state-test.cpp
    "artcade-game-state;artcade-event-bus")

artcade_test(sprite_animator_test
    sprite-animator-test.cpp
    artcade-sprite-animator)

artcade_test(layer_manager_test
    layer-manager-test.cpp
    artcade-layer-manager)

artcade_test(camera_manager_test
    camera-manager-test.cpp
    artcade-camera-manager)

artcade_test(tween_manager_test
    tween-manager-test.cpp
    artcade-tween-manager)

artcade_test(save_load_test
    save-load-test.cpp
    "artcade-save-load;artcade-variable-manager")

# ============================================================================
# TextureManager — compilato con stub Raylib (funziona anche senza GPU).
# Le sorgenti vengono compilate direttamente (no link a artcade-texture-manager
# che richiederebbe il vero Raylib).
# ============================================================================
add_executable(texture_manager_test
    texture-manager-test.cpp
    ${CMAKE_SOURCE_DIR}/src/modules/texture-manager/src/texture-manager.cpp
    stubs/raylib-stub.cpp
)
target_include_directories(texture_manager_test PRIVATE
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/stubs   # stub/raylib.h ha priorità sul vero raylib.h
)
add_test(NAME texture_manager_test COMMAND texture_manager_test)

# ============================================================================
# Fase 12: Physics (Box2D) — nessuna dipendenza da Raylib o Lua
# ============================================================================
artcade_test(physics_test
    physics-test.cpp
    artcade-physics)

# ============================================================================
# Fase 13: LuaHost error-handling — no Raylib, no GameAPI
# ============================================================================
artcade_test(lua_host_test
    lua-host-test.cpp
    artcade-lua-runtime)

# ============================================================================
# Fase 16: Logic Components — 5 Lua components via LuaHost + inline stubs
# Nessuna dipendenza da Raylib o GameAPI (stubs iniettati come Lua puro).
# ============================================================================
artcade_test(logic_components_test
    logic-components-test.cpp
    artcade-lua-runtime)

# ============================================================================
# Fase 17: .artcade ZIP round-trip — richiede artcade-asset-system
# (compilato solo quando Raylib + Lua sono presenti, come asset-system stesso)
# ============================================================================
if(ARTCADE_HAS_RAYLIB AND ARTCADE_HAS_LUA)
    artcade_test(artcade_package_test
        artcade-package-test.cpp
        artcade-asset-system)
endif()

# ============================================================================
# Fase 5+: test che richiedono Raylib reale (aggiunti quando ARTCADE_HAS_RAYLIB)
# ============================================================================
# (placeholder per test di renderer, input, audio — verranno aggiunti in Fase 5-8)

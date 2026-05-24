add_library(artcade-world
    src/world.cpp
    src/world_movement.cpp
    src/world_systems.cpp
    src/world_tilemap.cpp
)
target_include_directories(artcade-world
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-world
    PUBLIC
        artcade-core
        artcade-runtime-entity-gateway
        artcade-physics
        artcade-variable-manager
        artcade-input
        artcade-renderer
)

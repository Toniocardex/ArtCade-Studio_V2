add_library(artcade-runtime-entity-gateway
    src/runtime-entity-gateway.cpp
)
target_include_directories(artcade-runtime-entity-gateway
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-runtime-entity-gateway
    PUBLIC
        artcade-core
        artcade-entity-system
        artcade-scene-system
        artcade-physics
)

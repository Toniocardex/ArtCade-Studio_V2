add_library(artcade-game-api
    src/game-api.cpp
    src/entity-api.cpp
    src/physics-api.cpp
    src/input-api.cpp
    src/audio-api.cpp
    src/state-api.cpp
    src/debug-api.cpp
)
target_include_directories(artcade-game-api
    PUBLIC  include
    PRIVATE src
)
target_link_libraries(artcade-game-api
    PUBLIC
        artcade-core
        artcade-renderer
        artcade-physics
        artcade-input
        artcade-audio
        artcade-entity-system
        artcade-scene-system
    PRIVATE
        lua
)
